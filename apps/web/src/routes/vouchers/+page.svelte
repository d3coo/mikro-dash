<script lang="ts">
  import { enhance } from '$app/forms';
  import { Button } from '$lib/components/ui/button';
  import { Plus, Trash2, Printer, Package, Filter, CheckCircle, XCircle, Clock } from 'lucide-svelte';

  let { data, form } = $props();

  let selectedPackage = $state('');
  let quantity = $state(10);
  let selectedIds = $state<string[]>([]);
  let statusFilter = $state('all');

  let filteredVouchers = $derived(
    statusFilter === 'all'
      ? data.vouchers
      : data.vouchers.filter(v => v.status === statusFilter)
  );

  function toggleSelect(id: string) {
    if (selectedIds.includes(id)) {
      selectedIds = selectedIds.filter(i => i !== id);
    } else {
      selectedIds = [...selectedIds, id];
    }
  }

  function selectAll() {
    if (selectedIds.length === filteredVouchers.length) {
      selectedIds = [];
    } else {
      selectedIds = filteredVouchers.map(v => v.id);
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
    used: { label: 'مستخدم', class: 'badge-neutral', icon: Clock },
    expired: { label: 'منتهي', class: 'badge-danger', icon: XCircle }
  };
</script>

<div class="vouchers-page">
  <!-- Page Header -->
  <header class="page-header opacity-0 animate-fade-in">
    <div class="flex items-center justify-between flex-wrap gap-4">
      <div>
        <h1 class="page-title">الكروت</h1>
        <p class="page-subtitle">إنشاء وإدارة كروت الواي فاي</p>
      </div>
      <a href="/vouchers/print?ids={selectedIds.join(',')}" class="print-link">
        <Button variant="outline" disabled={selectedIds.length === 0}>
          <Printer class="w-4 h-4" />
          <span>طباعة ({selectedIds.length})</span>
        </Button>
      </a>
    </div>
  </header>

  <!-- Alerts -->
  {#if form?.error}
    <div class="alert alert-error opacity-0 animate-fade-in" style="animation-delay: 100ms">
      <XCircle class="w-5 h-5" />
      <span>{form.error}</span>
    </div>
  {/if}

  {#if form?.success}
    <div class="alert alert-success opacity-0 animate-fade-in" style="animation-delay: 100ms">
      <CheckCircle class="w-5 h-5" />
      <span>
        تم بنجاح! {form.created ? `تم إنشاء ${form.created} كرت` : ''}
        {form.deleted ? `تم حذف ${form.deleted} كرت` : ''}
      </span>
    </div>
  {/if}

  <!-- Generate Form -->
  <section class="generate-section glass-card opacity-0 animate-fade-in" style="animation-delay: 150ms">
    <div class="section-header">
      <Package class="w-5 h-5 text-primary-light" />
      <h2>إنشاء كروت جديدة</h2>
    </div>
    <form method="POST" action="?/generate" use:enhance class="generate-form">
      <div class="form-group flex-1">
        <label for="packageId">الباقة</label>
        <select
          id="packageId"
          name="packageId"
          bind:value={selectedPackage}
          class="select-modern w-full"
          required
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
        />
      </div>

      <Button type="submit" class="self-end">
        <Plus class="w-4 h-4" />
        <span>إنشاء</span>
      </Button>
    </form>
  </section>

  <!-- Vouchers List -->
  <section class="vouchers-list glass-card opacity-0 animate-fade-in" style="animation-delay: 200ms">
    <div class="list-header">
      <div class="list-title">
        <h2>قائمة الكروت</h2>
        <span class="count-badge">{filteredVouchers.length}</span>
      </div>
      <div class="list-actions">
        <div class="filter-group">
          <Filter class="w-4 h-4 text-text-muted" />
          <select bind:value={statusFilter} class="select-modern text-sm">
            <option value="all">الكل</option>
            <option value="available">متاح</option>
            <option value="used">مستخدم</option>
            <option value="expired">منتهي</option>
          </select>
        </div>

        {#if selectedIds.length > 0}
          <form method="POST" action="?/delete" use:enhance>
            {#each selectedIds as id}
              <input type="hidden" name="ids" value={id} />
            {/each}
            <Button type="submit" variant="destructive" size="sm">
              <Trash2 class="w-4 h-4" />
              <span>حذف ({selectedIds.length})</span>
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
                checked={selectedIds.length === filteredVouchers.length && filteredVouchers.length > 0}
                onchange={selectAll}
                class="checkbox-modern"
              />
            </th>
            <th>الكود</th>
            <th>كلمة المرور</th>
            <th>الباقة</th>
            <th>السعر</th>
            <th>الحالة</th>
            <th>تاريخ الإنشاء</th>
          </tr>
        </thead>
        <tbody>
          {#each filteredVouchers as voucher, index}
            {@const config = statusConfig[voucher.status]}
            <tr class="opacity-0 animate-fade-in" style="animation-delay: {250 + index * 30}ms">
              <td>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(voucher.id)}
                  onchange={() => toggleSelect(voucher.id)}
                  class="checkbox-modern"
                />
              </td>
              <td>
                <span class="font-mono text-primary-light">{voucher.id}</span>
              </td>
              <td>
                <span class="font-mono">{voucher.password}</span>
              </td>
              <td>{voucher.package}</td>
              <td>
                <span class="price">{voucher.priceLE} ج.م</span>
              </td>
              <td>
                <span class="badge {config.class}">
                  <config.icon class="w-3 h-3" />
                  {config.label}
                </span>
              </td>
              <td>
                <span class="date">{formatDate(voucher.createdAt)}</span>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>

      {#if filteredVouchers.length === 0}
        <div class="empty-state">
          <Package class="empty-state-icon" />
          <p class="empty-state-text">لا توجد كروت</p>
        </div>
      {/if}
    </div>
  </section>
</div>

<style>
  .vouchers-page {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .print-link {
    text-decoration: none;
  }

  /* Generate Section */
  .generate-section {
    padding: 24px;
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 20px;
  }

  .section-header h2 {
    font-size: 16px;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .generate-form {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    align-items: flex-end;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .form-group label {
    font-size: 13px;
    font-weight: 500;
    color: var(--color-text-secondary);
  }

  /* Vouchers List */
  .vouchers-list {
    padding: 0;
    overflow: hidden;
  }

  .list-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 16px;
    padding: 20px 24px;
    border-bottom: 1px solid var(--color-border);
  }

  .list-title {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .list-title h2 {
    font-size: 16px;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .count-badge {
    background: rgba(8, 145, 178, 0.15);
    color: var(--color-primary-light);
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 13px;
    font-weight: 600;
  }

  .list-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .filter-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .table-container {
    overflow-x: auto;
  }

  .table-modern {
    min-width: 800px;
  }

  .font-mono {
    font-family: var(--font-family-mono);
    font-size: 13px;
  }

  .price {
    font-weight: 600;
    color: var(--color-warning);
  }

  .date {
    font-size: 13px;
    color: var(--color-text-muted);
  }

  .text-primary-light {
    color: var(--color-primary-light);
  }
</style>
