<script lang="ts">
  import { Coffee, ShoppingBag, Trash2, Plus, Minus, DollarSign, Clock, Package } from 'lucide-svelte';
  import { enhance } from '$app/forms';
  import { toast } from 'svelte-sonner';

  let { data, form } = $props();

  let selectedItemId = $state<number | null>(null);
  let quantity = $state(1);

  // Format currency (piasters to EGP)
  function formatCurrency(piasters: number): string {
    return `${(piasters / 100).toFixed(0)} ج.م`;
  }

  // Format time
  function formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Group menu items by category
  const menuByCategory = $derived(() => {
    const grouped = new Map<string, typeof data.menuItems>();
    for (const item of data.menuItems) {
      const cat = item.category;
      if (!grouped.has(cat)) {
        grouped.set(cat, []);
      }
      grouped.get(cat)!.push(item);
    }
    return grouped;
  });

  const categoryLabels: Record<string, string> = {
    drinks: 'مشروبات',
    food: 'طعام',
    snacks: 'وجبات خفيفة'
  };

  const categoryIcons: Record<string, string> = {
    drinks: '☕',
    food: '🍔',
    snacks: '🍿'
  };

  function selectItem(itemId: number) {
    if (selectedItemId === itemId) {
      selectedItemId = null;
      quantity = 1;
    } else {
      selectedItemId = itemId;
      quantity = 1;
    }
  }

  function incrementQuantity() {
    quantity = Math.min(quantity + 1, 99);
  }

  function decrementQuantity() {
    quantity = Math.max(quantity - 1, 1);
  }

  // Show toast for form results
  $effect(() => {
    if (form?.success) {
      toast.success(form.message || 'تمت العملية بنجاح');
      selectedItemId = null;
      quantity = 1;
    } else if (form?.error) {
      toast.error(form.error);
    }
  });

  const selectedItem = $derived(data.menuItems.find((item: any) => item.id === selectedItemId));
</script>

