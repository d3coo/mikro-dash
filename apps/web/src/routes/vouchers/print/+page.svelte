<script lang="ts">
  import { onMount } from 'svelte';
  import QRCode from 'qrcode';

  let { data } = $props();

  let qrCodes = $state<Record<string, string>>({});

  onMount(async () => {
    for (const voucher of data.vouchers) {
      // Use voucher.name as the username (the actual voucher code like G3AB)
      const loginUrl = `http://10.10.10.1/login?dst=http://google.com&username=${voucher.name}&password=${voucher.password}`;
      // Higher resolution QR for better scanning (28mm ~ 106px at 96dpi, use 300 for print quality)
      qrCodes[voucher.id] = await QRCode.toDataURL(loginUrl, {
        width: 300,
        margin: 1,
        errorCorrectionLevel: 'M'
      });
    }
  });

  function print() {
    window.print();
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

      /* Reset everything */
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        background: white !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        overflow: visible !important;
      }

      /* Hide ALL elements by default */
      body * {
        visibility: hidden;
      }

      /* Only show print-wrapper and its children */
      .print-wrapper,
      .print-wrapper * {
        visibility: visible !important;
      }

      /* Position print-wrapper to cover entire page */
      .print-wrapper {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        width: 100% !important;
        height: auto !important;
        z-index: 999999 !important;
        background: white !important;
      }

      /* Hide toolbar */
      .no-print {
        display: none !important;
        visibility: hidden !important;
      }

      /* Page breaks */
      .print-page {
        page-break-after: always;
        page-break-inside: avoid;
      }
      .print-page:last-child {
        page-break-after: auto;
      }
    }
  </style>
</svelte:head>

<!-- Toolbar -->
<div class="no-print toolbar">
  <span class="card-count">عدد الكروت: {data.vouchers.length}</span>
  <button onclick={print} class="print-btn">
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="6 9 6 2 18 2 18 9"></polyline>
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
      <rect x="6" y="14" width="12" height="8"></rect>
    </svg>
    طباعة
  </button>
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

              <!-- QR Code - Bigger -->
              <div class="qr-section">
                {#if qrCodes[voucher.id]}
                  <img src={qrCodes[voucher.id]} alt="QR" class="qr-image" />
                {:else}
                  <div class="qr-placeholder"></div>
                {/if}
              </div>

              <!-- Credentials -->
              <div class="credentials">
                <div class="credential-row">
                  <span class="label">المستخدم:</span>
                  <span class="value">{voucher.name}</span>
                </div>
                <div class="credential-row">
                  <span class="label">كلمة المرور:</span>
                  <span class="value">{voucher.password}</span>
                </div>
              </div>

              <!-- Footer -->
              <div class="card-footer">
                اتصل بالشبكة ← امسح الكود
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

  .card-count {
    color: #94a3b8;
    font-size: 15px;
    font-family: 'Cairo', sans-serif;
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
    grid-template-rows: repeat(4, 65mm);
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

  /* Credentials */
  .credentials {
    padding: 3px 6px;
    background: white;
    border-top: 1px solid #e5e5e5;
    flex-shrink: 0;
  }

  .credential-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1px 0;
  }

  .label {
    font-size: 8px;
    color: #555;
    font-family: 'Cairo', sans-serif;
  }

  .value {
    font-size: 11px;
    font-weight: 700;
    color: #111;
    font-family: 'IBM Plex Mono', 'Courier New', monospace;
    letter-spacing: 0.5px;
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
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100% !important;
      background: white !important;
      z-index: 999999 !important;
    }

    .print-container {
      padding: 0 !important;
      margin: 0 auto !important;
      box-sizing: border-box !important;
    }

    .print-page {
      padding: 8mm !important;
      box-sizing: border-box !important;
    }

    .cards-grid {
      gap: 6mm !important;
      grid-template-columns: repeat(3, 52mm) !important;
      grid-template-rows: repeat(4, 65mm) !important;
      justify-content: center !important;
      align-content: start !important;
    }

    .voucher-card {
      border: 1pt solid #000 !important;
      visibility: visible !important;
      width: 52mm !important;
      height: 65mm !important;
      box-sizing: border-box !important;
    }

    .card-header {
      background: #0891b2 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    .card-footer {
      background: #1a1a1a !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    .qr-section {
      background: white !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    .qr-image {
      visibility: visible !important;
      width: 32mm !important;
      height: 32mm !important;
    }
  }
</style>
