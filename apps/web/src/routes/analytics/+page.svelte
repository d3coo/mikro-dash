<script lang="ts">
  import { Banknote, TrendingUp, TrendingDown, Package, HardDrive, Plus, Trash2, Edit2, Check, X, DollarSign, PieChart, BarChart3, Wifi, Gamepad2, Coffee, Building } from 'lucide-svelte';
  import { enhance } from '$app/forms';
  import { goto, invalidateAll } from '$app/navigation';
  import { page } from '$app/stores';
  import { toast } from 'svelte-sonner';
  import { browser } from '$app/environment';
  import LineChart from '$lib/components/charts/LineChart.svelte';
  import BarChartComponent from '$lib/components/charts/BarChart.svelte';
  import DonutChart from '$lib/components/charts/DonutChart.svelte';
  import DateRangePicker from '$lib/components/DateRangePicker.svelte';
  import SegmentCard from '$lib/components/analytics/SegmentCard.svelte';

  let { data, form } = $props();

  type TimePeriod = 'today' | 'week' | 'month' | 'custom';
  type ExpenseCategory = 'wifi' | 'playstation' | 'fnb' | 'general';

  let currentPeriod = $state(data.period as TimePeriod);
  let customStart = $state(data.startDate || '');
  let customEnd = $state(data.endDate || '');
  let selectedCategory = $state<ExpenseCategory | 'all'>(data.categoryFilter || 'all');

  // Add expense modal
  let showAddExpense = $state(false);
  let newExpenseType = $state<'per_gb' | 'fixed_monthly'>('fixed_monthly');
  let newExpenseCategory = $state<ExpenseCategory>('general');
  let editingExpense = $state<string | null>(null);
  let editAmount = $state(0);
  let editCategory = $state<ExpenseCategory>('general');

  // Category options
  const categories: { id: ExpenseCategory | 'all'; label: string; icon: typeof Wifi }[] = [
    { id: 'all', label: 'الكل', icon: Building },
    { id: 'wifi', label: 'WiFi', icon: Wifi },
    { id: 'playstation', label: 'PlayStation', icon: Gamepad2 },
    { id: 'fnb', label: 'مأكولات', icon: Coffee },
    { id: 'general', label: 'عام', icon: Building }
  ];

  const categoryLabels: Record<ExpenseCategory, string> = {
    wifi: 'WiFi',
    playstation: 'PlayStation',
    fnb: 'مأكولات',
    general: 'عام'
  };

  function handlePeriodChange(period: TimePeriod, start?: string, end?: string) {
    let url = `/analytics?period=${period}`;
    if (period === 'custom' && start && end) {
      url += `&start=${start}&end=${end}`;
    }
    if (selectedCategory !== 'all') {
      url += `&category=${selectedCategory}`;
    }
    goto(url);
  }

  function handleCategoryFilter(cat: ExpenseCategory | 'all') {
    selectedCategory = cat;
    let url = `/analytics?period=${currentPeriod}`;
    if (currentPeriod === 'custom' && customStart && customEnd) {
      url += `&start=${customStart}&end=${customEnd}`;
    }
    if (cat !== 'all') {
      url += `&category=${cat}`;
    }
    goto(url);
  }

  // Format currency (piasters to EGP)
  function formatCurrency(piasters: number): string {
    return `${(piasters / 100).toFixed(0)} ج.م`;
  }

  // Format currency from EGP
  function formatCurrencyEgp(amount: number): string {
    return `${amount.toFixed(0)} ج.م`;
  }

  // Format GB
  function formatGB(gb: number): string {
    return `${gb.toFixed(1)} GB`;
  }

  // Derived data from unified analytics
  const unified = $derived(data.unified);

  // Total stats cards
  const totalStats = $derived(unified ? [
    {
      title: 'إجمالي الإيرادات',
      value: formatCurrency(unified.totals.revenue),
      subtitle: `${unified.period.days} يوم`,
      icon: Banknote,
      color: 'success'
    },
    {
      title: 'إجمالي المصروفات',
      value: formatCurrency(unified.totals.expenses),
      subtitle: `عام: ${formatCurrency(unified.totals.generalExpenses)}`,
      icon: DollarSign,
      color: 'danger'
    },
    {
      title: 'صافي الربح',
      value: formatCurrency(unified.totals.netProfit),
      subtitle: `إجمالي: ${formatCurrency(unified.totals.grossProfit)}`,
      icon: unified.totals.netProfit >= 0 ? TrendingUp : TrendingDown,
      color: unified.totals.netProfit >= 0 ? 'success' : 'danger'
    },
    {
      title: 'المعاملات',
      value: `${(unified.segments.wifi.vouchersSold || 0) + (unified.segments.playstation.sessions || 0) + (unified.segments.fnb.itemsSold || 0)}`,
      subtitle: 'معاملة',
      icon: Package,
      color: 'primary'
    }
  ] : []);

  // Segment-specific metrics
  const wifiMetrics = $derived(unified ? [
    { label: 'كروت', value: `${unified.segments.wifi.vouchersSold}` },
    { label: 'بيانات مباعة', value: formatGB(unified.segments.wifi.dataSoldGB) },
    { label: 'بيانات مستهلكة', value: formatGB(unified.segments.wifi.dataUsedGB) }
  ] : []);

  const psMetrics = $derived(unified ? [
    { label: 'جلسات', value: `${unified.segments.playstation.sessions}` },
    { label: 'دقائق', value: `${unified.segments.playstation.minutes}` }
  ] : []);

  const fnbMetrics = $derived(unified ? [
    { label: 'عناصر', value: `${unified.segments.fnb.itemsSold}` },
    { label: 'طلبات PS', value: formatCurrency(unified.segments.fnb.psOrdersRevenue || 0) },
    { label: 'مبيعات مستقلة', value: formatCurrency(unified.segments.fnb.standaloneRevenue || 0) }
  ] : []);

  // Legacy chart data
  const revenueChartLabels = $derived(data.charts.revenue.map((d: any) => d.label));
  const revenueChartData = $derived(data.charts.revenue.map((d: any) => d.value));
  const profitChartLabels = $derived(data.charts.profit.map((d: any) => d.label));
  const profitChartData = $derived(data.charts.profit.map((d: any) => d.value));
  const packageChartLabels = $derived(data.charts.salesByPackage.map((d: any) => d.packageName));
  const packageChartData = $derived(data.charts.salesByPackage.map((d: any) => d.count));

  // Segment chart data
  const segmentRevenueLabels = $derived(data.segmentCharts?.revenue?.map((d: any) => d.label) || []);
  const segmentRevenueDatasets = $derived([
    { label: 'WiFi', data: data.segmentCharts?.revenue?.map((d: any) => d.wifi / 100) || [], color: '#22d3ee' },
    { label: 'PlayStation', data: data.segmentCharts?.revenue?.map((d: any) => d.playstation / 100) || [], color: '#a78bfa' },
    { label: 'مأكولات', data: data.segmentCharts?.revenue?.map((d: any) => d.fnb / 100) || [], color: '#fbbf24' }
  ]);

  // Revenue distribution donut
  const revenueDistributionLabels = $derived(unified ? ['WiFi', 'PlayStation', 'مأكولات'] : []);
  const revenueDistributionData = $derived(unified ? [
    unified.segments.wifi.revenue / 100,
    unified.segments.playstation.revenue / 100,
    unified.segments.fnb.revenue / 100
  ] : []);

  // Expenses distribution donut
  const expensesDistributionLabels = $derived(unified ? ['WiFi', 'PlayStation', 'مأكولات', 'عام'] : []);
  const expensesDistributionData = $derived(unified ? [
    unified.expensesByCategory.wifi / 100,
    unified.expensesByCategory.playstation / 100,
    unified.expensesByCategory.fnb / 100,
    unified.expensesByCategory.general / 100
  ] : []);

  // Show toast for form results
  $effect(() => {
    if (form?.success) {
      toast.success(form.message || 'تمت العملية بنجاح');
      showAddExpense = false;
      editingExpense = null;
    } else if (form?.error) {
      toast.error(form.error);
    }
  });

  function startEditExpense(expense: any) {
    editingExpense = expense._id;
    editAmount = expense.amount / 100;
    editCategory = expense.category || 'general';
  }

  function cancelEdit() {
    editingExpense = null;
  }
