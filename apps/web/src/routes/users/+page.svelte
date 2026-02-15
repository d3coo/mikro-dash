<script lang="ts">
  import { enhance } from '$app/forms';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { Button } from '$lib/components/ui/button';
  import ConfirmModal from '$lib/components/confirm-modal.svelte';
  import Modal from '$lib/components/modal.svelte';
  import {
    Users,
    Clock,
    Monitor,
    Signal,
    WifiOff,
    LogOut,
    Loader2,
    ChevronRight,
    ChevronLeft,
    RefreshCw,
    Ticket,
    Wifi,
    Ban,
    Smartphone,
    Database,
    QrCode,
    X,
    Copy,
    Check
  } from 'lucide-svelte';
  import { toast } from 'svelte-sonner';
  import QRCode from 'qrcode';

  let { data, form } = $props();

  // Show toast notifications for form results
  $effect(() => {
    if (form?.success) {
      if (form.kicked) toast.success('تم قطع اتصال المستخدم بنجاح');
      if (form.blocked) toast.success('تم حظر الجهاز بنجاح');
    }
    if (form?.error) {
      toast.error(form.error);
    }
  });

  // Loading states
  let isKickingVoucher = $state<string | null>(null);
  let isKickingWifi = $state<string | null>(null);
  let isBlocking = $state<string | null>(null);

  // Modal states
  let showKickVoucherModal = $state(false);
  let showKickWifiModal = $state(false);
  let showBlockModal = $state(false);

  // Selected items for actions
  let selectedVoucherUser = $state<{ sessionId: string; voucherCode: string } | null>(null);
  let selectedWifiClient = $state<{ id: string; deviceName?: string; macAddress: string } | null>(null);

  // Form refs
  let kickVoucherFormEl: HTMLFormElement;
  let kickWifiFormEl: HTMLFormElement;
  let blockFormEl: HTMLFormElement;

  // QR Code Modal State
  let showQrModal = $state(false);
  let qrVoucher = $state<typeof data.voucherUsers[0] | null>(null);
  let qrCodeDataUrl = $state('');
  let codeCopied = $state(false);

  function generateWifiQRString(ssid: string): string {
    // WiFi QR code format for open networks
    return `WIFI:T:nopass;S:${ssid};H:false;;`;
  }

  async function openQrModal(user: typeof data.voucherUsers[0]) {
    qrVoucher = user;
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
    qrVoucher = null;
    qrCodeDataUrl = '';
  }

  async function copyCode() {
    if (!qrVoucher) return;
    try {
      await navigator.clipboard.writeText(qrVoucher.voucherCode);
      codeCopied = true;
      toast.success('تم نسخ الكود');
      setTimeout(() => codeCopied = false, 2000);
    } catch {
      toast.error('فشل في النسخ');
    }
  }

  // Format bytes to human readable
  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // Format uptime string
  function formatUptime(uptime: string): string {
    if (!uptime || uptime === '0s') return '-';

    const days = uptime.match(/(\d+)d/);
    const hours = uptime.match(/(\d+)h/);
    const minutes = uptime.match(/(\d+)m/);
    const seconds = uptime.match(/(\d+)s/);

    const parts = [];
    if (days) parts.push(`${days[1]}ي`);
    if (hours) parts.push(`${hours[1]}س`);
    if (minutes) parts.push(`${minutes[1]}د`);
    if (!days && !hours && !minutes && seconds) parts.push(`${seconds[1]}ث`);

    return parts.join(' ') || '-';
  }

  // Format signal strength
  function formatSignal(signal: string): { label: string; color: string } {
    const match = signal.match(/^(-?\d+)/);
    const dbm = match ? parseInt(match[1], 10) : -100;

    if (dbm >= -50) return { label: 'ممتاز', color: 'text-success' };
    if (dbm >= -60) return { label: 'جيد جداً', color: 'text-success' };
    if (dbm >= -70) return { label: 'جيد', color: 'text-warning' };
    if (dbm >= -80) return { label: 'ضعيف', color: 'text-danger' };
    return { label: 'ضعيف جداً', color: 'text-danger' };
  }

  // Calculate usage percentage
  function getUsagePercent(used: number, limit: number): number {
    if (limit === 0) return 0;
    return Math.min(100, Math.round((used / limit) * 100));
  }

  // Pagination navigation
  function goToVoucherPage(pageNum: number) {
    const url = new URL($page.url);
    url.searchParams.set('vp', pageNum.toString());
    goto(url.toString());
  }

  function goToWifiPage(pageNum: number) {
    const url = new URL($page.url);
    url.searchParams.set('wp', pageNum.toString());
    goto(url.toString());
  }

  // Action confirmations
  function confirmKickVoucher(user: { sessionId: string; voucherCode: string }) {
    selectedVoucherUser = user;
    showKickVoucherModal = true;
  }

  function confirmKickWifi(client: { id: string; deviceName?: string; macAddress: string }) {
    selectedWifiClient = client;
    showKickWifiModal = true;
  }

  function confirmBlock(client: { id: string; deviceName?: string; macAddress: string }) {
    selectedWifiClient = client;
    showBlockModal = true;
  }

  function refresh() {
    goto($page.url.toString(), { invalidateAll: true });
  }
