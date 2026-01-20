<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import QRCode from 'qrcode';
  import { toast } from 'svelte-sonner';

  let { data } = $props();

  let wifiQrCode = $state<string>('');
  let isMarking = $state(false);

  async function markAsPrinted() {
    if (data.vouchers.length === 0 || isMarking) return;

    isMarking = true;
    try {
      const codes = data.vouchers.map(v => v.name);
      const response = await fetch('/api/vouchers/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codes })
      });

      if (!response.ok) {
        throw new Error('Failed to mark as printed');
      }

      toast.success(`تم تسجيل ${codes.length} كرت كمطبوع`);
    } catch (error) {
      console.error('Failed to mark vouchers as printed:', error);
      toast.error('فشل في تسجيل الكروت كمطبوعة');
    } finally {
      isMarking = false;
    }
  }

  onMount(async () => {
    // Generate WiFi connection QR code (same for all cards)
    // Format: WIFI:T:nopass;S:SSID;H:false;;
    const ssid = data.wifiSSID || 'AboYassen';
    const wifiString = `WIFI:T:nopass;S:${ssid};H:false;;`;
    wifiQrCode = await QRCode.toDataURL(wifiString, {
      width: 300,
      margin: 1,
      errorCorrectionLevel: 'M'
    });

    // Auto-print if autoprint parameter is set (for PDF export)
    const autoprint = $page.url.searchParams.get('autoprint');
    if (autoprint === 'true' && data.vouchers.length > 0) {
      // Wait a moment for QR codes to render
      setTimeout(() => {
        window.print();
      }, 500);
    }
  });

  function print() {
    window.print();
    // Mark as printed after print dialog closes
    setTimeout(() => {
      markAsPrinted();
    }, 1000);
  }
</script>

<svelte:head>
  <title>طباعة الكروت</title>
  <style>
    @media print {
      @page {
        size: A4;
        margin: 5mm;
      }

      /* Print colors correctly */
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      html, body {
        margin: 0 !important;
        padding: 0 !important;
        background: white !important;
      }

      /* Hide toolbar */
      .no-print,
      .toolbar {
        display: none !important;
      }

      /* Simple layout for print */
      .print-layout {
        background: white !important;
        padding: 0 !important;
        margin: 0 !important;
      }

      /* Page breaks - only between pages, not after last */
      .print-page {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }

      .print-page:not(:last-child) {
        page-break-after: always !important;
        break-after: page !important;
      }
    }
  </style>
</svelte:head>

<!-- Toolbar -->
<div class="no-print toolbar">
  <span class="card-count">عدد الكروت: {data.vouchers.length}</span>
  <div class="toolbar-actions">
    <button onclick={markAsPrinted} class="mark-btn" disabled={isMarking}>
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M20 6 9 17l-5-5"></path>
      </svg>
      {isMarking ? 'جاري التسجيل...' : 'تسجيل كمطبوع'}
    </button>
    <button onclick={print} class="print-btn">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="6 9 6 2 18 2 18 9"></polyline>
        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
        <rect x="6" y="14" width="12" height="8"></rect>
      </svg>
      طباعة
    </button>
  </div>
</div>

