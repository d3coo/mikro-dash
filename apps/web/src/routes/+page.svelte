<script lang="ts">
  import { Users, Ticket, Banknote, Wifi, WifiOff, TrendingUp, Activity, Clock, Monitor, Signal, XCircle, QrCode, CheckCircle, Loader2, Cpu, HardDrive, Timer, Trash2, RefreshCw, Gamepad2 } from 'lucide-svelte';
  import { onMount, onDestroy } from 'svelte';
  import { toast } from 'svelte-sonner';
  import { invalidateAll } from '$app/navigation';
  import Modal from '$lib/components/modal.svelte';

  let { data } = $props();

  // Auto-refresh state
  let refreshInterval: ReturnType<typeof setInterval> | null = null;
  let isRefreshing = $state(false);
  let lastRefresh = $state(new Date());

  // Auto-refresh every 30 seconds
  onMount(() => {
    refreshInterval = setInterval(() => {
      refreshData();
    }, 30000);
  });

  onDestroy(() => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
  });

  async function refreshData() {
    isRefreshing = true;
    try {
      await invalidateAll();
      lastRefresh = new Date();
    } finally {
      isRefreshing = false;
    }
  }

  // QR Scanner state
  let showQrScanner = $state(false);
  let scannerReady = $state(false);
  let scannedCode = $state('');
  let isProcessing = $state(false);
  let scanResult = $state<{ success: boolean; message: string } | null>(null);
  let html5QrCode: any = null;

  async function startScanner() {
    showQrScanner = true;
    scannedCode = '';
    scanResult = null;

    // Dynamic import for client-side only
    const { Html5Qrcode } = await import('html5-qrcode');

    // Wait for DOM to be ready
    await new Promise(resolve => setTimeout(resolve, 100));

    html5QrCode = new Html5Qrcode('qr-reader');

    try {
      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 }
        },
        onScanSuccess,
        () => {} // Ignore scan errors
      );
      scannerReady = true;
    } catch (err) {
      console.error('Failed to start scanner:', err);
      toast.error('فشل في تشغيل الكاميرا');
      stopScanner();
    }
  }

  async function stopScanner() {
    if (html5QrCode) {
      try {
        await html5QrCode.stop();
      } catch {}
      html5QrCode = null;
    }
    showQrScanner = false;
    scannerReady = false;
  }

  async function onScanSuccess(decodedText: string) {
    if (isProcessing) return;

    scannedCode = decodedText;
    isProcessing = true;

    // Stop scanning
    if (html5QrCode) {
      try {
        await html5QrCode.stop();
      } catch {}
    }
    scannerReady = false;

    // Find the voucher
    const voucher = data.vouchers.find(v => v.name === decodedText);

    if (voucher) {
      if (voucher.status === 'available') {
        scanResult = {
          success: true,
          message: `تم العثور على الكرت: ${voucher.name}\nكلمة المرور: ${voucher.password}\nالباقة: ${voucher.profile}`
        };
        toast.success('تم مسح الكرت بنجاح');
      } else if (voucher.status === 'used') {
        scanResult = {
          success: false,
          message: `الكرت ${voucher.name} مستخدم بالفعل`
        };
        toast.warning('هذا الكرت مستخدم');
      } else {
        scanResult = {
          success: false,
          message: `الكرت ${voucher.name} منتهي`
        };
        toast.error('هذا الكرت منتهي');
      }
    } else {
      scanResult = {
        success: false,
        message: `لم يتم العثور على الكرت: ${decodedText}`
      };
      toast.error('كرت غير موجود');
    }

    isProcessing = false;
  }

  function resetScanner() {
    scannedCode = '';
    scanResult = null;
    startScanner();
  }

  // Format bytes to human readable
  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // Format uptime string (e.g., "1h2m3s" -> "1س 2د")
  function formatUptime(uptime: string): string {
    if (!uptime || uptime === '0s') return '-';

    const hours = uptime.match(/(\d+)h/);
    const minutes = uptime.match(/(\d+)m/);
    const seconds = uptime.match(/(\d+)s/);

    const parts = [];
    if (hours) parts.push(`${hours[1]}س`);
    if (minutes) parts.push(`${minutes[1]}د`);
    if (!hours && !minutes && seconds) parts.push(`${seconds[1]}ث`);

    return parts.join(' ') || '-';
  }

  // Format router uptime (e.g., "1w2d3h4m5s" -> "1 أسبوع 2 يوم")
  function formatRouterUptime(uptime: string): string {
    if (!uptime || uptime === '0s') return '-';

    const weeks = uptime.match(/(\d+)w/);
    const days = uptime.match(/(\d+)d/);
    const hours = uptime.match(/(\d+)h/);
    const minutes = uptime.match(/(\d+)m/);

    const parts = [];
    if (weeks) parts.push(`${weeks[1]}أ`);
    if (days) parts.push(`${days[1]}ي`);
    if (hours) parts.push(`${hours[1]}س`);
    if (!weeks && !days && minutes) parts.push(`${minutes[1]}د`);

    return parts.join(' ') || '-';
  }

  // Format memory size
  function formatMemory(bytes: number): string {
    const mb = bytes / (1024 * 1024);
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(1)} GB`;
    }
    return `${mb.toFixed(0)} MB`;
  }

  // Get status badge class
  function getStatusClass(status: string): string {
    switch (status) {
      case 'available': return 'badge-success';
      case 'used': return 'badge-warning';
      case 'exhausted': return 'badge-danger';
      default: return 'badge-neutral';
    }
  }

  // Get status text in Arabic
  function getStatusText(status: string): string {
    switch (status) {
      case 'available': return 'متاح';
      case 'used': return 'مستخدم';
      case 'exhausted': return 'منتهي';
      default: return status;
    }
  }

  // Limit items shown on dashboard
  const MAX_SESSIONS = 5;
  const MAX_VOUCHERS = 5;

  let limitedSessions = $derived(data.activeSessions.slice(0, MAX_SESSIONS));
  let limitedVouchers = $derived(data.vouchers.slice(0, MAX_VOUCHERS));

  // Combined today revenue (WiFi + PlayStation)
  let totalTodayRevenue = $derived(data.stats.todayRevenue + data.stats.psTodayRevenue);

  const stats = $derived([
    {
      title: 'المستخدمين النشطين',
      value: data.stats.activeUsers,
      subtitle: 'متصل الآن',
      icon: Users,
      color: 'primary',
      delay: 0
    },
    {
      title: 'الكروت المتاحة',
      value: data.stats.availableVouchers,
      subtitle: 'جاهزة للبيع',
      icon: Ticket,
      color: 'success',
      delay: 1
    },
    {
      title: 'إيراد اليوم',
      value: `${totalTodayRevenue} ج.م`,
      subtitle: `كروت: ${data.stats.todayRevenue} | PS: ${data.stats.psTodayRevenue}`,
      icon: Banknote,
      color: 'warning',
      delay: 2
    }
  ]);
</script>

<div class="dashboard">
  <!-- Page Header -->
  <header class="page-header opacity-0 animate-fade-in">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="page-title">{data.businessName}</h1>
        <p class="page-subtitle">لوحة التحكم الرئيسية</p>
      </div>
      <div class="flex items-center gap-4">
        <div class="hidden md:flex items-center gap-2 text-sm text-text-secondary">
          <Activity class="w-4 h-4" />
          <span>آخر تحديث: {lastRefresh.toLocaleTimeString('ar-EG')}</span>
        </div>
        <button
          onclick={refreshData}
          disabled={isRefreshing}
          class="refresh-btn"
          title="تحديث البيانات"
        >
          <RefreshCw class="w-5 h-5 {isRefreshing ? 'animate-spin' : ''}" />
        </button>
      </div>
    </div>
  </header>

  <!-- Stats Grid -->
  <div class="stats-grid">
    {#each stats as stat, index}
      <div
        class="stat-card glass-card opacity-0 animate-fade-in"
        style="animation-delay: {100 + index * 100}ms"
      >
        <div class="stat-header">
          <span class="stat-title">{stat.title}</span>
          <div class="stat-icon-wrapper stat-icon-{stat.color}">
            <stat.icon class="stat-icon w-5 h-5" />
          </div>
        </div>
        <div class="stat-value">{stat.value}</div>
        <div class="stat-footer">
          <span class="stat-subtitle">{stat.subtitle}</span>
          <TrendingUp class="w-4 h-4 text-success" />
        </div>
      </div>
    {/each}

    <!-- Router Status Card -->
    <div
      class="stat-card glass-card opacity-0 animate-fade-in"
      style="animation-delay: 400ms"
    >
      <div class="stat-header">
        <span class="stat-title">حالة الراوتر</span>
        <div class="stat-icon-wrapper {data.stats.routerConnected ? 'stat-icon-success' : 'stat-icon-danger'}">
          {#if data.stats.routerConnected}
            <Wifi class="stat-icon w-5 h-5" />
          {:else}
            <WifiOff class="stat-icon w-5 h-5" />
          {/if}
        </div>
      </div>
      <div class="stat-value {data.stats.routerConnected ? 'text-success' : 'text-danger'}">
        {#if data.stats.routerConnected}
          متصل
        {:else}
          غير متصل
        {/if}
      </div>
      <div class="stat-footer">
        <span class="stat-subtitle">
          {#if data.stats.routerHealth}
            {data.stats.routerHealth.boardName}
          {:else}
            MikroTik Router
          {/if}
        </span>
        {#if data.stats.routerConnected}
          <span class="status-dot status-dot-success"></span>
        {:else}
          <span class="status-dot status-dot-danger"></span>
        {/if}
      </div>
    </div>
  </div>

  <!-- Router Health Section -->
  {#if data.stats.routerConnected && data.stats.routerHealth}
    <section class="router-health opacity-0 animate-fade-in" style="animation-delay: 450ms">
      <h2 class="section-title">
        <Monitor class="w-5 h-5 inline-block ml-2" />
        صحة الراوتر
      </h2>
      <div class="health-grid">
        <!-- CPU -->
        <div class="health-card glass-card">
          <div class="health-icon">
            <Cpu class="w-5 h-5" />
          </div>
          <div class="health-info">
            <span class="health-label">المعالج</span>
            <span class="health-value">{data.stats.routerHealth.cpuLoad}%</span>
          </div>
          <div class="health-bar">
            <div
              class="health-bar-fill {data.stats.routerHealth.cpuLoad > 80 ? 'danger' : data.stats.routerHealth.cpuLoad > 50 ? 'warning' : 'success'}"
              style="width: {data.stats.routerHealth.cpuLoad}%"
            ></div>
          </div>
        </div>

        <!-- Memory -->
        <div class="health-card glass-card">
          <div class="health-icon">
            <HardDrive class="w-5 h-5" />
          </div>
          <div class="health-info">
            <span class="health-label">الذاكرة</span>
            <span class="health-value">{data.stats.routerHealth.memoryPercent}%</span>
          </div>
          <div class="health-bar">
            <div
              class="health-bar-fill {data.stats.routerHealth.memoryPercent > 80 ? 'danger' : data.stats.routerHealth.memoryPercent > 50 ? 'warning' : 'success'}"
              style="width: {data.stats.routerHealth.memoryPercent}%"
            ></div>
          </div>
          <span class="health-detail">{formatMemory(data.stats.routerHealth.memoryUsed)} / {formatMemory(data.stats.routerHealth.memoryTotal)}</span>
        </div>

        <!-- Uptime -->
        <div class="health-card glass-card">
          <div class="health-icon">
            <Timer class="w-5 h-5" />
          </div>
          <div class="health-info">
            <span class="health-label">وقت التشغيل</span>
            <span class="health-value">{formatRouterUptime(data.stats.routerHealth.uptime)}</span>
          </div>
          <span class="health-detail">RouterOS {data.stats.routerHealth.version}</span>
        </div>
      </div>
    </section>
  {/if}

  <!-- Quick Actions -->
  <section class="quick-actions opacity-0 animate-fade-in" style="animation-delay: 500ms">
    <h2 class="section-title">إجراءات سريعة</h2>
    <div class="actions-grid">
      <button onclick={startScanner} class="action-card glass-card">
        <div class="action-icon action-icon-primary">
          <QrCode class="w-6 h-6" />
        </div>
        <div class="action-content">
          <h3>مسح كرت QR</h3>
          <p>مسح كود الكرت بالكاميرا</p>
        </div>
      </button>
      <a href="/vouchers" class="action-card glass-card">
        <div class="action-icon">
          <Ticket class="w-6 h-6" />
        </div>
        <div class="action-content">
          <h3>إنشاء كروت</h3>
          <p>إنشاء كروت واي فاي جديدة</p>
        </div>
      </a>
      <a href="/playstation" class="action-card glass-card">
        <div class="action-icon">
          <Gamepad2 class="w-6 h-6" />
        </div>
        <div class="action-content">
          <h3>البلايستيشن</h3>
          <p>{data.stats.psActiveSessions} جلسة نشطة من {data.stats.psStations}</p>
        </div>
      </a>
      <a href="/settings" class="action-card glass-card">
        <div class="action-icon">
          <Wifi class="w-6 h-6" />
        </div>
        <div class="action-content">
          <h3>إعدادات الراوتر</h3>
          <p>ضبط اتصال MikroTik</p>
        </div>
      </a>
    </div>
  </section>

  <!-- Active Sessions (Current Users) -->
  <section class="sessions-section opacity-0 animate-fade-in" style="animation-delay: 600ms">
    <div class="dashboard-section-header">
      <h2 class="section-title">
        <Signal class="w-5 h-5 inline-block ml-2" />
        المستخدمين المتصلين الآن
      </h2>
      <div class="header-actions">
        <span class="badge badge-success">
          {data.activeSessions.length} متصل
        </span>
        {#if data.activeSessions.length > MAX_SESSIONS}
          <a href="/users" class="view-all-link">
            عرض الكل
            <span class="flip-rtl">←</span>
          </a>
        {/if}
      </div>
    </div>

    <div class="glass-card table-container">
      {#if limitedSessions.length > 0}
        <table class="table-modern">
          <thead>
            <tr>
              <th>المستخدم</th>
              <th>العنوان IP</th>
              <th>MAC Address</th>
              <th>وقت الاتصال</th>
              <th>الرفع</th>
              <th>التحميل</th>
            </tr>
          </thead>
          <tbody>
            {#each limitedSessions as session}
              <tr>
                <td>
                  <div class="cell-user">
                    <div class="cell-user-avatar">
                      <Users class="w-4 h-4" />
                    </div>
                    <span class="font-mono">{session.user}</span>
                  </div>
                </td>
                <td class="font-mono text-secondary">{session.address}</td>
                <td class="font-mono text-secondary text-sm">{session.macAddress}</td>
                <td>
                  <div class="cell-uptime">
                    <Clock class="w-4 h-4 text-primary-light" />
                    <span>{formatUptime(session.uptime)}</span>
                  </div>
                </td>
                <td class="text-warning">{formatBytes(session.bytesIn)}</td>
                <td class="text-success">{formatBytes(session.bytesOut)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
        {#if data.activeSessions.length > MAX_SESSIONS}
          <div class="table-footer">
            <a href="/users" class="btn btn-secondary btn-sm">
              عرض جميع المستخدمين ({data.activeSessions.length})
            </a>
          </div>
        {/if}
      {:else}
        <div class="empty-state">
          <Monitor class="empty-state-icon" />
          <p class="empty-state-text">لا يوجد مستخدمين متصلين حالياً</p>
        </div>
      {/if}
    </div>
  </section>

  <!-- Vouchers List -->
  <section class="vouchers-section opacity-0 animate-fade-in" style="animation-delay: 700ms">
    <div class="dashboard-section-header">
      <h2 class="section-title">
        <Ticket class="w-5 h-5 inline-block ml-2" />
        الكروت
      </h2>
      <div class="header-actions">
        <div class="voucher-stats">
          <span class="badge badge-success">{data.stats.availableVouchers} متاح</span>
          <span class="badge badge-warning">{data.stats.usedVouchers} مستخدم</span>
          <span class="badge badge-danger">{data.stats.exhaustedVouchers} منتهي</span>
        </div>
        {#if data.vouchers.length > MAX_VOUCHERS}
          <a href="/vouchers" class="view-all-link">
            عرض الكل
            <span class="flip-rtl">←</span>
          </a>
        {/if}
      </div>
    </div>

    <div class="glass-card table-container">
      {#if limitedVouchers.length > 0}
        <table class="table-modern">
          <thead>
            <tr>
              <th>الكود</th>
              <th>كلمة المرور</th>
              <th>الباقة</th>
              <th>الاستهلاك</th>
              <th>الحالة</th>
            </tr>
          </thead>
          <tbody>
            {#each limitedVouchers as voucher}
              <tr>
                <td>
                  <span class="font-mono voucher-code">{voucher.name}</span>
                </td>
                <td class="font-mono text-text-secondary">{voucher.password || '••••••'}</td>
                <td class="text-text-secondary">{voucher.profile}</td>
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
                  <span class="badge {getStatusClass(voucher.status)}">
                    {getStatusText(voucher.status)}
                  </span>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
        {#if data.vouchers.length > MAX_VOUCHERS}
          <div class="table-footer">
            <a href="/vouchers" class="btn btn-secondary btn-sm">
              عرض جميع الكروت ({data.vouchers.length})
            </a>
          </div>
        {/if}
      {:else}
        <div class="empty-state">
          <Ticket class="empty-state-icon" />
          <p class="empty-state-text">
            {#if data.stats.routerConnected}
              لا توجد كروت في الراوتر
            {:else}
              غير متصل بالراوتر - تعذر تحميل الكروت
            {/if}
          </p>
          <a href="/vouchers" class="btn btn-primary mt-4">
            <Ticket class="w-4 h-4" />
            إنشاء كروت جديدة
          </a>
        </div>
      {/if}
    </div>
  </section>
</div>

<!-- QR Scanner Modal -->
<Modal bind:open={showQrScanner} onClose={stopScanner}>
  {#snippet header()}
    <div class="modal-header">
      <h3>
        <QrCode class="w-5 h-5 text-primary-light" />
        مسح كرت QR
      </h3>
      <button class="modal-close-btn" onclick={stopScanner}>
        <XCircle class="w-5 h-5" />
      </button>
    </div>
  {/snippet}

  {#if !scanResult}
    <div id="qr-reader" class="qr-reader"></div>
    {#if !scannerReady}
      <div class="qr-loading">
        <Loader2 class="w-8 h-8 animate-spin" />
        <p>جاري تشغيل الكاميرا...</p>
      </div>
    {/if}
    <p class="qr-hint">وجّه الكاميرا نحو كود QR الموجود على الكرت</p>
  {:else}
    <div class="scan-result {scanResult.success ? 'success' : 'error'}">
      <div class="result-icon">
        {#if scanResult.success}
          <CheckCircle class="w-12 h-12" />
        {:else}
          <XCircle class="w-12 h-12" />
        {/if}
      </div>
      <div class="result-message">
        {#each scanResult.message.split('\n') as line}
          <p>{line}</p>
        {/each}
      </div>
      <div class="result-actions">
        <button class="btn btn-primary" onclick={resetScanner}>
          <QrCode class="w-4 h-4" />
          مسح كرت آخر
        </button>
        <button class="btn btn-secondary" onclick={stopScanner}>
          إغلاق
        </button>
      </div>
    </div>
  {/if}
</Modal>

<style>
  .dashboard {
    display: flex;
    flex-direction: column;
    gap: 32px;
  }

  .refresh-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: rgba(8, 145, 178, 0.1);
    border: 1px solid rgba(8, 145, 178, 0.3);
    color: var(--color-primary-light);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .refresh-btn:hover:not(:disabled) {
    background: rgba(8, 145, 178, 0.2);
    border-color: var(--color-primary);
  }

  .refresh-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 16px;
  }

  @media (min-width: 769px) {
    .stats-grid {
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 20px;
    }
  }

  .stat-card {
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .stat-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .stat-title {
    font-size: 14px;
    font-weight: 500;
    color: var(--color-text-secondary);
  }

  .stat-icon-wrapper {
    width: 42px;
    height: 42px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--animation-duration-slow) ease;
  }

  .stat-icon-primary {
    background: rgba(8, 145, 178, 0.15);
    color: var(--color-primary-light);
    border: 1px solid rgba(8, 145, 178, 0.3);
  }

  .stat-icon-success {
    background: rgba(16, 185, 129, 0.15);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }

  .stat-icon-warning {
    background: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.3);
  }

  .stat-icon-danger {
    background: rgba(239, 68, 68, 0.15);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  .stat-value {
    font-size: 36px;
    font-weight: 700;
    color: var(--color-text-primary);
    line-height: 1;
  }

  .stat-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .stat-subtitle {
    font-size: 13px;
    color: var(--color-text-muted);
  }

  /* Quick Actions */
  .quick-actions {
    margin-top: 16px;
  }

  .actions-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 16px;
  }

  @media (max-width: 768px) {
    .actions-grid {
      grid-template-columns: 1fr;
    }

    .stat-card {
      padding: 16px;
      gap: 10px;
    }

    .stat-value {
      font-size: 28px;
    }

    .health-grid {
      grid-template-columns: 1fr;
    }
  }

  .action-card {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 20px;
    text-decoration: none;
    border: none;
    cursor: pointer;
    text-align: right;
    transition: all var(--animation-duration-normal) ease;
  }

  .action-card:hover {
    transform: translateY(-2px);
  }

  .action-icon {
    width: 52px;
    height: 52px;
    border-radius: 14px;
    background: linear-gradient(135deg, rgba(8, 145, 178, 0.2) 0%, rgba(8, 145, 178, 0.1) 100%);
    border: 1px solid rgba(8, 145, 178, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-primary-light);
    flex-shrink: 0;
  }

  .action-icon-primary {
    background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-light) 100%) !important;
    color: white !important;
    border: none !important;
  }

  .action-content h3 {
    font-size: 15px;
    font-weight: 600;
    color: var(--color-text-primary);
    margin-bottom: 4px;
  }

  .action-content p {
    font-size: 13px;
    color: var(--color-text-muted);
  }

  /* Section styles */
  .dashboard-section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
    flex-wrap: wrap;
    gap: 12px;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
  }

  .table-footer {
    padding: 16px 24px;
    border-top: 1px solid var(--color-border);
    display: flex;
    justify-content: center;
  }

  .sessions-section,
  .vouchers-section {
    margin-top: 8px;
  }

  .table-container {
    overflow-x: auto;
    padding: 0;
  }

  .table-container .table-modern {
    min-width: 600px;
  }

  /* Voucher Code */
  .voucher-code {
    color: var(--color-primary-light);
    font-weight: 600;
  }

  /* Voucher Stats */
  .voucher-stats {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  /* QR Scanner specific styles */
  .qr-reader {
    width: 100%;
    border-radius: 12px;
    overflow: hidden;
    background: #000;
    min-height: 300px;
  }

  .qr-reader :global(video) {
    border-radius: 12px;
  }

  .qr-loading {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    background: var(--color-bg-elevated);
    border-radius: 12px;
    color: var(--color-primary-light);
  }

  .qr-loading p {
    color: var(--color-text-secondary);
    font-size: 14px;
  }

  .qr-hint {
    text-align: center;
    margin-top: 16px;
    color: var(--color-text-muted);
    font-size: 14px;
  }

  .scan-result {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    padding: 20px;
    text-align: center;
  }

  .scan-result.success .result-icon {
    color: var(--color-success);
    background: rgba(16, 185, 129, 0.15);
  }

  .scan-result.error .result-icon {
    color: var(--color-danger);
    background: rgba(239, 68, 68, 0.15);
  }

  .result-icon {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .result-message {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .result-message p {
    color: var(--color-text-primary);
    font-size: 15px;
  }

  .result-message p:first-child {
    font-weight: 600;
    font-size: 16px;
  }

  .result-actions {
    display: flex;
    gap: 12px;
    margin-top: 8px;
  }

  /* Router Health Section */
  .router-health {
    margin-top: -16px;
  }

  .health-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
  }

  .health-card {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .health-icon {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: rgba(8, 145, 178, 0.15);
    border: 1px solid rgba(8, 145, 178, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-primary-light);
  }

  .health-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .health-label {
    font-size: 13px;
    color: var(--color-text-secondary);
  }

  .health-value {
    font-size: 18px;
    font-weight: 700;
    color: var(--color-text-primary);
  }

  .health-bar {
    height: 6px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
    overflow: hidden;
  }

  .health-bar-fill {
    height: 100%;
    border-radius: 3px;
    transition: width 0.5s ease;
  }

  .health-bar-fill.success {
    background: linear-gradient(90deg, #10b981, #34d399);
  }

  .health-bar-fill.warning {
    background: linear-gradient(90deg, #f59e0b, #fbbf24);
  }

  .health-bar-fill.danger {
    background: linear-gradient(90deg, #ef4444, #f87171);
  }

  .health-detail {
    font-size: 11px;
    color: var(--color-text-muted);
  }

  /* Responsive */
  @media (max-width: 768px) {
    .dashboard-section-header {
      flex-direction: column;
      align-items: flex-start;
    }

    .voucher-stats {
      width: 100%;
    }
  }
</style>