</script>

<div class="users-page">
  <!-- Page Header -->
  <header class="page-header opacity-0 animate-fade-in">
    <div class="flex items-center justify-between flex-wrap gap-4">
      <div>
        <h1 class="page-title">المستخدمين</h1>
        <p class="page-subtitle">إدارة جميع المتصلين بالشبكة</p>
      </div>
      <div class="header-actions">
        <span class="badge {data.routerConnected ? 'badge-success' : 'badge-danger'}">
          {#if data.routerConnected}
            <Signal class="w-3 h-3" />
            متصل بالراوتر
          {:else}
            <WifiOff class="w-3 h-3" />
            غير متصل
          {/if}
        </span>
        <Button variant="outline" size="sm" onclick={refresh}>
          <RefreshCw class="w-4 h-4" />
          تحديث
        </Button>
      </div>
    </div>
  </header>

  <!-- Stats Cards -->
  <div class="stats-row opacity-0 animate-fade-in" style="animation-delay: 100ms">
    <div class="mini-stat glass-card">
      <Ticket class="w-5 h-5 text-primary-light" />
      <div class="mini-stat-content">
        <span class="mini-stat-value">{data.totalVoucherUsers}</span>
        <span class="mini-stat-label">مستخدمي الكوبونات</span>
      </div>
    </div>
    <div class="mini-stat glass-card">
      <Wifi class="w-5 h-5 text-warning" />
      <div class="mini-stat-content">
        <span class="mini-stat-value">{data.totalWiFiOnlyClients}</span>
        <span class="mini-stat-label">متصلين بدون كوبون</span>
      </div>
    </div>
    <div class="mini-stat glass-card">
      <Users class="w-5 h-5 text-success" />
      <div class="mini-stat-content">
        <span class="mini-stat-value">{data.totalVoucherUsers + data.totalWiFiOnlyClients}</span>
        <span class="mini-stat-label">إجمالي المتصلين</span>
      </div>
    </div>
  </div>

  <!-- Section 1: Voucher Users -->
  <section class="voucher-section glass-card opacity-0 animate-fade-in" style="animation-delay: 150ms">
    <div class="list-header">
      <div class="list-title">
        <Ticket class="w-5 h-5 text-primary-light" />
        <h2>مستخدمي الكوبونات</h2>
        <span class="badge-count">{data.totalVoucherUsers}</span>
      </div>
    </div>

    <div class="table-container">
      {#if data.voucherUsers.length > 0}
        <table class="table-modern">
          <thead>
            <tr>
              <th>الكوبون</th>
              <th>الباقة</th>
              <th>الجهاز</th>
              <th>IP</th>
              <th>الاستهلاك</th>
              <th>وقت الاتصال</th>
              <th>الوقت المتبقي</th>
              <th>الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {#each data.voucherUsers as user, index}
              {@const usagePercent = getUsagePercent(user.bytesUsed, user.bytesLimit)}
              <tr class="opacity-0 animate-fade-in" style="animation-delay: {200 + index * 30}ms">
                <td>
                  <button class="voucher-cell" onclick={() => openQrModal(user)}>
                    <div class="cell-user-avatar">
                      <Ticket class="w-4 h-4" />
                    </div>
                    <span class="font-mono text-primary-light font-semibold">{user.voucherCode}</span>
                    <QrCode class="w-4 h-4 qr-hint-icon" />
                  </button>
                </td>
                <td>
                  <div class="package-info">
                    <span class="package-name">{user.packageName}</span>
                    {#if user.priceLE > 0}
                      <span class="package-price">{user.priceLE} ج.م</span>
                    {/if}
                  </div>
                </td>
                <td>
                  <div class="cell-device">
                    <Smartphone class="w-4 h-4 text-text-muted" />
                    <div class="cell-device-info">
                      <span class="device-name">{user.deviceName || 'غير معروف'}</span>
                      <span class="device-mac">{user.macAddress}</span>
                    </div>
                  </div>
                </td>
                <td class="font-mono text-secondary">{user.ipAddress}</td>
                <td>
                  <div class="cell-usage">
                    <div class="cell-usage-bar">
                      <div
                        class="cell-usage-fill"
                        class:warning={usagePercent >= 80}
                        class:danger={usagePercent >= 95}
                        style="width: {usagePercent}%"
                      ></div>
                    </div>
                    <span class="cell-usage-text">
                      {formatBytes(user.bytesUsed)}
                      {#if user.bytesLimit > 0}
                        / {formatBytes(user.bytesLimit)}
                      {/if}
                    </span>
                  </div>
                </td>
                <td>
                  <div class="cell-uptime">
                    <Clock class="w-4 h-4 text-primary-light" />
                    <span>{formatUptime(user.uptime)}</span>
                  </div>
                </td>
                <td>
                  <div class="cell-time-remaining" class:warning={user.timeRemaining === 'انتهى'}>
                    <Clock class="w-4 h-4" />
                    <span>{user.timeRemaining}</span>
                  </div>
                </td>
                <td>
                  <Button
                    variant="ghost"
                    size="sm"
                    class="btn-danger-ghost"
                    disabled={isKickingVoucher === user.sessionId}
                    onclick={() => confirmKickVoucher({ sessionId: user.sessionId, voucherCode: user.voucherCode })}
                  >
                    {#if isKickingVoucher === user.sessionId}
                      <Loader2 class="w-4 h-4 animate-spin" />
                    {:else}
                      <LogOut class="w-4 h-4" />
                    {/if}
                    قطع
                  </Button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      {:else}
        <div class="empty-state">
          <Ticket class="empty-state-icon" />
          <p class="empty-state-text">
            {#if data.routerConnected}
              لا يوجد مستخدمين بكوبونات حالياً
            {:else}
              غير متصل بالراوتر - تعذر تحميل المستخدمين
            {/if}
          </p>
        </div>
      {/if}
    </div>

    <!-- Voucher Pagination -->
    {#if data.voucherPagination.totalPages > 1}
      <div class="pagination">
        <Button
          variant="outline"
          size="sm"
          disabled={!data.voucherPagination.hasPrev}
          onclick={() => goToVoucherPage(data.voucherPagination.currentPage - 1)}
        >
          <ChevronRight class="w-4 h-4" />
          السابق
        </Button>

        <div class="pagination-pages">
          {#each Array.from({ length: data.voucherPagination.totalPages }, (_, i) => i + 1) as pageNum}
            <button
              class="pagination-page"
              class:active={pageNum === data.voucherPagination.currentPage}
              onclick={() => goToVoucherPage(pageNum)}
            >
              {pageNum}
            </button>
          {/each}
        </div>

        <Button
          variant="outline"
          size="sm"
          disabled={!data.voucherPagination.hasNext}
          onclick={() => goToVoucherPage(data.voucherPagination.currentPage + 1)}
        >
          التالي
          <ChevronLeft class="w-4 h-4" />
        </Button>
      </div>
    {/if}
  </section>

  <!-- Section 2: WiFi-Only Clients -->
  <section class="wifi-section glass-card opacity-0 animate-fade-in" style="animation-delay: 200ms">
    <div class="list-header">
      <div class="list-title">
        <Wifi class="w-5 h-5 text-warning" />
        <h2>متصلين بدون كوبون</h2>
        <span class="badge-count">{data.totalWiFiOnlyClients}</span>
      </div>
    </div>

    <div class="table-container">
      {#if data.wifiOnlyClients.length > 0}
        <table class="table-modern">
          <thead>
            <tr>
              <th>الجهاز</th>
              <th>MAC</th>
              <th>IP</th>
              <th>الشبكة</th>
              <th>الإشارة</th>
              <th>الاستهلاك</th>
              <th>الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {#each data.wifiOnlyClients as client, index}
              {@const signal = formatSignal(client.signalStrength)}
              <tr class="opacity-0 animate-fade-in" style="animation-delay: {250 + index * 30}ms">
                <td>
                  <div class="cell-device">
                    <div class="cell-device-icon">
                      <Smartphone class="w-4 h-4" />
                    </div>
                    <span class="device-name">{client.deviceName || 'جهاز غير معروف'}</span>
                  </div>
                </td>
                <td class="font-mono text-secondary text-sm">{client.macAddress}</td>
                <td class="font-mono text-secondary">{client.ipAddress || '-'}</td>
                <td>
                  <span class="tag tag-primary">{client.interfaceName}</span>
                </td>
                <td>
                  <span class="{signal.color}">{signal.label}</span>
                </td>
                <td>
                  <span class="text-warning">↓{formatBytes(client.bytesIn)}</span>
                  <span class="text-success ms-2">↑{formatBytes(client.bytesOut)}</span>
                </td>
                <td>
                  <div class="action-buttons">
                    <Button
                      variant="ghost"
                      size="sm"
                      class="btn-danger-ghost"
                      disabled={isKickingWifi === client.id}
                      onclick={() => confirmKickWifi({ id: client.id, deviceName: client.deviceName, macAddress: client.macAddress })}
                    >
                      {#if isKickingWifi === client.id}
                        <Loader2 class="w-4 h-4 animate-spin" />
                      {:else}
                        <LogOut class="w-4 h-4" />
                      {/if}
                      قطع
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      class="btn-block"
                      disabled={isBlocking === client.id}
                      onclick={() => confirmBlock({ id: client.id, deviceName: client.deviceName, macAddress: client.macAddress })}
                    >
                      {#if isBlocking === client.id}
                        <Loader2 class="w-4 h-4 animate-spin" />
                      {:else}
                        <Ban class="w-4 h-4" />
                      {/if}
                      حظر
                    </Button>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      {:else}
        <div class="empty-state">
          <Monitor class="empty-state-icon" />
          <p class="empty-state-text">
            {#if data.routerConnected}
              لا يوجد أجهزة متصلة بدون كوبون
            {:else}
              غير متصل بالراوتر - تعذر تحميل الأجهزة
            {/if}
          </p>
        </div>
      {/if}
    </div>

    <!-- WiFi Pagination -->
    {#if data.wifiPagination.totalPages > 1}
      <div class="pagination">
        <Button
          variant="outline"
          size="sm"
          disabled={!data.wifiPagination.hasPrev}
          onclick={() => goToWifiPage(data.wifiPagination.currentPage - 1)}
        >
          <ChevronRight class="w-4 h-4" />
          السابق
        </Button>

        <div class="pagination-pages">
          {#each Array.from({ length: data.wifiPagination.totalPages }, (_, i) => i + 1) as pageNum}
            <button
              class="pagination-page"
              class:active={pageNum === data.wifiPagination.currentPage}
              onclick={() => goToWifiPage(pageNum)}
            >
              {pageNum}
            </button>
          {/each}
        </div>

        <Button
          variant="outline"
          size="sm"
          disabled={!data.wifiPagination.hasNext}
          onclick={() => goToWifiPage(data.wifiPagination.currentPage + 1)}
        >
          التالي
          <ChevronLeft class="w-4 h-4" />
        </Button>
      </div>
    {/if}
  </section>
</div>

<!-- Hidden forms for actions -->

<!-- Kick Voucher Form -->
<form
  bind:this={kickVoucherFormEl}
  method="POST"
  action="?/kickVoucher"
  use:enhance={() => {
    if (selectedVoucherUser) {
      isKickingVoucher = selectedVoucherUser.sessionId;
    }
    return async ({ update }) => {
      await update();
      isKickingVoucher = null;
      selectedVoucherUser = null;
    };
  }}
  class="hidden"
>
  <input type="hidden" name="sessionId" value={selectedVoucherUser?.sessionId || ''} />
</form>

<!-- Kick WiFi Form -->
<form
  bind:this={kickWifiFormEl}
  method="POST"
  action="?/kickWifi"
  use:enhance={() => {
    if (selectedWifiClient) {
      isKickingWifi = selectedWifiClient.id;
    }
    return async ({ update }) => {
      await update();
      isKickingWifi = null;
      selectedWifiClient = null;
    };
  }}
  class="hidden"
>
  <input type="hidden" name="registrationId" value={selectedWifiClient?.id || ''} />
</form>

<!-- Block MAC Form -->
<form
  bind:this={blockFormEl}
  method="POST"
  action="?/blockMac"
  use:enhance={() => {
    if (selectedWifiClient) {
      isBlocking = selectedWifiClient.id;
    }
    return async ({ update }) => {
      await update();
      isBlocking = null;
      selectedWifiClient = null;
    };
  }}
  class="hidden"
>
  <input type="hidden" name="registrationId" value={selectedWifiClient?.id || ''} />
  <input type="hidden" name="macAddress" value={selectedWifiClient?.macAddress || ''} />
  <input type="hidden" name="deviceName" value={selectedWifiClient?.deviceName || ''} />
</form>

<!-- Confirmation Modals -->
<ConfirmModal
  bind:open={showKickVoucherModal}
  title="تأكيد قطع الاتصال"
  message="هل أنت متأكد من قطع اتصال المستخدم {selectedVoucherUser?.voucherCode}؟"
  confirmText="قطع الاتصال"
  cancelText="إلغاء"
  variant="destructive"
  onConfirm={() => kickVoucherFormEl.requestSubmit()}
/>

<ConfirmModal
  bind:open={showKickWifiModal}
  title="تأكيد قطع الاتصال"
  message="هل أنت متأكد من قطع اتصال {selectedWifiClient?.deviceName || 'هذا الجهاز'}؟"
  confirmText="قطع الاتصال"
  cancelText="إلغاء"
  variant="destructive"
  onConfirm={() => kickWifiFormEl.requestSubmit()}
/>

<ConfirmModal
  bind:open={showBlockModal}
  title="تأكيد الحظر"
  message="هل أنت متأكد من حظر {selectedWifiClient?.deviceName || 'هذا الجهاز'}؟ لن يتمكن من الاتصال بالشبكة مرة أخرى."
  confirmText="حظر الجهاز"
  cancelText="إلغاء"
  variant="destructive"
  onConfirm={() => blockFormEl.requestSubmit()}
/>

<!-- QR Code Modal -->
<Modal bind:open={showQrModal} onClose={closeQrModal}>
  {#snippet header()}
    <div class="modal-header">
      <h3>
        <QrCode class="w-5 h-5 text-primary-light" />
        كود الكوبون
      </h3>
      <button class="modal-close-btn" onclick={closeQrModal}>
        <X class="w-5 h-5" />
      </button>
    </div>
  {/snippet}

  {#if qrVoucher}
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
          <span class="code-value">{qrVoucher.voucherCode}</span>
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
          <span class="info-value">{qrVoucher.packageName}</span>
        </div>
      </div>

      <p class="qr-hint-footer">
        ١. امسح الكود للاتصال بالواي فاي<br>
        ٢. أدخل كود الدخول في صفحة تسجيل الدخول
      </p>
    </div>
  {/if}
</Modal>

<style>
  .users-page {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  /* Stats Row */
  .stats-row {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
  }

  /* Sections */
  .voucher-section,
  .wifi-section {
    padding: 0;
    overflow: hidden;
  }

  .table-container {
    overflow-x: auto;
  }

  .table-modern {
    min-width: 900px;
  }

  /* Package Info */
  .package-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .package-name {
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .package-price {
    font-size: 12px;
    color: var(--color-text-muted);
  }

  /* Usage Progress */
  .cell-usage-fill.warning {
    background: linear-gradient(90deg, var(--color-warning) 0%, #f59e0b 100%);
  }

  .cell-usage-fill.danger {
    background: linear-gradient(90deg, var(--color-danger) 0%, #dc2626 100%);
  }

  /* Action Buttons */
  .action-buttons {
    display: flex;
    gap: 4px;
  }

  /* Block Button */
  .btn-block {
    color: var(--color-warning);
  }

  .btn-block:hover {
    background: rgba(245, 158, 11, 0.1);
  }

  /* Device Info in Table */
  .device-name {
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .device-mac {
    font-size: 11px;
    font-family: var(--font-mono);
    color: var(--color-text-muted);
  }

  /* Voucher Cell - Clickable */
  .voucher-cell {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 6px 10px;
    margin: -6px -10px;
    border: none;
    background: transparent;
    border-radius: 8px;
    cursor: pointer;
    transition: all var(--animation-duration-normal);
  }

  .voucher-cell:hover {
    background: rgba(8, 145, 178, 0.1);
  }


  /* QR Modal */
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
    transition: all 0.2s ease;
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
</style>