<!-- Print Wrapper - This is what gets printed -->
<div class="print-wrapper">
  <div dir="rtl" class="print-container">
    <!-- 12 cards per page: 3 columns × 4 rows -->
    {#each Array(Math.ceil(data.vouchers.length / 12)) as _, pageIndex}
      <div class="print-page">
        <div class="cards-grid">
          {#each data.vouchers.slice(pageIndex * 12, (pageIndex + 1) * 12) as voucher}
            <div class="voucher-card">
              <!-- Single line header: Business + Package + Price -->
              <div class="card-header">
                <div class="header-right">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" class="wifi-icon">
                    <path d="M12 18c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm-4.9-2.3l1.4 1.4C9.4 18 10.6 18.5 12 18.5s2.6-.5 3.5-1.4l1.4-1.4c-1.3-1.3-3.1-2.2-4.9-2.2s-3.6.9-4.9 2.2zM5.7 14.3l1.4 1.4c2.7-2.7 7.1-2.7 9.8 0l1.4-1.4c-3.5-3.5-9.1-3.5-12.6 0z"/>
                  </svg>
                  <span class="business-name">{data.businessName}</span>
                </div>
                <div class="header-left">
                  <span class="package-name">{voucher.pkg?.nameAr || 'باقة'}</span>
                  <span class="divider">|</span>
                  <span class="package-price">{voucher.priceLE} ج.م</span>
                </div>
              </div>

              <!-- WiFi QR Code -->
              <div class="qr-section">
                {#if wifiQrCode}
                  <img src={wifiQrCode} alt="WiFi QR" class="qr-image" />
                {:else}
                  <div class="qr-placeholder"></div>
                {/if}
              </div>

              <!-- Single Code - Large and Prominent -->
              <div class="code-section">
                <span class="code-label">كود الدخول</span>
                <span class="code-value">{voucher.name}</span>
              </div>

              <!-- Footer -->
              <div class="card-footer">
                امسح للاتصال بالواي فاي ← أدخل الكود
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  /* Toolbar */
  .toolbar {
    position: sticky;
    top: 0;
    z-index: 100;
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
    padding: 16px 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid rgba(8, 145, 178, 0.3);
  }

  .toolbar-actions {
    display: flex;
    gap: 12px;
    align-items: center;
  }

  .card-count {
    color: #94a3b8;
    font-size: 15px;
    font-family: 'Cairo', sans-serif;
  }

  .mark-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(34, 197, 94, 0.15);
    color: #4ade80;
    padding: 10px 20px;
    border-radius: 8px;
    border: 1px solid rgba(34, 197, 94, 0.3);
    font-size: 14px;
    font-weight: 600;
    font-family: 'Cairo', sans-serif;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .mark-btn:hover:not(:disabled) {
    background: rgba(34, 197, 94, 0.25);
    border-color: rgba(34, 197, 94, 0.5);
  }

  .mark-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .print-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    background: linear-gradient(135deg, #0891b2 0%, #0e7490 100%);
    color: white;
    padding: 10px 20px;
    border-radius: 8px;
    border: none;
    font-size: 14px;
    font-weight: 600;
    font-family: 'Cairo', sans-serif;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .print-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 15px rgba(8, 145, 178, 0.4);
  }

  /* Print Wrapper */
  .print-wrapper {
    background: white;
  }

  /* Print Container */
  .print-container {
    background: white;
    margin: 0 auto;
    padding: 0;
    box-sizing: border-box;
  }

  .print-page {
    padding: 8mm;
    box-sizing: border-box;
  }

  /* Cards Grid - 3 columns x 4 rows = 12 per page */
  /* Narrower cards: 52mm x 65mm */
  .cards-grid {
    display: grid;
    grid-template-columns: repeat(3, 52mm);
    grid-auto-rows: 65mm;
    gap: 6mm;
    justify-content: center;
    align-content: start;
  }

  /* Voucher Card - Narrower */
  .voucher-card {
    border: 1.5px solid #222;
    border-radius: 6px;
    background: white;
    overflow: hidden;
    width: 52mm;
    height: 65mm;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
  }

  /* Card Header - Compact single line */
  .card-header {
    background: #0891b2;
    color: white;
    padding: 4px 6px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-shrink: 0;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 3px;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 3px;
  }

  .business-name {
    font-size: 8px;
    font-weight: 700;
    font-family: 'Cairo', sans-serif;
  }

  .wifi-icon {
    opacity: 0.9;
    flex-shrink: 0;
    width: 12px;
    height: 12px;
  }

  .package-name {
    font-size: 9px;
    font-weight: 700;
    font-family: 'Cairo', sans-serif;
  }

  .divider {
    opacity: 0.6;
    font-size: 9px;
  }

  .package-price {
    font-size: 9px;
    font-weight: 600;
    font-family: 'Cairo', sans-serif;
  }

  /* QR Section - Bigger */
  .qr-section {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2px;
    background: white;
  }

  .qr-image {
    width: 32mm;
    height: 32mm;
  }

  .qr-placeholder {
    width: 32mm;
    height: 32mm;
    background: #e5e5e5;
    border-radius: 4px;
  }

  /* Code Section - Large and Prominent */
  .code-section {
    padding: 6px 8px;
    background: #f8f8f8;
    border-top: 1px solid #e0e0e0;
    flex-shrink: 0;
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .code-label {
    font-size: 7px;
    color: #666;
    font-family: 'Cairo', sans-serif;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .code-value {
    font-size: 16px;
    font-weight: 800;
    color: #000;
    font-family: 'IBM Plex Mono', 'Courier New', monospace;
    letter-spacing: 3px;
    background: #fff;
    padding: 4px 8px;
    border-radius: 6px;
    border: 2px solid #0891b2;
  }

  /* Card Footer */
  .card-footer {
    background: #1a1a1a;
    color: white;
    text-align: center;
    padding: 3px;
    font-size: 7px;
    font-family: 'Cairo', sans-serif;
    flex-shrink: 0;
  }

  /* Print-specific */
  @media print {
    .print-wrapper {
      background: white !important;
    }

    .print-container {
      margin: 0 !important;
      padding: 0 !important;
    }

    .print-page {
      padding: 5mm !important;
      margin: 0 !important;
      height: auto !important;
      min-height: 0 !important;
      max-height: none !important;
      overflow: visible !important;
    }

    .cards-grid {
      gap: 5mm !important;
      grid-auto-rows: auto !important;
    }

    .voucher-card {
      border: 1pt solid #000 !important;
      height: 63mm !important;
    }

    .card-header {
      background: #0891b2 !important;
    }

    .card-footer {
      background: #1a1a1a !important;
    }

    .qr-section {
      background: white !important;
    }

    .code-section {
      background: #f8f8f8 !important;
    }

    .code-value {
      border: 2pt solid #0891b2 !important;
      background: white !important;
    }
  }
</style>
