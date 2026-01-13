<script lang="ts">
  import { onMount } from 'svelte';
  import QRCode from 'qrcode';

  let { data } = $props();

  let qrCodes = $state<Record<string, string>>({});

  onMount(async () => {
    for (const voucher of data.vouchers) {
      const loginUrl = `http://10.10.10.1/login?dst=http://google.com&username=${voucher.id}&password=${voucher.password}`;
      qrCodes[voucher.id] = await QRCode.toDataURL(loginUrl, {
        width: 100,
        margin: 1
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
      body { margin: 0; padding: 0; }
      .no-print { display: none !important; }
      .print-page { page-break-after: always; }
    }
  </style>
</svelte:head>

<div class="no-print p-4 bg-gray-100 flex justify-between items-center">
  <span>عدد الكروت: {data.vouchers.length}</span>
  <button
    onclick={print}
    class="bg-primary text-white px-4 py-2 rounded-lg"
  >
    طباعة
  </button>
</div>

<div dir="rtl" class="p-4">
  <!-- 12 cards per page: 3 columns × 4 rows -->
  {#each Array(Math.ceil(data.vouchers.length / 12)) as _, pageIndex}
    <div class="print-page grid grid-cols-3 gap-4">
      {#each data.vouchers.slice(pageIndex * 12, (pageIndex + 1) * 12) as voucher}
        <div class="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
          <!-- Header -->
          <div class="text-lg font-bold text-primary mb-1">
            {data.businessName}
          </div>

          <!-- Package Info -->
          <div class="text-2xl font-bold">{voucher.pkg?.nameAr}</div>
          <div class="text-xl text-gray-600">{voucher.priceLE} ج.م</div>

          <!-- QR Code -->
          <div class="my-4 flex justify-center">
            {#if qrCodes[voucher.id]}
              <img src={qrCodes[voucher.id]} alt="QR" class="w-24 h-24" />
            {:else}
              <div class="w-24 h-24 bg-gray-200 animate-pulse"></div>
            {/if}
          </div>

          <!-- Credentials -->
          <div class="text-sm space-y-1">
            <div>
              <span class="text-gray-500">المستخدم:</span>
              <span class="font-mono font-bold">{voucher.id}</span>
            </div>
            <div>
              <span class="text-gray-500">كلمة المرور:</span>
              <span class="font-mono font-bold">{voucher.password}</span>
            </div>
          </div>

          <!-- Instructions -->
          <div class="mt-3 text-xs text-gray-500">
            اتصل بالشبكة ← امسح الكود
          </div>
        </div>
      {/each}
    </div>
  {/each}
</div>