</script>

<div class="analytics-page">
  <!-- Page Header -->
  <header class="page-header opacity-0 animate-fade-in">
    <div class="flex items-center justify-between flex-wrap gap-4">
      <div>
        <h1 class="page-title">التقارير والإحصائيات</h1>
        <p class="page-subtitle">تتبع المبيعات والأرباح عبر جميع الأقسام</p>
      </div>

      <!-- Period Selector -->
      <DateRangePicker
        bind:period={currentPeriod}
        bind:startDate={customStart}
        bind:endDate={customEnd}
        onPeriodChange={handlePeriodChange}
      />
    </div>
  </header>

  <!-- Totals Row -->
  <div class="stats-grid">
    {#each totalStats as stat, index}
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
        </div>
      </div>
    {/each}
  </div>

  <!-- Segment Cards -->
  {#if unified}
    <section class="segment-section opacity-0 animate-fade-in" style="animation-delay: 500ms">
      <h2 class="section-title-text">الأداء حسب القسم</h2>
      <div class="segment-grid">
        <SegmentCard
          segment="wifi"
          revenue={unified.segments.wifi.revenue}
          expenses={unified.segments.wifi.expenses}
          profit={unified.segments.wifi.profit}
          contribution={unified.segments.wifi.contribution}
          metrics={wifiMetrics}
        />
        <SegmentCard
          segment="playstation"
          revenue={unified.segments.playstation.revenue}
          expenses={unified.segments.playstation.expenses}
          profit={unified.segments.playstation.profit}
          contribution={unified.segments.playstation.contribution}
          metrics={psMetrics}
        />
        <SegmentCard
          segment="fnb"
          revenue={unified.segments.fnb.revenue}
          expenses={unified.segments.fnb.expenses}
          profit={unified.segments.fnb.profit}
          contribution={unified.segments.fnb.contribution}
          metrics={fnbMetrics}
        />
      </div>
    </section>
  {/if}

  <!-- Charts Section -->
  <div class="charts-grid">
    <!-- Revenue by Segment (Stacked) -->
    <div class="glass-card chart-card opacity-0 animate-fade-in" style="animation-delay: 600ms">
      <div class="chart-header">
        <h3 class="chart-title">
          <Banknote class="w-5 h-5 inline-block ml-2" />
          الإيرادات حسب القسم
        </h3>
      </div>
      <div class="chart-content">
        {#if browser && segmentRevenueLabels.length > 0}
          <BarChartComponent
            labels={segmentRevenueLabels}
            datasets={segmentRevenueDatasets}
            stacked={true}
          />
        {:else if segmentRevenueLabels.length === 0}
          <div class="chart-empty">
            <BarChart3 class="w-12 h-12 text-text-secondary opacity-50" />
            <p>لا توجد بيانات</p>
          </div>
        {:else}
          <div class="chart-loading">جاري التحميل...</div>
        {/if}
      </div>
    </div>

    <!-- Profit Chart -->
    <div class="glass-card chart-card opacity-0 animate-fade-in" style="animation-delay: 700ms">
      <div class="chart-header">
        <h3 class="chart-title">
          <TrendingUp class="w-5 h-5 inline-block ml-2" />
          صافي الربح
        </h3>
      </div>
      <div class="chart-content">
        {#if browser && profitChartData.length > 0}
          <LineChart
            labels={profitChartLabels}
            data={profitChartData}
            label="الربح (ج.م)"
            color="#22d3ee"
            fillColor="rgba(34, 211, 238, 0.1)"
          />
        {:else if profitChartData.length === 0}
          <div class="chart-empty">
            <BarChart3 class="w-12 h-12 text-text-secondary opacity-50" />
            <p>لا توجد بيانات</p>
          </div>
        {:else}
          <div class="chart-loading">جاري التحميل...</div>
        {/if}
      </div>
    </div>

    <!-- Revenue Distribution Donut -->
    <div class="glass-card chart-card opacity-0 animate-fade-in" style="animation-delay: 800ms">
      <div class="chart-header">
        <h3 class="chart-title">
          <PieChart class="w-5 h-5 inline-block ml-2" />
          توزيع الإيرادات
        </h3>
      </div>
      <div class="chart-content">
        {#if browser && revenueDistributionData.some(v => v > 0)}
          <DonutChart
            labels={revenueDistributionLabels}
            data={revenueDistributionData}
          />
        {:else}
          <div class="chart-empty">
            <PieChart class="w-12 h-12 text-text-secondary opacity-50" />
            <p>لا توجد إيرادات</p>
          </div>
        {/if}
      </div>
    </div>

    <!-- Expenses Distribution Donut -->
    <div class="glass-card chart-card opacity-0 animate-fade-in" style="animation-delay: 900ms">
      <div class="chart-header">
        <h3 class="chart-title">
          <DollarSign class="w-5 h-5 inline-block ml-2" />
          توزيع المصروفات
        </h3>
      </div>
      <div class="chart-content">
        {#if browser && expensesDistributionData.some(v => v > 0)}
          <DonutChart
            labels={expensesDistributionLabels}
            data={expensesDistributionData}
          />
        {:else}
          <div class="chart-empty">
            <PieChart class="w-12 h-12 text-text-secondary opacity-50" />
            <p>لا توجد مصروفات</p>
          </div>
        {/if}
      </div>
    </div>
  </div>

  <!-- Expense Management Section -->
  <section class="expenses-section glass-card opacity-0 animate-fade-in" style="animation-delay: 1000ms">
    <div class="section-header">
      <h2 class="section-title">
        <DollarSign class="w-5 h-5 inline-block ml-2" />
        إدارة المصروفات
      </h2>
      <button class="btn btn-primary btn-sm" onclick={() => showAddExpense = true}>
        <Plus class="w-4 h-4" />
        إضافة مصروف
      </button>
    </div>

    <!-- Category Filter -->
    <div class="category-filter">
      {#each categories as cat}
        <button
          class="category-btn {selectedCategory === cat.id ? 'active' : ''}"
          onclick={() => handleCategoryFilter(cat.id)}
        >
          <cat.icon class="w-4 h-4" />
          {cat.label}
        </button>
      {/each}
    </div>

    <!-- Cost Summary -->
    <div class="cost-summary">
      <div class="cost-item">
        <span class="cost-label">تكلفة الجيجا (WiFi)</span>
        <span class="cost-value">{formatCurrencyEgp(data.costPerGb)}</span>
      </div>
      <div class="cost-item">
        <span class="cost-label">المصروفات الثابتة (شهري)</span>
        <span class="cost-value">{formatCurrencyEgp(data.monthlyFixed)}</span>
      </div>
    </div>

    <!-- Expenses Table -->
    <div class="table-container">
      <table class="table-modern">
        <thead>
          <tr>
            <th>الفئة</th>
            <th>النوع</th>
            <th>الاسم</th>
            <th>المبلغ</th>
            <th>الحالة</th>
            <th>الإجراءات</th>
          </tr>
        </thead>
        <tbody>
          {#each data.expenses as expense}
            <tr>
              <td>
                <span class="badge badge-category-{expense.category || 'general'}">
                  {categoryLabels[expense.category as ExpenseCategory] || 'عام'}
                </span>
              </td>
              <td>
                <span class="badge {expense.type === 'per_gb' ? 'badge-primary' : 'badge-neutral'}">
                  {expense.type === 'per_gb' ? 'لكل جيجا' : 'شهري ثابت'}
                </span>
              </td>
              <td>{expense.nameAr}</td>
              <td>
                {#if editingExpense === expense._id}
                  <form method="POST" action="?/updateExpense" use:enhance>
                    <input type="hidden" name="id" value={expense._id} />
                    <input type="hidden" name="isActive" value={expense.isActive ? 'true' : 'false'} />
                    <input type="hidden" name="category" value={editCategory} />
                    <div class="flex items-center gap-2">
                      <input
                        type="number"
                        name="amount"
                        bind:value={editAmount}
                        step="0.01"
                        class="input-modern w-24"
                      />
                      <span class="text-text-secondary">ج.م</span>
                      <select bind:value={editCategory} class="select-modern w-28">
                        <option value="wifi">WiFi</option>
                        <option value="playstation">PlayStation</option>
                        <option value="fnb">مأكولات</option>
                        <option value="general">عام</option>
                      </select>
                      <button type="submit" class="btn-icon btn-success">
                        <Check class="w-4 h-4" />
                      </button>
                      <button type="button" class="btn-icon btn-neutral" onclick={cancelEdit}>
                        <X class="w-4 h-4" />
                      </button>
                    </div>
                  </form>
                {:else}
                  {formatCurrencyEgp(expense.amount / 100)}
                {/if}
              </td>
              <td>
                <form method="POST" action="?/updateExpense" use:enhance>
                  <input type="hidden" name="id" value={expense._id} />
                  <input type="hidden" name="amount" value={expense.amount / 100} />
                  <input type="hidden" name="category" value={expense.category || 'general'} />
                  <input type="hidden" name="isActive" value={expense.isActive ? 'false' : 'true'} />
                  <button type="submit" class="badge cursor-pointer hover:opacity-80 {expense.isActive ? 'badge-success' : 'badge-danger'}">
                    {expense.isActive ? 'مفعل' : 'معطل'}
                  </button>
                </form>
              </td>
              <td>
                <div class="action-buttons">
                  <button
                    class="btn-icon btn-neutral"
                    onclick={() => startEditExpense(expense)}
                    title="تعديل"
                  >
                    <Edit2 class="w-4 h-4" />
                  </button>
                  <form method="POST" action="?/deleteExpense" use:enhance>
                    <input type="hidden" name="id" value={expense._id} />
                    <button type="submit" class="btn-icon btn-danger" title="حذف">
                      <Trash2 class="w-4 h-4" />
                    </button>
                  </form>
                </div>
              </td>
            </tr>
          {:else}
            <tr>
              <td colspan="6" class="text-center text-text-secondary py-8">
                لا توجد مصروفات مسجلة
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>
</div>

<!-- Add Expense Modal -->
{#if showAddExpense}
  <div class="modal-overlay" onclick={() => showAddExpense = false}>
    <div class="modal-content glass-card" onclick={(e) => e.stopPropagation()}>
      <h3 class="modal-title">إضافة مصروف جديد</h3>
      <form method="POST" action="?/addExpense" use:enhance>
        <div class="form-group">
          <label class="form-label">فئة المصروف</label>
          <select name="category" bind:value={newExpenseCategory} class="select-modern">
            <option value="wifi">WiFi</option>
            <option value="playstation">PlayStation</option>
            <option value="fnb">مأكولات ومشروبات</option>
            <option value="general">عام</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">نوع المصروف</label>
          <select name="type" bind:value={newExpenseType} class="select-modern">
            <option value="per_gb">تكلفة لكل جيجا</option>
            <option value="fixed_monthly">مصروف شهري ثابت</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">الاسم (إنجليزي)</label>
          <input type="text" name="name" required class="input-modern" placeholder="e.g., Electricity" />
        </div>

        <div class="form-group">
          <label class="form-label">الاسم (عربي)</label>
          <input type="text" name="nameAr" required class="input-modern" placeholder="مثال: الكهرباء" />
        </div>

        <div class="form-group">
          <label class="form-label">
            المبلغ (ج.م)
            {#if newExpenseType === 'per_gb'}
              <span class="text-text-secondary text-sm">- لكل جيجا</span>
            {:else}
              <span class="text-text-secondary text-sm">- شهرياً</span>
            {/if}
          </label>
          <input type="number" name="amount" required step="0.01" min="0" class="input-modern" placeholder="0.00" />
        </div>

        <div class="modal-actions">
          <button type="button" class="btn btn-neutral" onclick={() => showAddExpense = false}>
            إلغاء
          </button>
          <button type="submit" class="btn btn-primary">
            إضافة
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  .analytics-page {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 1rem;
  }

  /* Stat Card Styles */
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

  .stat-icon-danger {
    background: rgba(239, 68, 68, 0.15);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.3);
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

  /* Segment Section */
  .segment-section {
    margin-top: 0.5rem;
  }

  .section-title-text {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 1rem;
  }

  .segment-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 1rem;
  }

  .charts-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
  }

  @media (max-width: 1024px) {
    .charts-grid {
      grid-template-columns: 1fr;
    }
  }

  .chart-card {
    padding: 1.25rem;
  }

  .chart-header {
    margin-bottom: 1rem;
  }

  .chart-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
    display: flex;
    align-items: center;
  }

  .chart-content {
    min-height: 250px;
  }

  .chart-empty,
  .chart-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 250px;
    color: var(--text-secondary);
    gap: 0.5rem;
  }

  .expenses-section {
    padding: 1.5rem;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .section-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-primary);
    display: flex;
    align-items: center;
  }

  .category-filter {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .category-btn {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.75rem;
    border-radius: 0.5rem;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--text-secondary);
    background: var(--bg-glass);
    border: 1px solid var(--border-glass);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .category-btn:hover {
    color: var(--text-primary);
    background: rgba(34, 211, 238, 0.1);
  }

  .category-btn.active {
    background: #0891b2;
    color: white;
    border-color: transparent;
  }

  .cost-summary {
    display: flex;
    gap: 2rem;
    padding: 1rem;
    background: var(--bg-glass);
    border-radius: 0.75rem;
    margin-bottom: 1rem;
  }

  .cost-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .cost-label {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .cost-value {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--primary);
  }

  .table-container {
    overflow-x: auto;
  }

  .action-buttons {
    display: flex;
    gap: 0.5rem;
  }

  .btn-icon {
    padding: 0.375rem;
    border-radius: 0.375rem;
    border: none;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-icon.btn-neutral {
    background: var(--bg-glass);
    color: var(--text-secondary);
  }

  .btn-icon.btn-neutral:hover {
    background: var(--bg-secondary);
    color: var(--text-primary);
  }

  .btn-icon.btn-danger {
    background: rgba(239, 68, 68, 0.1);
    color: var(--danger);
  }

  .btn-icon.btn-danger:hover {
    background: rgba(239, 68, 68, 0.2);
  }

  .btn-icon.btn-success {
    background: rgba(34, 197, 94, 0.1);
    color: var(--success);
  }

  .btn-icon.btn-success:hover {
    background: rgba(34, 197, 94, 0.2);
  }

  /* Category badges */
  .badge-category-wifi {
    background: rgba(34, 211, 238, 0.1);
    color: #22d3ee;
    border: 1px solid rgba(34, 211, 238, 0.3);
  }

  .badge-category-playstation {
    background: rgba(167, 139, 250, 0.1);
    color: #a78bfa;
    border: 1px solid rgba(167, 139, 250, 0.3);
  }

  .badge-category-fnb {
    background: rgba(251, 191, 36, 0.1);
    color: #fbbf24;
    border: 1px solid rgba(251, 191, 36, 0.3);
  }

  .badge-category-general {
    background: rgba(148, 163, 184, 0.1);
    color: #94a3b8;
    border: 1px solid rgba(148, 163, 184, 0.3);
  }

  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 50;
    padding: 1rem;
  }

  .modal-content {
    width: 100%;
    max-width: 400px;
    padding: 1.5rem;
  }

  .modal-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 1.5rem;
  }

  .form-group {
    margin-bottom: 1rem;
  }

  .form-label {
    display: block;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-secondary);
    margin-bottom: 0.5rem;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-top: 1.5rem;
  }

  .btn {
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    border: none;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .btn-primary {
    background: var(--primary);
    color: white;
  }

  .btn-primary:hover {
    background: var(--primary-dark);
  }

  .btn-neutral {
    background: var(--bg-glass);
    color: var(--text-secondary);
    border: 1px solid var(--border-glass);
  }

  .btn-neutral:hover {
    background: var(--bg-secondary);
    color: var(--text-primary);
  }

  .btn-sm {
    padding: 0.375rem 0.75rem;
    font-size: 0.8125rem;
  }

  .badge-primary {
    background: rgba(34, 211, 238, 0.1);
    color: var(--primary);
  }
</style>
