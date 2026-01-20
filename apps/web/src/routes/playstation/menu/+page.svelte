<script lang="ts">
  import { UtensilsCrossed, Plus, Pencil, Trash2, ArrowRight, Save, X, AlertTriangle, Coffee, Pizza, Cookie } from 'lucide-svelte';
  import { toast } from 'svelte-sonner';
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import Modal from '$lib/components/modal.svelte';

  let { data } = $props();

  // Modal state
  let showAddModal = $state(false);
  let showEditModal = $state(false);
  let showDeleteModal = $state(false);
  let selectedItem = $state<typeof data.menuItems[0] | null>(null);

  // Form state
  let formName = $state('');
  let formNameAr = $state('');
  let formCategory = $state('drinks');
  let formPrice = $state(5);
  let formIsAvailable = $state(true);

  function openAddModal() {
    formName = '';
    formNameAr = '';
    formCategory = 'drinks';
    formPrice = 5;
    formIsAvailable = true;
    showAddModal = true;
  }

  function openEditModal(item: typeof data.menuItems[0]) {
    selectedItem = item;
    formName = item.name;
    formNameAr = item.nameAr;
    formCategory = item.category;
    formPrice = item.price / 100; // Convert from piasters to EGP
    formIsAvailable = item.isAvailable === 1;
    showEditModal = true;
  }

  function openDeleteModal(item: typeof data.menuItems[0]) {
    selectedItem = item;
    showDeleteModal = true;
  }

  function closeModals() {
    showAddModal = false;
    showEditModal = false;
    showDeleteModal = false;
    selectedItem = null;
  }

  // Category labels
  const categoryLabels: Record<string, string> = {
    drinks: 'مشروبات',
    food: 'طعام',
    snacks: 'وجبات خفيفة'
  };

  const categoryIcons: Record<string, typeof Coffee> = {
    drinks: Coffee,
    food: Pizza,
    snacks: Cookie
  };

  // Format price from piasters to EGP
  function formatPrice(piasters: number): string {
    return (piasters / 100).toFixed(0);
  }
</script>

