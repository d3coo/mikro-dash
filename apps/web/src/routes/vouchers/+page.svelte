<script lang="ts">
  import { enhance } from '$app/forms';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { Button } from '$lib/components/ui/button';
  import ConfirmModal from '$lib/components/confirm-modal.svelte';
  import Modal from '$lib/components/modal.svelte';
  import { Plus, Trash2, Printer, Package, Filter, CheckCircle, XCircle, Clock, Loader2, CloudOff, ChevronRight, ChevronLeft, QrCode, X, Copy, Check, Timer, FileCheck } from 'lucide-svelte';
  import { toast } from 'svelte-sonner';
  import QRCode from 'qrcode';
  
  let { data, form } = $props();

  // Show toast notifications for form results
  $effect(() => {
    if (form?.success) {
      if (form.created) {
        toast.success(`تم إنشاء ${form.created} كرت بنجاح`);
      }
      if (form.deleted !== undefined && !form.message) {
        toast.success(`تم حذف ${form.deleted} كرت بنجاح`);
      }
      if (form.message) {
        toast.success(form.message);
      }
    }
    if (form?.error) {
      toast.error(form.error);
    }
  });

  let selectedPackage = $state('');
  let quantity = $state(10);
  let selectedIds = $state<string[]>([]);
  let isGenerating = $state(false);
  let isDeleting = $state(false);
  let isCleaning = $state(false);
  let showDeleteModal = $state(false);
  let showCleanupModal = $state(false);
  let deleteFormEl = $state<HTMLFormElement>(undefined!);
  let cleanupFormEl = $state<HTMLFormElement>(undefined!);

  // QR Code Modal State
  let showQrModal = $state(false);
  let selectedVoucher = $state<typeof data.vouchers[0] | null>(null);
  let qrCodeDataUrl = $state('');
  let codeCopied = $state(false);

  // Extend Time State
  let showExtendOptions = $state(false);
  let isExtending = $state(false);
  let selectedDuration = $state('3d');

  const durationOptions = [
    { value: '1d', label: 'يوم واحد (24 ساعة)' },
    { value: '2d', label: 'يومين (48 ساعة)' },
    { value: '3d', label: '3 أيام (72 ساعة)' },
    { value: '4d', label: '4 أيام (96 ساعة)' },
    { value: '5d', label: '5 أيام (120 ساعة)' },
    { value: '7d', label: 'أسبوع (168 ساعة)' },
  ];

  async function extendVoucherTime() {
    if (!selectedVoucher || isExtending) return;

    isExtending = true;
    try {
      const response = await fetch(`/api/vouchers/${selectedVoucher.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limitUptime: selectedDuration })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'فشل في تمديد الوقت');
      }

      const durationLabel = durationOptions.find(d => d.value === selectedDuration)?.label || selectedDuration;
      toast.success(`تم تمديد الوقت إلى ${durationLabel}`);
      showExtendOptions = false;

      // Refresh the page to get updated data
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'فشل في تمديد الوقت');
    } finally {
      isExtending = false;
    }
  }

  function generateWifiQRString(ssid: string): string {
    // WiFi QR code format for open networks
    return `WIFI:T:nopass;S:${ssid};H:false;;`;
  }

  async function openQrModal(voucher: typeof data.vouchers[0]) {
    selectedVoucher = voucher;
    showQrModal = true;
    codeCopied = false;

    // Generate WiFi connection QR code
    try {
      const wifiString = generateWifiQRString(data.wifiSSID || 'AboYassen');
      qrCodeDataUrl = await QRCode.toDataURL(wifiString, {
        width: 280,
        margin: 2,
        color: {
          dark: '#0891b2',
          light: '#ffffff'
        },
        errorCorrectionLevel: 'M'
      });
    } catch (err) {
      console.error('Failed to generate QR code:', err);
      toast.error('فشل في إنشاء كود QR');
    }
  }

  function closeQrModal() {
    showQrModal = false;
    selectedVoucher = null;
    qrCodeDataUrl = '';
    showExtendOptions = false;
  }

  async function copyCode() {
    if (!selectedVoucher) return;
    try {
      await navigator.clipboard.writeText(selectedVoucher.name);
      codeCopied = true;
      toast.success('تم نسخ الكود');
      setTimeout(() => codeCopied = false, 2000);
    } catch {
      toast.error('فشل في النسخ');
    }
  }

  function goToPage(pageNum: number) {
    const url = new URL($page.url);
    url.searchParams.set('page', pageNum.toString());
    goto(url.toString());
  }

  function setStatusFilter(status: string) {
    const url = new URL($page.url);
    url.searchParams.set('status', status);
    url.searchParams.set('page', '1'); // Reset to first page when filtering
    goto(url.toString());
  }

  function setPackageFilter(packageId: string) {
    const url = new URL($page.url);
    if (packageId) {
      url.searchParams.set('package', packageId);
    } else {
      url.searchParams.delete('package');
    }
    url.searchParams.set('page', '1');
    goto(url.toString());
  }

  function setProfileFilter(profile: string) {
    const url = new URL($page.url);
    if (profile) {
      url.searchParams.set('profile', profile);
    } else {
      url.searchParams.delete('profile');
    }
    url.searchParams.set('page', '1');
    goto(url.toString());
  }

  function setPrintFilter(printStatus: string) {
    const url = new URL($page.url);
    if (printStatus && printStatus !== 'all') {
      url.searchParams.set('print', printStatus);
    } else {
      url.searchParams.delete('print');
    }
    url.searchParams.set('page', '1');
    goto(url.toString());
  }

  function clearFilters() {
    const url = new URL($page.url);
    url.searchParams.delete('package');
    url.searchParams.delete('profile');
    url.searchParams.delete('print');
    url.searchParams.set('status', 'all');
    url.searchParams.set('page', '1');
    goto(url.toString());
  }

  // Check if any filters are active
  let hasActiveFilters = $derived(
    data.packageFilter !== '' || data.profileFilter !== '' || data.currentFilter !== 'all' || data.printFilter !== 'all'
  );

  function toggleSelect(id: string) {
    if (selectedIds.includes(id)) {
      selectedIds = selectedIds.filter(i => i !== id);
    } else {
      selectedIds = [...selectedIds, id];
    }
  }

  function selectAll() {
    if (selectedIds.length === data.vouchers.length) {
      selectedIds = [];
    } else {
      selectedIds = data.vouchers.map(v => v.id);
    }
  }

  function formatDate(iso: string): string {
    const date = new Date(iso);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${day}-${month}-${year} ${hours}:${minutes}`;
  }

  const statusConfig: Record<string, { label: string; class: string; icon: typeof CheckCircle }> = {
    available: { label: 'متاح', class: 'badge-success', icon: CheckCircle },
    used: { label: 'مستخدم', class: 'badge-warning', icon: Clock },
    exhausted: { label: 'منتهي', class: 'badge-danger', icon: XCircle }
  };

  // Format bytes to human readable
  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
</script>

<div class="vouchers-page">
  <!-- Page Header -->
  <header class="page-header opacity-0 animate-fade-in">
    <div class="flex items-center justify-between flex-wrap gap-4">
      <div>
        <h1 class="page-title">الكروت</h1>
        <p class="page-subtitle">إنشاء وإدارة كروت الواي فاي</p>
      </div>
      <div class="header-actions">
        <!-- Print Selected -->
        <a href="/vouchers/print?ids={selectedIds.join(',')}" class="print-link">
          <Button variant="outline" disabled={selectedIds.length === 0}>
            <Printer class="w-4 h-4" />
            <span>طباعة ({selectedIds.length})</span>
          </Button>
        </a>

        <!-- Print Unprinted -->
        {#if data.unprintedAvailableCount > 0}
          <a href="/vouchers/print?status=available&unprinted=true" class="print-link">
            <Button variant="default">
              <Printer class="w-4 h-4" />
              <span>طباعة غير المطبوع</span>
            </Button>
          </a>
        {/if}
      </div>
    </div>
  </header>

  <!-- Data Source Status -->
  {#if data.dataSource === 'cache'}
    <div class="alert alert-warning opacity-0 animate-fade-in" style="animation-delay: 100ms">
      <CloudOff class="w-5 h-5" />
      <span>
        وضع عدم الاتصال - البيانات من الذاكرة المؤقتة
        {#if data.lastSyncedAt}
          (آخر تحديث: {new Date(data.lastSyncedAt).toLocaleTimeString('ar-EG')})
        {/if}
        {#if data.isStaleData}
          <strong class="text-danger-light">- البيانات قديمة</strong>
        {/if}
      </span>
    </div>
  {:else if !data.routerConnected}
    <div class="alert alert-danger opacity-0 animate-fade-in" style="animation-delay: 100ms">
      <CloudOff class="w-5 h-5" />
      <span>غير متصل بالراوتر - تعذر تحميل الكروت</span>
    </div>
  {/if}

  <!-- Generate Form -->
  <section class="generate-section glass-card opacity-0 animate-fade-in" style="animation-delay: 150ms">
    <div class="section-header">
      <Package class="w-5 h-5 text-primary-light" />
      <h2>إنشاء كروت جديدة</h2>
    </div>
    <form
      method="POST"
      action="?/generate"
      use:enhance={() => {
        isGenerating = true;
        return async ({ update }) => {
          await update();
          isGenerating = false;
        };
      }}
      class="generate-form"
    >
      <div class="form-group flex-1">
        <label for="packageId">الباقة</label>
        <select
          id="packageId"
          name="packageId"
          bind:value={selectedPackage}
          class="select-modern w-full"
          required
          disabled={isGenerating}
        >
          <option value="">اختر الباقة...</option>
          {#each data.packages as pkg}
            <option value={pkg.id}>{pkg.nameAr} - {pkg.priceLE} ج.م</option>
          {/each}
        </select>
      </div>

      <div class="form-group w-32">
        <label for="quantity">الكمية</label>
        <input
          id="quantity"
          type="number"
          name="quantity"
          bind:value={quantity}
          min="1"
          max="100"
          class="input-modern w-full"
          required
          disabled={isGenerating}
        />
      </div>

      <Button type="submit" class="self-end" disabled={isGenerating}>
        {#if isGenerating}
          <Loader2 class="w-4 h-4 animate-spin" />
          <span>جاري الإنشاء...</span>
        {:else}
          <Plus class="w-4 h-4" />
          <span>إنشاء</span>
        {/if}
      </Button>
    </form>
  </section>

  <!-- Vouchers List -->
  <section class="vouchers-list glass-card opacity-0 animate-fade-in" style="animation-delay: 200ms">
    <div class="list-header">
      <div class="list-title">
        <h2>قائمة الكروت</h2>
        <span class="badge-count">{data.totalVouchers}</span>
      </div>
      <div class="list-actions">
        <div class="filter-group">
          <Filter class="w-4 h-4 text-text-muted" />
          <select value={data.currentFilter} onchange={(e) => setStatusFilter(e.currentTarget.value)} class="select-modern text-sm">
            <option value="all">الكل ({data.statusCounts.all})</option>
            <option value="available">متاح ({data.statusCounts.available})</option>
            <option value="used">مستخدم ({data.statusCounts.used})</option>
            <option value="exhausted">منتهي ({data.statusCounts.exhausted})</option>
          </select>
        </div>

        <div class="filter-group">
          <select value={data.packageFilter} onchange={(e) => setPackageFilter(e.currentTarget.value)} class="select-modern text-sm">
            <option value="">كل الباقات</option>
            {#each data.packages as pkg}
              <option value={pkg.id}>{pkg.nameAr}</option>
            {/each}
          </select>
        </div>

        <div class="filter-group">
          <select value={data.profileFilter} onchange={(e) => setProfileFilter(e.currentTarget.value)} class="select-modern text-sm">
            <option value="">كل البروفايلات</option>
            {#each data.profiles as profile}
              <option value={profile}>{profile}</option>
            {/each}
          </select>
        </div>

        <div class="filter-group">
          <FileCheck class="w-4 h-4 text-text-muted" />
          <select value={data.printFilter} onchange={(e) => setPrintFilter(e.currentTarget.value)} class="select-modern text-sm">
            <option value="all">كل الطباعة</option>
            <option value="printed">مطبوع ({data.printCounts.printed})</option>
            <option value="unprinted">غير مطبوع ({data.printCounts.unprinted})</option>
          </select>
        </div>

        {#if hasActiveFilters}
          <Button variant="ghost" size="sm" onclick={clearFilters} class="btn-danger-ghost">
            <X class="w-4 h-4" />
            <span>مسح الفلاتر</span>
          </Button>
        {/if}

        <!-- Cleanup Exhausted Vouchers -->
        {#if data.statusCounts.exhausted > 0}
          <form
            bind:this={cleanupFormEl}
            method="POST"
            action="?/cleanup"
            use:enhance={() => {
              isCleaning = true;
              return async ({ update }) => {
                await update();
                isCleaning = false;
                showCleanupModal = false;
              };
            }}
          >
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isCleaning}
              onclick={() => showCleanupModal = true}
              class="btn-cleanup"
            >
              {#if isCleaning}
                <Loader2 class="w-4 h-4 animate-spin" />
                <span>جاري التنظيف...</span>
              {:else}
                <Trash2 class="w-4 h-4" />
                <span>حذف المنتهي ({data.statusCounts.exhausted})</span>
              {/if}
            </Button>
          </form>
        {/if}

        {#if selectedIds.length > 0}
          <form
            bind:this={deleteFormEl}
            method="POST"
            action="?/delete"
            use:enhance={() => {
              isDeleting = true;
              return async ({ update }) => {
                await update();
                isDeleting = false;
                selectedIds = [];
              };
            }}
          >
            {#each selectedIds as id}
              <input type="hidden" name="ids" value={id} />
            {/each}
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={isDeleting}
              onclick={() => showDeleteModal = true}
            >
              {#if isDeleting}
                <Loader2 class="w-4 h-4 animate-spin" />
                <span>جاري الحذف...</span>
              {:else}
                <Trash2 class="w-4 h-4" />
                <span>حذف ({selectedIds.length})</span>
              {/if}
            </Button>
          </form>
        {/if}
      </div>
    </div>

    <div class="table-container">
      <table class="table-modern">
        <thead>
          <tr>
            <th class="w-12">
              <input
                type="checkbox"
                checked={selectedIds.length === data.vouchers.length && data.vouchers.length > 0}
                onchange={selectAll}
                class="checkbox-modern"
              />
            </th>
            <th>الكود</th>
            <th>كلمة المرور</th>
            <th>الباقة</th>
            <th>الاستهلاك</th>
            <th>الحالة</th>
          </tr>
        </thead>
        <tbody>
          {#each data.vouchers as voucher, index}
            {@const config = statusConfig[voucher.status] || statusConfig.available}
            <tr class="opacity-0 animate-fade-in voucher-row" style="animation-delay: {250 + index * 30}ms">
              <td onclick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(voucher.id)}
                  onchange={() => toggleSelect(voucher.id)}
                  class="checkbox-modern"
                />
              </td>
              <td onclick={() => openQrModal(voucher)} class="clickable-cell">
                <div class="code-cell">
                  <QrCode class="w-4 h-4 qr-hint-icon" />
                  <span class="font-mono text-primary-light">{voucher.name}</span>
                </div>
              </td>
              <td>
                <span class="font-mono">{voucher.password || '••••••'}</span>
              </td>
              <td>{voucher.profile}</td>
              <td>
                <div class="cell-usage">
                  <div class="cell-usage-bar">
                    <div
                      class="cell-usage-fill"
                      style="width: {voucher.bytesLimit > 0 ? Math.min((voucher.bytesTotal / voucher.bytesLimit) * 100, 100) : 0}%"
                    ></div>
                  </div>
                  <span class="cell-usage-text">
                    {formatBytes(voucher.bytesTotal)} / {voucher.bytesLimit > 0 ? formatBytes(voucher.bytesLimit) : '∞'}
                  </span>
                </div>
              </td>
              <td>
                <div class="status-cell">
                  <span class="badge {config.class}">
                    <config.icon class="w-3 h-3" />
                    {config.label}
                  </span>
                  {#if voucher.isPrinted}
                    <span class="badge badge-printed" title="تم الطباعة">
                      <FileCheck class="w-3 h-3" />
                    </span>
                  {/if}
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>

      {#if data.vouchers.length === 0}
        <div class="empty-state">
          <Package class="empty-state-icon" />
          <p class="empty-state-text">لا توجد كروت</p>
        </div>
      {/if}
    </div>

    <!-- Pagination -->
    {#if data.pagination.totalPages > 1}
      <div class="pagination">
        <Button
          variant="outline"
          size="sm"
          disabled={!data.pagination.hasPrev}
          onclick={() => goToPage(data.pagination.currentPage - 1)}
        >
          <ChevronRight class="w-4 h-4" />
          السابق
        </Button>

        <div class="pagination-pages">
          {#each Array.from({ length: data.pagination.totalPages }, (_, i) => i + 1) as pageNum}
            <button
              class="pagination-page"
              class:active={pageNum === data.pagination.currentPage}
              onclick={() => goToPage(pageNum)}
            >
              {pageNum}
            </button>
          {/each}
        </div>

        <Button
          variant="outline"
          size="sm"
          disabled={!data.pagination.hasNext}
          onclick={() => goToPage(data.pagination.currentPage + 1)}
        >
          التالي
          <ChevronLeft class="w-4 h-4" />
        </Button>
      </div>
    {/if}
  </section>
</div>

<ConfirmModal
  bind:open={showDeleteModal}
  title="تأكيد الحذف"
  message="هل أنت متأكد من حذف {selectedIds.length} كرت؟ لا يمكن التراجع عن هذا الإجراء."
  confirmText="حذف"
  cancelText="إلغاء"
  variant="destructive"
  onConfirm={() => deleteFormEl.requestSubmit()}
/>

<ConfirmModal
  bind:open={showCleanupModal}
  title="تنظيف الكروت المنتهية"
  message="هل أنت متأكد من حذف جميع الكروت المنتهية ({data.statusCounts.exhausted} كرت)؟ لا يمكن التراجع عن هذا الإجراء."
  confirmText="حذف المنتهي"
  cancelText="إلغاء"
  variant="destructive"
  onConfirm={() => cleanupFormEl.requestSubmit()}
/>

<!-- QR Code Modal -->
<Modal bind:open={showQrModal} onClose={closeQrModal}>
  {#snippet header()}
    <div class="modal-header">
      <h3>
        <QrCode class="w-5 h-5 text-primary-light" />
        كود الكرت
      </h3>
      <button class="modal-close-btn" onclick={closeQrModal}>
        <X class="w-5 h-5" />
      </button>
    </div>
  {/snippet}

  {#if selectedVoucher}
    <div class="qr-modal-body">
      <!-- WiFi QR Code -->
      {#if qrCodeDataUrl}
        <div class="qr-code-container">
          <img src={qrCodeDataUrl} alt="WiFi QR Code" class="qr-code-image" />
        </div>
      {:else}
        <div class="qr-loading">
          <Loader2 class="w-8 h-8 animate-spin text-primary-light" />
        </div>
      {/if}

      <p class="qr-hint-wifi">
        امسح للاتصال بشبكة <strong>{data.wifiSSID || 'AboYassen'}</strong>
      </p>

      <!-- Single Code Display -->
      <div class="code-display-section">
        <span class="code-label">كود الدخول</span>
        <div class="code-box">
          <span class="code-value">{selectedVoucher.name}</span>
        </div>
        <button class="copy-code-btn" onclick={copyCode}>
          {#if codeCopied}
            <Check class="w-4 h-4" />
            <span>تم النسخ</span>
          {:else}
            <Copy class="w-4 h-4" />
            <span>نسخ الكود</span>
          {/if}
        </button>
      </div>

      <!-- Package Info -->
      <div class="voucher-info-section">
        <div class="voucher-info-row">
          <span class="info-label">الباقة:</span>
          <span class="info-value">{selectedVoucher.packageName || selectedVoucher.profile}</span>
        </div>
        {#if selectedVoucher.bytesLimit > 0}
          <div class="voucher-info-row">
            <span class="info-label">الحد:</span>
            <span class="info-value">{formatBytes(selectedVoucher.bytesLimit)}</span>
          </div>
        {/if}
        {#if selectedVoucher.uptime && selectedVoucher.uptime !== '0s'}
          <div class="voucher-info-row">
            <span class="info-label">وقت الاستخدام:</span>
            <span class="info-value">{selectedVoucher.uptime}</span>
          </div>
        {/if}
      </div>

      <!-- Extend Time Section (for used vouchers) -->
      {#if selectedVoucher.status === 'used' || selectedVoucher.status === 'available'}
        <div class="extend-time-section">
          {#if !showExtendOptions}
            <button class="extend-time-btn" onclick={() => showExtendOptions = true}>
              <Timer class="w-4 h-4" />
              <span>تمديد الوقت</span>
            </button>
          {:else}
            <div class="extend-time-form">
              <label for="duration-select" class="extend-label">اختر المدة الجديدة:</label>
              <select
                id="duration-select"
                bind:value={selectedDuration}
                class="select-modern w-full"
                disabled={isExtending}
              >
                {#each durationOptions as option}
                  <option value={option.value}>{option.label}</option>
                {/each}
              </select>
              <div class="extend-actions">
                <Button
                  variant="outline"
                  size="sm"
                  onclick={() => showExtendOptions = false}
                  disabled={isExtending}
                >
                  إلغاء
                </Button>
                <Button
                  size="sm"
                  onclick={extendVoucherTime}
                  disabled={isExtending}
                >
                  {#if isExtending}
                    <Loader2 class="w-4 h-4 animate-spin" />
                    <span>جاري التمديد...</span>
                  {:else}
                    <Timer class="w-4 h-4" />
                    <span>تأكيد التمديد</span>
                  {/if}
                </Button>
              </div>
            </div>
          {/if}
        </div>
      {/if}

      <p class="qr-hint-footer">
        ١. امسح الكود للاتصال بالواي فاي<br>
        ٢. أدخل كود الدخول في صفحة تسجيل الدخول
      </p>
    </div>
  {/if}
</Modal>

<style>
  .vouchers-page {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .header-actions {
    display: flex;
    gap: 12px;
    align-items: center;
    flex-wrap: wrap;
  }

  .print-link {
    text-decoration: none;
  }

  /* Generate Section */
  .generate-section {
    padding: 24px;
  }

  .generate-form {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    align-items: flex-end;
  }

  /* Vouchers List */
  .vouchers-list {
    padding: 0;
    overflow: hidden;
  }

  .table-container {
    overflow-x: auto;
  }

  .table-modern {
    min-width: 600px;
  }

  /* Clickable voucher cell */
  .clickable-cell {
    cursor: pointer;
  }

  .code-cell {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .qr-hint-icon {
    color: var(--color-text-muted);
    opacity: 0;
    transition: opacity var(--animation-duration-normal) ease;
  }

  .voucher-row:hover .qr-hint-icon {
    opacity: 1;
  }


  /* QR Modal Body */
  .qr-modal-body {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }

  .qr-code-container {
    background: white;
    border-radius: 16px;
    padding: 16px;
    box-shadow: 0 4px 20px rgba(8, 145, 178, 0.15);
  }

  .qr-code-image {
    display: block;
    width: 200px;
    height: 200px;
  }

  .qr-loading {
    width: 200px;
    height: 200px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-bg-elevated);
    border-radius: 16px;
  }

  .qr-hint-wifi {
    font-size: 14px;
    color: var(--color-text-secondary);
    text-align: center;
  }

  .qr-hint-wifi strong {
    color: var(--color-primary-light);
  }

  /* Code Display Section */
  .code-display-section {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 20px;
    background: var(--color-bg-elevated);
    border-radius: 16px;
  }

  .code-display-section .code-label {
    font-size: 12px;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .code-box {
    background: rgba(8, 145, 178, 0.1);
    border: 2px solid var(--color-primary);
    border-radius: 12px;
    padding: 12px 24px;
  }

  .code-box .code-value {
    font-family: var(--font-family-mono);
    font-size: 28px;
    font-weight: 700;
    color: var(--color-primary-light);
    letter-spacing: 4px;
  }

  .copy-code-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px 20px;
    border-radius: 8px;
    background: rgba(8, 145, 178, 0.15);
    border: 1px solid rgba(8, 145, 178, 0.3);
    color: var(--color-primary-light);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--animation-duration-normal) ease;
  }

  .copy-code-btn:hover {
    background: rgba(8, 145, 178, 0.25);
    border-color: var(--color-primary);
  }

  /* Voucher Info Section */
  .voucher-info-section {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .voucher-info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 8px;
  }

  .info-label {
    font-size: 14px;
    color: var(--color-text-muted);
  }

  .info-value {
    font-size: 14px;
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .qr-hint-footer {
    font-size: 12px;
    color: var(--color-text-muted);
    text-align: center;
    line-height: 1.8;
    padding: 12px;
    background: rgba(8, 145, 178, 0.05);
    border-radius: 8px;
    width: 100%;
  }

  .filter-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  @media (max-width: 768px) {
    .list-actions {
      flex-direction: column;
      align-items: stretch;
    }

    .filter-group {
      width: 100%;
    }

    .filter-group .select-modern {
      flex: 1;
    }
  }

  /* Cleanup button styling */
  :global(.btn-cleanup) {
    border-color: rgba(239, 68, 68, 0.4) !important;
    color: #f87171 !important;
  }

  :global(.btn-cleanup:hover) {
    background: rgba(239, 68, 68, 0.1) !important;
    border-color: rgba(239, 68, 68, 0.6) !important;
  }

  /* Extend Time Section */
  .extend-time-section {
    width: 100%;
    margin-top: 8px;
  }

  .extend-time-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 12px 20px;
    border-radius: 10px;
    background: rgba(34, 197, 94, 0.1);
    border: 1px solid rgba(34, 197, 94, 0.3);
    color: #4ade80;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--animation-duration-normal) ease;
  }

  .extend-time-btn:hover {
    background: rgba(34, 197, 94, 0.2);
    border-color: rgba(34, 197, 94, 0.5);
  }

  .extend-time-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    background: var(--color-bg-elevated);
    border-radius: 12px;
    border: 1px solid rgba(34, 197, 94, 0.2);
  }

  .extend-label {
    font-size: 14px;
    color: var(--color-text-secondary);
    font-weight: 500;
  }

  .extend-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  /* Status Cell */
  .status-cell {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  /* Printed Badge */
  .badge-printed {
    background: rgba(34, 197, 94, 0.15);
    color: #4ade80;
    border: 1px solid rgba(34, 197, 94, 0.3);
    padding: 2px 6px;
    border-radius: 4px;
    display: inline-flex;
    align-items: center;
  }
</style>
