<script lang="ts">
  import { History, ArrowRight, Gamepad2, Clock, Banknote, Calendar, Filter, Timer, TrendingUp, Play, Square, UtensilsCrossed } from 'lucide-svelte';
  import { goto } from '$app/navigation';

  let { data } = $props();

  // Format duration in minutes to human readable
  function formatDuration(startedAt: number, endedAt: number | null | undefined): string {
    const end = endedAt || Date.now();
    const durationMs = end - startedAt;
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours} ساعة ${minutes} دقيقة`;
    }
    return `${minutes} دقيقة`;
  }

  // Format date
  function formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString('ar-EG', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Format time only
  function formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Format cost from piasters to EGP
  function formatCost(piasters: number | null | undefined): string {
    if (piasters == null) return '-';
    return `${(piasters / 100).toFixed(1)} ج.م`;
  }

  // Format revenue
  function formatRevenue(piasters: number): string {
    return (piasters / 100).toFixed(1);
  }

  // Get station name
  function getStationName(stationId: string): string {
    const station = data.stations.find(s => s._id === stationId);
    return station?.nameAr || stationId;
  }

  // Get started by text
  function getStartedByText(startedBy: string): string {
    return startedBy === 'auto' ? 'تلقائي' : 'يدوي';
  }

  // Handle filter change
  function applyFilters(stationId: string, period: string) {
    const params = new URLSearchParams();
    if (stationId) params.set('station', stationId);
    if (period) params.set('period', period);
    goto(`/playstation/history?${params.toString()}`);
  }

  let selectedStation = $state(data.filters.stationId || '');
  let selectedPeriod = $state(data.filters.period || 'week');
</script>

<div class="history-page">
  <!-- Page Header -->
  <header class="page-header opacity-0 animate-fade-in">
    <div class="flex items-center gap-4">
      <a href="/playstation" class="back-btn">
        <ArrowRight class="w-5 h-5" />
      </a>
      <div>
        <h1 class="page-title">
          <History class="w-6 h-6 inline-block ml-2 text-primary-light" />
          سجل الجلسات
        </h1>
        <p class="page-subtitle">تاريخ جلسات PlayStation</p>
      </div>
    </div>
  </header>

  <!-- Stats Overview -->
  <div class="stats-grid opacity-0 animate-fade-in" style="animation-delay: 100ms">
    <div class="stat-card glass-card">
      <div class="stat-header">
        <span class="stat-title">إجمالي الجلسات</span>
        <div class="stat-icon-wrapper stat-icon-primary">
          <Timer class="w-5 h-5" />
        </div>
      </div>
      <div class="stat-value">{data.analytics.totalSessions}</div>
      <div class="stat-footer">
        <span class="stat-subtitle">في الفترة المحددة</span>
      </div>
    </div>

    <div class="stat-card glass-card">
      <div class="stat-header">
        <span class="stat-title">إجمالي الوقت</span>
        <div class="stat-icon-wrapper stat-icon-warning">
          <Clock class="w-5 h-5" />
        </div>
      </div>
      <div class="stat-value">{Math.floor(data.analytics.totalMinutes / 60)}س {data.analytics.totalMinutes % 60}د</div>
      <div class="stat-footer">
        <span class="stat-subtitle">{data.analytics.totalMinutes} دقيقة</span>
      </div>
    </div>

    <div class="stat-card glass-card">
      <div class="stat-header">
        <span class="stat-title">إجمالي الإيرادات</span>
        <div class="stat-icon-wrapper stat-icon-success">
          <Banknote class="w-5 h-5" />
        </div>
      </div>
      <div class="stat-value">{formatRevenue(data.analytics.totalRevenue)} ج.م</div>
      <div class="stat-footer">
        <span class="stat-subtitle">في الفترة المحددة</span>
        <TrendingUp class="w-4 h-4 text-success" />
      </div>
    </div>
  </div>

  <!-- Filters -->
  <div class="filters-card glass-card opacity-0 animate-fade-in" style="animation-delay: 150ms">
    <div class="filters-header">
      <Filter class="w-5 h-5 text-primary-light" />
      <span>تصفية النتائج</span>
    </div>
    <div class="filters-body">
      <div class="filter-group">
        <label for="station-filter">الجهاز</label>
        <select
          id="station-filter"
          class="select-modern"
          bind:value={selectedStation}
          onchange={() => applyFilters(selectedStation, selectedPeriod)}
        >
          <option value="">جميع الأجهزة</option>
          {#each data.stations as station}
            <option value={station._id}>{station.nameAr}</option>
          {/each}
        </select>
      </div>

      <div class="filter-group">
        <label for="period-filter">الفترة</label>
        <select
          id="period-filter"
          class="select-modern"
          bind:value={selectedPeriod}
          onchange={() => applyFilters(selectedStation, selectedPeriod)}
        >
          <option value="today">اليوم</option>
          <option value="week">آخر أسبوع</option>
          <option value="month">آخر شهر</option>
          <option value="all">الكل</option>
        </select>
      </div>
    </div>
  </div>

  <!-- Sessions Table -->
  <div class="glass-card table-container opacity-0 animate-fade-in" style="animation-delay: 200ms">
    {#if data.sessions.length > 0}
      <table class="table-modern">
        <thead>
          <tr>
            <th>الجهاز</th>
            <th>البداية</th>
            <th>النهاية</th>
            <th>المدة</th>
            <th>التكلفة</th>
            <th>الطلبات</th>
            <th>الطريقة</th>
            <th>ملاحظات</th>
          </tr>
        </thead>
        <tbody>
          {#each data.sessions as session}
            <tr class:active={!session.endedAt}>
              <td>
                <div class="cell-station">
                  <Gamepad2 class="w-4 h-4 text-primary-light" />
                  <span>{getStationName(session.stationId)}</span>
                </div>
              </td>
              <td>
                <div class="cell-date">
                  <span class="date-main">{formatDate(session.startedAt)}</span>
                </div>
              </td>
              <td>
                {#if session.endedAt}
                  <span class="text-text-secondary">{formatTime(session.endedAt)}</span>
                {:else}
                  <span class="badge badge-success">
                    <Play class="w-3 h-3" />
                    نشطة
                  </span>
                {/if}
              </td>
              <td>
                <div class="cell-duration">
                  <Clock class="w-4 h-4" />
                  <span>{formatDuration(session.startedAt, session.endedAt)}</span>
                </div>
              </td>
              <td>
                <span class="cost-value" class:pending={!session.endedAt}>
                  {formatCost(session.totalCost)}
                </span>
              </td>
              <td>
                {#if session.orders && session.orders.length > 0}
                  <div class="orders-cell">
                    <div class="orders-summary-badge">
                      <UtensilsCrossed class="w-3 h-3" />
                      <span>{session.orders.length}</span>
                    </div>
                    <div class="orders-tooltip">
                      {#each session.orders as order}
                        <div class="order-line">
                          <span>{order.menuItem?.nameAr || 'عنصر محذوف'} × {order.quantity}</span>
                          <span class="order-price">{formatCost(order.priceSnapshot * order.quantity)}</span>
                        </div>
                      {/each}
                      <div class="orders-total-line">
                        <span>الإجمالي</span>
                        <span>{formatCost(session.orders.reduce((sum, o) => sum + o.priceSnapshot * o.quantity, 0))}</span>
                      </div>
                    </div>
                  </div>
                {:else}
                  <span class="text-text-muted">-</span>
                {/if}
              </td>
              <td>
                <span class="badge {session.startedBy === 'auto' ? 'badge-info' : 'badge-neutral'}">
                  {getStartedByText(session.startedBy)}
                </span>
              </td>
              <td>
                <span class="text-text-muted text-sm">
                  {session.notes || '-'}
                </span>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {:else}
      <div class="empty-state">
        <History class="empty-state-icon" />
        <p class="empty-state-text">لا توجد جلسات في الفترة المحددة</p>
      </div>
    {/if}
  </div>
</div>

<style>
  .history-page {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .back-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: rgba(8, 145, 178, 0.1);
    border: 1px solid rgba(8, 145, 178, 0.3);
    color: var(--color-primary-light);
    transition: all 0.2s ease;
  }

  .back-btn:hover {
    background: rgba(8, 145, 178, 0.2);
    border-color: var(--color-primary);
  }

  /* Stats Grid */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
  }

  .stat-card {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .stat-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .stat-title {
    font-size: 13px;
    font-weight: 500;
    color: var(--color-text-secondary);
  }

  .stat-icon-wrapper {
    width: 38px;
    height: 38px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
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

  .stat-value {
    font-size: 28px;
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
    font-size: 12px;
    color: var(--color-text-muted);
  }

  /* Filters */
  .filters-card {
    padding: 16px 20px;
  }

  .filters-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 500;
    color: var(--color-text-primary);
    margin-bottom: 16px;
  }

  .filters-body {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
  }

  .filter-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 180px;
  }

  .filter-group label {
    font-size: 12px;
    color: var(--color-text-muted);
  }

  /* Table */
  .table-container {
    padding: 0;
    overflow-x: auto;
  }

  .table-modern {
    min-width: 800px;
  }

  tr.active {
    background: rgba(16, 185, 129, 0.05);
  }

  .cell-station {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .cell-date {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .date-main {
    color: var(--color-text-primary);
    font-size: 13px;
  }

  .cell-duration {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--color-text-secondary);
  }

  .cost-value {
    font-weight: 600;
    color: #34d399;
  }

  .cost-value.pending {
    color: var(--color-text-muted);
  }

  .badge-info {
    background: rgba(59, 130, 246, 0.15);
    color: #60a5fa;
    border: 1px solid rgba(59, 130, 246, 0.3);
  }

  /* Orders Cell */
  .orders-cell {
    position: relative;
  }

  .orders-summary-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    background: rgba(245, 158, 11, 0.15);
    border: 1px solid rgba(245, 158, 11, 0.3);
    border-radius: 6px;
    color: #fbbf24;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
  }

  .orders-tooltip {
    display: none;
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 8px;
    min-width: 200px;
    padding: 12px;
    background: var(--color-bg-card);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    z-index: 100;
  }

  .orders-cell:hover .orders-tooltip {
    display: block;
  }

  .order-line {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 0;
    font-size: 13px;
    color: var(--color-text-secondary);
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .order-line:last-of-type {
    border-bottom: none;
  }

  .order-price {
    color: var(--color-text-muted);
    font-family: monospace;
  }

  .orders-total-line {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 8px;
    margin-top: 8px;
    border-top: 1px solid rgba(245, 158, 11, 0.3);
    font-size: 13px;
    font-weight: 600;
    color: #fbbf24;
  }

  /* Responsive */
  @media (max-width: 640px) {
    .stats-grid {
      grid-template-columns: 1fr;
    }

    .filters-body {
      flex-direction: column;
    }

    .filter-group {
      width: 100%;
    }
  }
</style>
