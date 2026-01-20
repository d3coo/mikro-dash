<script lang="ts">
  import { Banknote, TrendingUp, TrendingDown, Package, HardDrive, Plus, Trash2, Edit2, Check, X, DollarSign, PieChart, BarChart3 } from 'lucide-svelte';
  import { enhance } from '$app/forms';
  import { goto, invalidateAll } from '$app/navigation';
  import { page } from '$app/stores';
  import { toast } from 'svelte-sonner';
  import { browser } from '$app/environment';
  import LineChart from '$lib/components/charts/LineChart.svelte';
  import BarChartComponent from '$lib/components/charts/BarChart.svelte';
  import DonutChart from '$lib/components/charts/DonutChart.svelte';

  let { data, form } = $props();

  // Period tabs
  const periods = [
    { id: 'today', label: 'اليوم' },
    { id: 'week', label: 'الأسبوع' },
    { id: 'month', label: 'الشهر' }
  ];

  function selectPeriod(period: string) {
    goto(`/analytics?period=${period}`);
  }

  // Add expense modal
  let showAddExpense = $state(false);
  let newExpenseType = $state<'per_gb' | 'fixed_monthly'>('fixed_monthly');
  let editingExpense = $state<number | null>(null);
  let editAmount = $state(0);

  // Format currency
  function formatCurrency(amount: number): string {
    return `${amount.toFixed(0)} ج.م`;
  }

  // Format GB
  function formatGB(gb: number): string {
    return `${gb.toFixed(1)} GB`;
  }

  // Chart data derived from server data
  const revenueChartLabels = $derived(data.charts.revenue.map(d => d.label));
  const revenueChartData = $derived(data.charts.revenue.map(d => d.value));

  const profitChartLabels = $derived(data.charts.profit.map(d => d.label));
  const profitChartData = $derived(data.charts.profit.map(d => d.value));

  const packageChartLabels = $derived(data.charts.salesByPackage.map(d => d.packageName));
  const packageChartData = $derived(data.charts.salesByPackage.map(d => d.count));

  const dataUsageLabels = $derived(data.charts.dataUsage.map(d => d.label));
  const dataUsageDatasets = $derived([
    { label: 'المباع', data: data.charts.dataUsage.map(d => d.sold), color: '#22d3ee' },
    { label: 'المستهلك', data: data.charts.dataUsage.map(d => d.used), color: '#a78bfa' }
  ]);

  // Calculate costs
  const dataSoldCost = $derived(data.summary.dataSoldGB * data.costPerGb);
  const dataUsedCost = $derived(data.summary.dataUsedGB * data.costPerGb);

  // Stats cards
  const stats = $derived([
    {
      title: 'الكروت المباعة',
      value: data.summary.vouchersSold,
      subtitle: 'كرت',
      icon: Package,
      color: 'primary'
    },
    {
      title: 'الإيرادات',
      value: formatCurrency(data.summary.revenue),
      subtitle: 'إجمالي المبيعات',
      icon: Banknote,
      color: 'success'
    },
    {
      title: 'صافي الربح',
      value: formatCurrency(data.summary.netProfit),
      subtitle: `تكلفة البيانات: ${formatCurrency(dataSoldCost)}`,
      icon: data.summary.netProfit >= 0 ? TrendingUp : TrendingDown,
      color: data.summary.netProfit >= 0 ? 'success' : 'danger'
    },
    {
      title: 'البيانات المباعة',
      value: formatGB(data.summary.dataSoldGB),
      subtitle: `التكلفة: ${formatCurrency(dataSoldCost)}`,
      icon: HardDrive,
      color: 'warning'
    },
    {
      title: 'البيانات المستهلكة',
      value: formatGB(data.summary.dataUsedGB),
      subtitle: `التكلفة: ${formatCurrency(dataUsedCost)}`,
      icon: HardDrive,
      color: 'info'
    }
  ]);

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
    editingExpense = expense.id;
    editAmount = expense.amount / 100; // Convert from piasters
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
        <p class="page-subtitle">تتبع المبيعات والأرباح والمصروفات</p>
      </div>

      <!-- Period Selector -->
      <div class="period-tabs">
        {#each periods as period}
          <button
            class="period-tab {data.period === period.id ? 'active' : ''}"
            onclick={() => selectPeriod(period.id)}
          >
            {period.label}
          </button>
        {/each}
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
        </div>
      </div>
    {/each}
  </div>

  <!-- Charts Section -->
  <div class="charts-grid">
    <!-- Revenue Chart -->
    <div class="glass-card chart-card opacity-0 animate-fade-in" style="animation-delay: 500ms">
      <div class="chart-header">
        <h3 class="chart-title">
          <Banknote class="w-5 h-5 inline-block ml-2" />
          الإيرادات
        </h3>
      </div>
      <div class="chart-content">
        {#if browser && revenueChartData.length > 0}
          <LineChart
            labels={revenueChartLabels}
            data={revenueChartData}
            label="الإيرادات (ج.م)"
            color="#34d399"
            fillColor="rgba(52, 211, 153, 0.1)"
          />
        {:else if revenueChartData.length === 0}
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
    <div class="glass-card chart-card opacity-0 animate-fade-in" style="animation-delay: 600ms">
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

    <!-- Sales by Package Chart -->
    <div class="glass-card chart-card opacity-0 animate-fade-in" style="animation-delay: 700ms">
      <div class="chart-header">
        <h3 class="chart-title">
          <PieChart class="w-5 h-5 inline-block ml-2" />
          المبيعات حسب الباقة
        </h3>
      </div>
      <div class="chart-content">
        {#if browser && packageChartData.length > 0}
          <DonutChart
            labels={packageChartLabels}
            data={packageChartData}
          />
        {:else if packageChartData.length === 0}
          <div class="chart-empty">
            <PieChart class="w-12 h-12 text-text-secondary opacity-50" />
            <p>لا توجد مبيعات</p>
          </div>
        {:else}
          <div class="chart-loading">جاري التحميل...</div>
        {/if}
      </div>
    </div>

    <!-- Data Usage Comparison -->
    <div class="glass-card chart-card opacity-0 animate-fade-in" style="animation-delay: 800ms">
      <div class="chart-header">
        <h3 class="chart-title">
          <HardDrive class="w-5 h-5 inline-block ml-2" />
          البيانات: المباعة vs المستهلكة
        </h3>
      </div>
      <div class="chart-content">
        {#if browser && dataUsageLabels.length > 0}
          <BarChartComponent
            labels={dataUsageLabels}
            datasets={dataUsageDatasets}
          />
        {:else if dataUsageLabels.length === 0}
          <div class="chart-empty">
            <HardDrive class="w-12 h-12 text-text-secondary opacity-50" />
            <p>لا توجد بيانات</p>
          </div>
        {:else}
          <div class="chart-loading">جاري التحميل...</div>
        {/if}
      </div>
    </div>
  </div>

  <!-- Expense Management Section -->
  <section class="expenses-section glass-card opacity-0 animate-fade-in" style="animation-delay: 900ms">
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

    <!-- Cost Summary -->
    <div class="cost-summary">
      <div class="cost-item">
        <span class="cost-label">تكلفة الجيجا</span>
        <span class="cost-value">{formatCurrency(data.costPerGb)}</span>
      </div>
      <div class="cost-item">
        <span class="cost-label">المصروفات الثابتة (شهري)</span>
        <span class="cost-value">{formatCurrency(data.monthlyFixed)}</span>
      </div>
    </div>

    <!-- Expenses Table -->
    <div class="table-container">
      <table class="table-modern">
        <thead>
          <tr>
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
                <span class="badge {expense.type === 'per_gb' ? 'badge-primary' : 'badge-neutral'}">
                  {expense.type === 'per_gb' ? 'لكل جيجا' : 'شهري ثابت'}
                </span>
              </td>
              <td>{expense.nameAr}</td>
              <td>
                {#if editingExpense === expense.id}
                  <form method="POST" action="?/updateExpense" use:enhance>
                    <input type="hidden" name="id" value={expense.id} />
                    <input type="hidden" name="isActive" value={expense.isActive ? 'true' : 'false'} />
                    <div class="flex items-center gap-2">
                      <input
                        type="number"
                        name="amount"
                        bind:value={editAmount}
                        step="0.01"
                        class="input-modern w-24"
                      />
                      <span class="text-text-secondary">ج.م</span>
                      <button type="submit" class="btn-icon btn-success">
                        <Check class="w-4 h-4" />
                      </button>
                      <button type="button" class="btn-icon btn-neutral" onclick={cancelEdit}>
                        <X class="w-4 h-4" />
                      </button>
                    </div>
                  </form>
                {:else}
                  {formatCurrency(expense.amount / 100)}
                {/if}
              </td>
              <td>
                <form method="POST" action="?/updateExpense" use:enhance>
                  <input type="hidden" name="id" value={expense.id} />
                  <input type="hidden" name="amount" value={expense.amount / 100} />
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
                    <input type="hidden" name="id" value={expense.id} />
                    <button type="submit" class="btn-icon btn-danger" title="حذف">
                      <Trash2 class="w-4 h-4" />
                    </button>
                  </form>
                </div>
              </td>
            </tr>
          {:else}
            <tr>
              <td colspan="5" class="text-center text-text-secondary py-8">
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

  .period-tabs {
    display: flex;
    flex-direction: row-reverse;
    background: var(--bg-glass);
    border-radius: 0.75rem;
    padding: 0.25rem;
    border: 1px solid var(--border-glass);
  }

  .period-tab {
    padding: 0.5rem 1.25rem;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-secondary);
    transition: all 0.2s ease;
    background: transparent;
    border: none;
    cursor: pointer;
  }

  .period-tab:hover {
    color: #f1f5f9;
    background: rgba(34, 211, 238, 0.1);
  }

  .period-tab.active {
    background: #0891b2 !important;
    color: white !important;
    box-shadow: 0 0 12px rgba(34, 211, 238, 0.3);
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 1rem;
  }

  /* Stat Card Styles */
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

  .stat-icon-info {
    background: rgba(167, 139, 250, 0.15);
    color: #a78bfa;
    border: 1px solid rgba(167, 139, 250, 0.3);
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
