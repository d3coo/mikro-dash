<script lang="ts">
  import { enhance } from '$app/forms';
  import { Button } from '$lib/components/ui/button';
  import ConfirmModal from '$lib/components/confirm-modal.svelte';
  import { Plus, Trash2, Printer, Package, Filter, CheckCircle, XCircle, Clock, Loader2, CloudOff, RefreshCw, Cloud } from 'lucide-svelte';
  import { toast } from 'svelte-sonner';

  let { data, form } = $props();

  // Show toast notifications for form results
  $effect(() => {
    if (form?.success) {
      if (form.created) {
        toast.success(`تم إنشاء ${form.created} كرت بنجاح`);
      }
      if (form.deleted) {
        toast.success(`تم حذف ${form.deleted} كرت بنجاح`);
      }
      if (form.syncResult) {
        if (form.syncResult.synced > 0) {
          toast.success(`تم مزامنة ${form.syncResult.synced} كرت`);
        }
        if (form.syncResult.failed > 0) {
          toast.warning(`فشل في مزامنة ${form.syncResult.failed} كرت`);
        }
      }
    }
    if (form?.error) {
      toast.error(form.error);
    }
  });

  let selectedPackage = $state('');
  let quantity = $state(10);
  let selectedIds = $state<string[]>([]);
  let statusFilter = $state('all');
  let isGenerating = $state(false);
  let isDeleting = $state(false);
  let isSyncing = $state(false);
  let showDeleteModal = $state(false);
  let deleteFormEl: HTMLFormElement;

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

  <!-- Unsynced Warning -->
  {#if data.unsyncedCount > 0}
    <div class="alert alert-warning opacity-0 animate-fade-in" style="animation-delay: 100ms">
      <CloudOff class="w-5 h-5" />
      <span>يوجد {data.unsyncedCount} كرت غير متزامن مع الراوتر</span>
      <form
        method="POST"
        action="?/sync"
        use:enhance={() => {
          isSyncing = true;
          return async ({ update }) => {
            await update();
            isSyncing = false;
          };
        }}
        class="inline-block me-auto"
      >
        <Button type="submit" size="sm" disabled={isSyncing}>
          {#if isSyncing}
            <Loader2 class="w-4 h-4 animate-spin" />
            <span>جاري المزامنة...</span>
          {:else}
            <RefreshCw class="w-4 h-4" />
            <span>مزامنة الكل</span>
          {/if}
        </Button>
      </form>
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
            <th>المزامنة</th>
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
                {#if voucher.synced}
                  <span class="badge badge-success">
                    <Cloud class="w-3 h-3" />
                    متزامن
                  </span>
                {:else}
                  <span class="badge badge-warning">
                    <CloudOff class="w-3 h-3" />
                    غير متزامن
                  </span>
                {/if}
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

<ConfirmModal
  bind:open={showDeleteModal}
  title="تأكيد الحذف"
  message="هل أنت متأكد من حذف {selectedIds.length} كرت؟ لا يمكن التراجع عن هذا الإجراء."
  confirmText="حذف"
  cancelText="إلغاء"
  variant="destructive"
  onConfirm={() => deleteFormEl.requestSubmit()}
/>

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