<div class="menu-page">
  <!-- Page Header -->
  <header class="page-header opacity-0 animate-fade-in">
    <div class="header-content">
      <div class="header-title">
        <a href="/playstation" class="back-btn">
          <ArrowRight class="w-5 h-5" />
        </a>
        <div>
          <h1 class="page-title">
            <UtensilsCrossed class="w-6 h-6 inline-block ml-2 text-primary-light" />
            قائمة الطعام والمشروبات
          </h1>
          <p class="page-subtitle">إدارة الأصناف المتاحة للطلب</p>
        </div>
      </div>
      <button class="btn btn-primary" onclick={openAddModal}>
        <Plus class="w-4 h-4" />
        إضافة صنف
      </button>
    </div>
  </header>

  <!-- Menu Categories -->
  {#each ['drinks', 'food', 'snacks'] as category}
    {@const items = data.categories[category as keyof typeof data.categories]}
    {@const CategoryIcon = categoryIcons[category]}
    <section class="category-section glass-card opacity-0 animate-fade-in" style="animation-delay: {['drinks', 'food', 'snacks'].indexOf(category) * 100 + 100}ms">
      <div class="category-header">
        <div class="category-title">
          <div class="category-icon">
            <CategoryIcon class="w-5 h-5" />
          </div>
          <h2>{categoryLabels[category]}</h2>
          <span class="badge badge-neutral">{items.length}</span>
        </div>
      </div>

      {#if items.length > 0}
        <div class="items-grid">
          {#each items as item}
            <div class="item-card" class:unavailable={!item.isAvailable}>
              <div class="item-info">
                <h3>{item.nameAr}</h3>
                <span class="item-name-en">{item.name}</span>
              </div>
              <div class="item-price">
                {formatPrice(item.price)} ج.م
              </div>
              <div class="item-actions">
                {#if !item.isAvailable}
                  <span class="badge badge-danger">غير متاح</span>
                {/if}
                <button
                  class="btn-icon btn-icon-primary"
                  onclick={() => openEditModal(item)}
                  title="تعديل"
                >
                  <Pencil class="w-4 h-4" />
                </button>
                <button
                  class="btn-icon btn-icon-danger"
                  onclick={() => openDeleteModal(item)}
                  title="حذف"
                >
                  <Trash2 class="w-4 h-4" />
                </button>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <div class="empty-category">
          <p>لا توجد أصناف في هذه الفئة</p>
        </div>
      {/if}
    </section>
  {/each}
</div>

<!-- Add Item Modal -->
<Modal bind:open={showAddModal} onClose={closeModals}>
  {#snippet header()}
    <div class="modal-header">
      <h3>
        <Plus class="w-5 h-5 text-primary-light" />
        إضافة صنف جديد
      </h3>
      <button class="modal-close-btn" onclick={closeModals}>
        <X class="w-5 h-5" />
      </button>
    </div>
  {/snippet}

  <form
    method="POST"
    action="?/create"
    use:enhance={() => {
      return async ({ result }) => {
        if (result.type === 'success') {
          toast.success('تم إضافة الصنف بنجاح');
          closeModals();
          await invalidateAll();
        } else if (result.type === 'failure') {
          toast.error(result.data?.error as string || 'فشل في إضافة الصنف');
        }
      };
    }}
    class="form-grid"
  >
    <div class="form-group">
      <label for="add-name">الاسم (إنجليزي)</label>
      <input
        type="text"
        id="add-name"
        name="name"
        bind:value={formName}
        class="input-modern"
        placeholder="Pepsi"
        required
      />
    </div>

    <div class="form-group">
      <label for="add-nameAr">الاسم بالعربية</label>
      <input
        type="text"
        id="add-nameAr"
        name="nameAr"
        bind:value={formNameAr}
        class="input-modern"
        placeholder="بيبسي"
        required
      />
    </div>

    <div class="form-group">
      <label for="add-category">الفئة</label>
      <select
        id="add-category"
        name="category"
        bind:value={formCategory}
        class="select-modern"
      >
        <option value="drinks">مشروبات</option>
        <option value="food">طعام</option>
        <option value="snacks">وجبات خفيفة</option>
      </select>
    </div>

    <div class="form-group">
      <label for="add-price">السعر (ج.م)</label>
      <input
        type="number"
        id="add-price"
        name="price"
        bind:value={formPrice}
        class="input-modern"
        min="1"
        required
      />
    </div>

    <div class="form-actions">
      <button type="button" class="btn btn-secondary" onclick={closeModals}>
        إلغاء
      </button>
      <button type="submit" class="btn btn-primary">
        <Save class="w-4 h-4" />
        حفظ
      </button>
    </div>
  </form>
</Modal>

<!-- Edit Item Modal -->
<Modal bind:open={showEditModal} onClose={closeModals}>
  {#snippet header()}
    <div class="modal-header">
      <h3>
        <Pencil class="w-5 h-5 text-primary-light" />
        تعديل الصنف
      </h3>
      <button class="modal-close-btn" onclick={closeModals}>
        <X class="w-5 h-5" />
      </button>
    </div>
  {/snippet}

  <form
    method="POST"
    action="?/update"
    use:enhance={() => {
      return async ({ result }) => {
        if (result.type === 'success') {
          toast.success('تم تحديث الصنف بنجاح');
          closeModals();
          await invalidateAll();
        } else if (result.type === 'failure') {
          toast.error(result.data?.error as string || 'فشل في تحديث الصنف');
        }
      };
    }}
    class="form-grid"
  >
    <input type="hidden" name="id" value={selectedItem?.id} />

    <div class="form-group">
      <label for="edit-name">الاسم (إنجليزي)</label>
      <input
        type="text"
        id="edit-name"
        name="name"
        bind:value={formName}
        class="input-modern"
        required
      />
    </div>

    <div class="form-group">
      <label for="edit-nameAr">الاسم بالعربية</label>
      <input
        type="text"
        id="edit-nameAr"
        name="nameAr"
        bind:value={formNameAr}
        class="input-modern"
        required
      />
    </div>

    <div class="form-group">
      <label for="edit-category">الفئة</label>
      <select
        id="edit-category"
        name="category"
        bind:value={formCategory}
        class="select-modern"
      >
        <option value="drinks">مشروبات</option>
        <option value="food">طعام</option>
        <option value="snacks">وجبات خفيفة</option>
      </select>
    </div>

    <div class="form-group">
      <label for="edit-price">السعر (ج.م)</label>
      <input
        type="number"
        id="edit-price"
        name="price"
        bind:value={formPrice}
        class="input-modern"
        min="1"
        required
      />
    </div>

    <div class="form-group">
      <label class="checkbox-label">
        <input
          type="checkbox"
          name="isAvailable"
          bind:checked={formIsAvailable}
          value="true"
        />
        <span>متاح للطلب</span>
      </label>
      <input type="hidden" name="isAvailable" value={formIsAvailable ? 'true' : 'false'} />
    </div>

    <div class="form-actions">
      <button type="button" class="btn btn-secondary" onclick={closeModals}>
        إلغاء
      </button>
      <button type="submit" class="btn btn-primary">
        <Save class="w-4 h-4" />
        حفظ التغييرات
      </button>
    </div>
  </form>
</Modal>

<!-- Delete Confirmation Modal -->
<Modal bind:open={showDeleteModal} onClose={closeModals}>
  {#snippet header()}
    <div class="modal-header">
      <h3>
        <Trash2 class="w-5 h-5 text-danger" />
        حذف الصنف
      </h3>
      <button class="modal-close-btn" onclick={closeModals}>
        <X class="w-5 h-5" />
      </button>
    </div>
  {/snippet}

  <div class="delete-confirmation">
    <AlertTriangle class="w-12 h-12 text-warning" />
    <p>هل أنت متأكد من حذف <strong>{selectedItem?.nameAr}</strong>؟</p>

    <form
      method="POST"
      action="?/delete"
      use:enhance={() => {
        return async ({ result }) => {
          if (result.type === 'success') {
            toast.success('تم حذف الصنف');
            closeModals();
            await invalidateAll();
          } else if (result.type === 'failure') {
            toast.error(result.data?.error as string || 'فشل في حذف الصنف');
          }
        };
      }}
      class="form-actions"
    >
      <input type="hidden" name="id" value={selectedItem?.id} />
      <button type="button" class="btn btn-secondary" onclick={closeModals}>
        إلغاء
      </button>
      <button type="submit" class="btn btn-danger">
        <Trash2 class="w-4 h-4" />
        حذف
      </button>
    </form>
  </div>
</Modal>

<style>
  .menu-page {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .header-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 16px;
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

  /* Category Section */
  .category-section {
    padding: 20px;
  }

  .category-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }

  .category-title {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .category-title h2 {
    font-size: 18px;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .category-icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: rgba(8, 145, 178, 0.15);
    border: 1px solid rgba(8, 145, 178, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-primary-light);
  }

  /* Items Grid */
  .items-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 12px;
  }

  .item-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 10px;
    transition: all 0.2s ease;
  }

  .item-card:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .item-card.unavailable {
    opacity: 0.6;
  }

  .item-info {
    flex: 1;
    min-width: 0;
  }

  .item-info h3 {
    font-size: 15px;
    font-weight: 600;
    color: var(--color-text-primary);
    margin-bottom: 2px;
  }

  .item-name-en {
    font-size: 12px;
    color: var(--color-text-muted);
  }

  .item-price {
    font-size: 16px;
    font-weight: 700;
    color: #34d399;
    white-space: nowrap;
  }

  .item-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .empty-category {
    text-align: center;
    padding: 24px;
    color: var(--color-text-muted);
  }

  /* Button Icons */
  .btn-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-icon-primary {
    background: rgba(8, 145, 178, 0.1);
    color: var(--color-primary-light);
  }

  .btn-icon-primary:hover {
    background: rgba(8, 145, 178, 0.2);
  }

  .btn-icon-danger {
    background: rgba(239, 68, 68, 0.1);
    color: #f87171;
  }

  .btn-icon-danger:hover {
    background: rgba(239, 68, 68, 0.2);
  }

  /* Form Styles */
  .form-grid {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 20px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .form-group label {
    font-size: 14px;
    font-weight: 500;
    color: var(--color-text-secondary);
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 8px;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-size: 14px;
    color: var(--color-text-primary);
  }

  .checkbox-label input[type="checkbox"] {
    width: 18px;
    height: 18px;
    accent-color: var(--color-primary);
  }

  /* Delete Confirmation */
  .delete-confirmation {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding: 24px;
    text-align: center;
  }

  .delete-confirmation p {
    color: var(--color-text-primary);
    font-size: 15px;
  }

  .delete-confirmation strong {
    color: var(--color-primary-light);
  }

  /* Responsive */
  @media (max-width: 640px) {
    .items-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
