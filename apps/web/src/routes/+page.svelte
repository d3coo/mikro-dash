<script lang="ts">
  import { Users, Ticket, Banknote, Wifi, WifiOff, TrendingUp, Activity } from 'lucide-svelte';

  let { data } = $props();

  const stats = [
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
      value: `${data.stats.todayRevenue} ج.م`,
      subtitle: 'المبيعات اليوم',
      icon: Banknote,
      color: 'warning',
      delay: 2
    }
  ];
</script>

<div class="dashboard">
  <!-- Page Header -->
  <header class="page-header opacity-0 animate-fade-in">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="page-title">{data.businessName}</h1>
        <p class="page-subtitle">لوحة التحكم الرئيسية</p>
      </div>
      <div class="hidden md:flex items-center gap-3 text-sm text-text-secondary">
        <Activity class="w-4 h-4" />
        <span>آخر تحديث: الآن</span>
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
        <span class="stat-subtitle">MikroTik Router</span>
        {#if data.stats.routerConnected}
          <span class="connection-dot connected"></span>
        {:else}
          <span class="connection-dot disconnected"></span>
        {/if}
      </div>
    </div>
  </div>

  <!-- Quick Actions -->
  <section class="quick-actions opacity-0 animate-fade-in" style="animation-delay: 500ms">
    <h2 class="section-title">إجراءات سريعة</h2>
    <div class="actions-grid">
      <a href="/vouchers" class="action-card glass-card">
        <div class="action-icon">
          <Ticket class="w-6 h-6" />
        </div>
        <div class="action-content">
          <h3>إنشاء كروت</h3>
          <p>إنشاء كروت واي فاي جديدة</p>
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
</div>

<style>
  .dashboard {
    display: flex;
    flex-direction: column;
    gap: 32px;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 20px;
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
    transition: all 0.3s ease;
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

  .connection-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }

  .connection-dot.connected {
    background: var(--color-success);
    box-shadow: 0 0 12px var(--color-success-glow);
    animation: pulse-dot 2s ease-in-out infinite;
  }

  .connection-dot.disconnected {
    background: var(--color-danger);
  }

  @keyframes pulse-dot {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.7; transform: scale(1.1); }
  }

  .text-success { color: #34d399; }
  .text-danger { color: #f87171; }

  /* Quick Actions */
  .quick-actions {
    margin-top: 16px;
  }

  .section-title {
    font-size: 18px;
    font-weight: 600;
    color: var(--color-text-primary);
    margin-bottom: 16px;
  }

  .actions-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 16px;
  }

  .action-card {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 20px;
    text-decoration: none;
    transition: all 0.2s ease;
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
</style>