<div class="fnb-page">
  <!-- Page Header -->
  <header class="page-header opacity-0 animate-fade-in">
    <div>
      <h1 class="page-title">
        <Coffee class="w-6 h-6 inline-block ml-2" />
        مبيعات المأكولات والمشروبات
      </h1>
      <p class="page-subtitle">تسجيل المبيعات المستقلة (غير مرتبطة بـ PlayStation)</p>
    </div>
  </header>

  <!-- Stats Row -->
  <div class="stats-grid">
    <div class="stat-card glass-card opacity-0 animate-fade-in" style="animation-delay: 100ms">
      <div class="stat-header">
        <span class="stat-title">إيرادات اليوم</span>
        <div class="stat-icon-wrapper stat-icon-success">
          <DollarSign class="stat-icon w-5 h-5" />
        </div>
      </div>
      <div class="stat-value">{formatCurrency(data.revenue)}</div>
      <div class="stat-footer">
        <span class="stat-subtitle">مبيعات مستقلة</span>
      </div>
    </div>

    <div class="stat-card glass-card opacity-0 animate-fade-in" style="animation-delay: 200ms">
      <div class="stat-header">
        <span class="stat-title">عناصر مباعة</span>
        <div class="stat-icon-wrapper stat-icon-primary">
          <Package class="stat-icon w-5 h-5" />
        </div>
      </div>
      <div class="stat-value">{data.totalItems}</div>
      <div class="stat-footer">
        <span class="stat-subtitle">عنصر اليوم</span>
      </div>
    </div>
  </div>

  <div class="fnb-layout">
    <!-- Quick Sale Section -->
    <section class="sale-section glass-card opacity-0 animate-fade-in" style="animation-delay: 300ms">
      <h2 class="section-title">
        <ShoppingBag class="w-5 h-5 inline-block ml-2" />
        تسجيل بيع جديد
      </h2>

      <!-- Menu Items Grid -->
      <div class="menu-grid">
        {#each menuByCategory() as [category, items]}
          <div class="menu-category">
            <h3 class="category-title">
              <span class="category-icon">{categoryIcons[category] || '📦'}</span>
              {categoryLabels[category] || category}
            </h3>
            <div class="items-grid">
              {#each items as item}
                <button
                  type="button"
                  class="menu-item {selectedItemId === item.id ? 'selected' : ''}"
                  onclick={() => selectItem(item.id)}
                >
                  <span class="item-name">{item.nameAr}</span>
                  <span class="item-price">{formatCurrency(item.price)}</span>
                </button>
              {/each}
            </div>
          </div>
        {/each}
      </div>

      <!-- Selected Item & Quantity -->
      {#if selectedItem}
        <div class="selected-item-section">
          <div class="selected-info">
            <span class="selected-name">{selectedItem.nameAr}</span>
            <span class="selected-price">{formatCurrency(selectedItem.price * quantity)}</span>
          </div>

          <div class="quantity-control">
            <button type="button" class="qty-btn" onclick={decrementQuantity} disabled={quantity <= 1}>
              <Minus class="w-4 h-4" />
            </button>
            <span class="qty-value">{quantity}</span>
            <button type="button" class="qty-btn" onclick={incrementQuantity}>
              <Plus class="w-4 h-4" />
            </button>
          </div>

          <form method="POST" action="?/recordSale" use:enhance>
            <input type="hidden" name="menuItemId" value={selectedItem.id} />
            <input type="hidden" name="quantity" value={quantity} />
            <button type="submit" class="btn-primary-full">
              <Plus class="w-5 h-5" />
              تسجيل البيع
            </button>
          </form>
        </div>
      {:else}
        <div class="no-selection">
          <ShoppingBag class="w-10 h-10 opacity-30" />
          <p>اختر عنصراً من القائمة لتسجيل بيع</p>
        </div>
      {/if}
    </section>

    <!-- Today's Sales List -->
    <section class="summary-section glass-card opacity-0 animate-fade-in" style="animation-delay: 400ms">
      <!-- Sales Summary by Item -->
      {#if data.salesSummary.length > 0}
        <div class="sales-summary">
          <h3 class="summary-title">
            <Package class="w-4 h-4 inline-block ml-1" />
            ملخص المبيعات
          </h3>
          <div class="summary-list">
            {#each data.salesSummary as item}
              <div class="summary-item">
                <span class="item-name">{item.name}</span>
                <span class="item-qty">×{item.quantity}</span>
                <span class="item-total">{formatCurrency(item.total)}</span>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Recent Sales -->
      <h3 class="section-subtitle">
        <Clock class="w-4 h-4 inline-block ml-1" />
        مبيعات اليوم
      </h3>

      {#if data.sales.length > 0}
        <div class="sales-list">
          {#each data.sales as sale}
            <div class="sale-item">
              <div class="sale-info">
                <span class="sale-name">{sale.menuItem?.nameAr || 'غير معروف'}</span>
                <span class="sale-meta">
                  {formatTime(sale.soldAt)} · ×{sale.quantity}
                </span>
              </div>
              <div class="sale-actions">
                <span class="sale-price">{formatCurrency(sale.priceSnapshot * sale.quantity)}</span>
                <form method="POST" action="?/deleteSale" use:enhance>
                  <input type="hidden" name="id" value={sale.id} />
                  <button type="submit" class="btn-icon-danger" title="حذف">
                    <Trash2 class="w-4 h-4" />
                  </button>
                </form>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <div class="no-sales">
          <Coffee class="w-12 h-12 opacity-30" />
          <p>لا توجد مبيعات مستقلة اليوم</p>
          <span class="no-sales-hint">المبيعات المرتبطة بـ PlayStation تظهر في صفحة PlayStation</span>
        </div>
      {/if}
    </section>
  </div>
</div>

<style>
  .fnb-page {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  /* Stats Grid */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    max-width: 500px;
  }

  .stat-card {
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .stat-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .stat-title {
    font-size: 0.8125rem;
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

  .stat-icon-success {
    background: rgba(16, 185, 129, 0.15);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }

  .stat-icon-primary {
    background: rgba(8, 145, 178, 0.15);
    color: var(--color-primary-light);
    border: 1px solid rgba(8, 145, 178, 0.3);
  }

  .stat-value {
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--color-text-primary);
    line-height: 1;
  }

  .stat-footer {
    display: flex;
    align-items: center;
  }

  .stat-subtitle {
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }

  /* Layout */
  .fnb-layout {
    display: grid;
    grid-template-columns: 1fr 380px;
    gap: 1.5rem;
  }

  @media (max-width: 1024px) {
    .fnb-layout {
      grid-template-columns: 1fr;
    }
  }

  .sale-section,
  .summary-section {
    padding: 1.5rem;
  }

  .section-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--color-text-primary);
    display: flex;
    align-items: center;
    margin-bottom: 1.5rem;
  }

  .section-subtitle {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--color-text-primary);
    display: flex;
    align-items: center;
    margin-bottom: 1rem;
    margin-top: 1.5rem;
  }

  /* Menu Grid */
  .menu-grid {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .menu-category {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .category-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text-secondary);
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .category-icon {
    font-size: 1rem;
  }

  .items-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: 0.75rem;
  }

  .menu-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.375rem;
    padding: 1rem 0.75rem;
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .menu-item:hover {
    background: rgba(34, 211, 238, 0.1);
    border-color: rgba(34, 211, 238, 0.3);
    transform: translateY(-2px);
  }

  .menu-item.selected {
    background: rgba(34, 211, 238, 0.15);
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px rgba(34, 211, 238, 0.2);
  }

  .menu-item .item-name {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text-primary);
    text-align: center;
  }

  .menu-item .item-price {
    font-size: 0.75rem;
    color: var(--color-primary-light);
    font-weight: 600;
  }

  /* Selected Item Section */
  .selected-item-section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1.25rem;
    background: rgba(34, 211, 238, 0.08);
    border: 1px solid rgba(34, 211, 238, 0.2);
    border-radius: 12px;
    margin-top: 1.5rem;
  }

  .selected-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .selected-name {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .selected-price {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--color-primary-light);
  }

  .quantity-control {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
  }

  .qty-btn {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    color: var(--color-text-primary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }

  .qty-btn:hover:not(:disabled) {
    background: var(--color-primary);
    color: white;
    border-color: var(--color-primary);
  }

  .qty-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .qty-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-text-primary);
    min-width: 3rem;
    text-align: center;
  }

  .btn-primary-full {
    width: 100%;
    padding: 0.875rem 1.5rem;
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: 10px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    transition: all 0.2s ease;
  }

  .btn-primary-full:hover {
    background: var(--color-primary-dark);
    transform: translateY(-1px);
  }

  .no-selection {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    color: var(--color-text-secondary);
    gap: 0.75rem;
    margin-top: 1.5rem;
    background: var(--color-bg-elevated);
    border-radius: 12px;
    border: 1px dashed var(--color-border);
  }

  /* Sales Summary */
  .sales-summary {
    padding: 1rem;
    background: var(--color-bg-elevated);
    border-radius: 12px;
    border: 1px solid var(--color-border);
  }

  .summary-title {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-text-secondary);
    margin-bottom: 0.75rem;
    display: flex;
    align-items: center;
  }

  .summary-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .summary-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--color-border);
  }

  .summary-item:last-child {
    border-bottom: none;
  }

  .summary-item .item-name {
    flex: 1;
    color: var(--color-text-primary);
  }

  .summary-item .item-qty {
    color: var(--color-text-secondary);
    font-size: 0.8125rem;
  }

  .summary-item .item-total {
    font-weight: 600;
    color: var(--color-primary-light);
  }

  /* Sales List */
  .sales-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-height: 400px;
    overflow-y: auto;
  }

  .sale-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.875rem;
    background: var(--color-bg-elevated);
    border-radius: 10px;
    border: 1px solid var(--color-border);
    transition: all 0.2s ease;
  }

  .sale-item:hover {
    border-color: var(--color-border-strong);
  }

  .sale-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .sale-name {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .sale-meta {
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }

  .sale-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .sale-price {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--color-primary-light);
  }

  .btn-icon-danger {
    padding: 0.375rem;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    transition: all 0.2s ease;
    background: rgba(239, 68, 68, 0.1);
    color: var(--color-danger);
  }

  .btn-icon-danger:hover {
    background: rgba(239, 68, 68, 0.2);
  }

  .no-sales {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    color: var(--color-text-secondary);
    gap: 0.75rem;
    background: var(--color-bg-elevated);
    border-radius: 12px;
    border: 1px dashed var(--color-border);
  }

  .no-sales-hint {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    text-align: center;
  }
</style>
