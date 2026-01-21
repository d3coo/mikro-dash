<script lang="ts">
  import { Gamepad2, Plus, Pencil, Trash2, ArrowRight, Save, X, AlertTriangle, Wrench, Monitor, Wifi, WifiOff, Volume2 } from 'lucide-svelte';
  import { toast } from 'svelte-sonner';
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import Modal from '$lib/components/modal.svelte';

  let { data } = $props();

  // Modal state
  let showAddModal = $state(false);
  let showEditModal = $state(false);
  let showDeleteModal = $state(false);
  let selectedStation = $state<typeof data.stations[0] | null>(null);

  // Form state
  let formId = $state('');
  let formName = $state('');
  let formNameAr = $state('');
  let formMacAddress = $state('');
  let formHourlyRate = $state(20);
  let formStatus = $state('available');
  let formMonitorIp = $state('');
  let formMonitorPort = $state(8080);

  // Test connection state
  let testingConnection = $state<string | null>(null);

  function openAddModal() {
    formId = `PS-${String(data.stations.length + 1).padStart(2, '0')}`;
    formName = `Station ${data.stations.length + 1}`;
    formNameAr = `جهاز ${data.stations.length + 1}`;
    formMacAddress = '';
    formHourlyRate = 20;
    formMonitorIp = '';
    formMonitorPort = 8080;
    showAddModal = true;
  }

  function openEditModal(station: typeof data.stations[0]) {
    selectedStation = station;
    formId = station.id;
    formName = station.name;
    formNameAr = station.nameAr;
    formMacAddress = station.macAddress;
    formHourlyRate = station.hourlyRate / 100; // Convert from piasters to EGP
    formStatus = station.status;
    formMonitorIp = station.monitorIp || '';
    formMonitorPort = station.monitorPort || 8080;
    showEditModal = true;
  }

  // Test monitor connection
  async function testMonitorConnection(ip: string, port: number, stationId: string) {
    if (!ip) {
      toast.error('أدخل عنوان IP للشاشة أولاً');
      return;
    }

    testingConnection = stationId;
    try {
      const response = await fetch('/api/playstation/kiosk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test', ip, port })
      });

      const result = await response.json();

      if (result.success) {
        toast.success('تم الاتصال بالشاشة بنجاح! ستسمع صوت تنبيه.');
      } else {
        toast.error(`فشل الاتصال: ${result.error || 'غير معروف'}`);
      }
    } catch (err) {
      toast.error('فشل في الاتصال بالشاشة');
    } finally {
      testingConnection = null;
    }
  }

  // Test form connection (from modal)
  async function testFormConnection() {
    await testMonitorConnection(formMonitorIp, formMonitorPort, 'form');
  }

  function openDeleteModal(station: typeof data.stations[0]) {
    selectedStation = station;
    showDeleteModal = true;
  }

  function closeModals() {
    showAddModal = false;
    showEditModal = false;
    showDeleteModal = false;
    selectedStation = null;
  }

  // Format MAC address as user types
  function formatMacAddress(event: Event) {
    const input = event.target as HTMLInputElement;
    let value = input.value.toUpperCase().replace(/[^0-9A-F]/g, '');

    // Insert colons every 2 characters
    const formatted = value.match(/.{1,2}/g)?.join(':').slice(0, 17) || '';
    formMacAddress = formatted;
  }

  // Get status badge class
  function getStatusClass(status: string): string {
    switch (status) {
      case 'available': return 'badge-success';
      case 'occupied': return 'badge-warning';
      case 'maintenance': return 'badge-danger';
      default: return 'badge-neutral';
    }
  }

  // Get status text
  function getStatusText(status: string): string {
    switch (status) {
      case 'available': return 'متاح';
      case 'occupied': return 'مشغول';
      case 'maintenance': return 'صيانة';
      default: return status;
    }
  }
</script>

<div class="settings-page">
  <!-- Page Header -->
  <header class="page-header opacity-0 animate-fade-in">
    <div class="header-content">
      <div class="header-title">
        <a href="/playstation" class="back-btn">
          <ArrowRight class="w-5 h-5" />
        </a>
        <div>
          <h1 class="page-title">
            <Gamepad2 class="w-6 h-6 inline-block ml-2 text-primary-light" />
            إعدادات الأجهزة
          </h1>
          <p class="page-subtitle">إدارة أجهزة PlayStation</p>
        </div>
      </div>
      <button class="btn btn-primary" onclick={openAddModal}>
        <Plus class="w-4 h-4" />
        إضافة جهاز
      </button>
    </div>
  </header>

  <!-- Stations List -->
  <div class="glass-card table-container opacity-0 animate-fade-in" style="animation-delay: 100ms">
    {#if data.stations.length > 0}
      <table class="table-modern">
        <thead>
          <tr>
            <th>المعرف</th>
            <th>الاسم</th>
            <th>MAC Address</th>
            <th>السعر/ساعة</th>
            <th>شاشة Android</th>
            <th>الحالة</th>
            <th>الإجراءات</th>
          </tr>
        </thead>
        <tbody>
          {#each data.stations as station}
            <tr>
              <td>
                <span class="font-mono text-primary-light">{station.id}</span>
              </td>
              <td>
                <div class="station-name">
                  <span>{station.name}</span>
                  <span class="name-ar">{station.nameAr}</span>
                </div>
              </td>
              <td>
                <span class="font-mono text-sm text-text-secondary">{station.macAddress}</span>
              </td>
              <td>
                <span class="font-mono">{(station.hourlyRate / 100).toFixed(0)} ج.م</span>
              </td>
              <td>
                {#if station.monitorIp}
                  <div class="monitor-info">
                    <span class="monitor-ip font-mono text-sm">{station.monitorIp}:{station.monitorPort || 8080}</span>
                    <button
                      class="btn-icon btn-icon-success btn-icon-sm"
                      onclick={() => testMonitorConnection(station.monitorIp!, station.monitorPort || 8080, station.id)}
                      disabled={testingConnection === station.id}
                      title="اختبار الاتصال"
                    >
                      {#if testingConnection === station.id}
                        <span class="loading-spinner"></span>
                      {:else}
                        <Volume2 class="w-3 h-3" />
                      {/if}
                    </button>
                  </div>
                {:else}
                  <span class="text-text-muted text-sm">غير مُعد</span>
                {/if}
              </td>
              <td>
                <span class="badge {getStatusClass(station.status)}">
                  {getStatusText(station.status)}
                </span>
              </td>
              <td>
                <div class="action-buttons">
                  <button
                    class="btn-icon btn-icon-primary"
                    onclick={() => openEditModal(station)}
                    title="تعديل"
                  >
                    <Pencil class="w-4 h-4" />
                  </button>
                  <button
                    class="btn-icon btn-icon-danger"
                    onclick={() => openDeleteModal(station)}
                    title="حذف"
                  >
                    <Trash2 class="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {:else}
      <div class="empty-state">
        <Gamepad2 class="empty-state-icon" />
        <p class="empty-state-text">لا توجد أجهزة مسجلة</p>
        <button class="btn btn-primary mt-4" onclick={openAddModal}>
          <Plus class="w-4 h-4" />
          إضافة أول جهاز
        </button>
      </div>
    {/if}
  </div>

  <!-- Info Card -->
  <div class="glass-card info-card opacity-0 animate-fade-in" style="animation-delay: 200ms">
    <h3>
      <AlertTriangle class="w-5 h-5 text-warning" />
      معلومات مهمة
    </h3>
    <ul>
      <li><strong>MAC Address:</strong> يمكنك إيجاده في إعدادات PlayStation تحت Network &gt; View Connection Status</li>
      <li><strong>الكشف التلقائي:</strong> سيتم تشغيل الجلسة تلقائياً عند اتصال الجهاز بالشبكة</li>
      <li><strong>فترة الانتظار:</strong> 3 دقائق قبل إنهاء الجلسة عند انقطاع الاتصال</li>
      <li><strong>وضع الصيانة:</strong> يمنع بدء جلسات جديدة على الجهاز</li>
    </ul>
  </div>
</div>

<!-- Add Station Modal -->
<Modal bind:open={showAddModal} onClose={closeModals}>
  {#snippet header()}
    <div class="modal-header">
      <h3>
        <Plus class="w-5 h-5 text-primary-light" />
        إضافة جهاز جديد
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
          toast.success('تم إضافة الجهاز بنجاح');
          closeModals();
          await invalidateAll();
        } else if (result.type === 'failure') {
          toast.error(result.data?.error as string || 'فشل في إضافة الجهاز');
        }
      };
    }}
    class="form-grid"
  >
    <div class="form-group">
      <label for="add-id">معرف الجهاز</label>
      <input
        type="text"
        id="add-id"
        name="id"
        bind:value={formId}
        class="input-modern"
        placeholder="PS-01"
        required
      />
    </div>

    <div class="form-group">
      <label for="add-name">الاسم (إنجليزي)</label>
      <input
        type="text"
        id="add-name"
        name="name"
        bind:value={formName}
        class="input-modern"
        placeholder="Station 1"
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
        placeholder="جهاز ١"
        required
      />
    </div>

    <div class="form-group">
      <label for="add-mac">MAC Address</label>
      <input
        type="text"
        id="add-mac"
        name="macAddress"
        value={formMacAddress}
        oninput={formatMacAddress}
        class="input-modern font-mono"
        placeholder="00:1A:7D:XX:XX:XX"
        maxlength="17"
        required
      />
    </div>

    <div class="form-group">
      <label for="add-rate">السعر بالساعة (ج.م)</label>
      <input
        type="number"
        id="add-rate"
        name="hourlyRate"
        bind:value={formHourlyRate}
        class="input-modern"
        min="1"
        required
      />
    </div>

    <!-- Monitor Settings Section -->
    <div class="form-section">
      <h4 class="form-section-title">
        <Monitor class="w-4 h-4" />
        إعدادات الشاشة (FreeKiosk)
      </h4>
      <p class="form-section-hint">اختياري - للتحكم في شاشة Android</p>
    </div>

    <div class="form-row">
      <div class="form-group flex-1">
        <label for="add-monitor-ip">عنوان IP الشاشة</label>
        <input
          type="text"
          id="add-monitor-ip"
          name="monitorIp"
          bind:value={formMonitorIp}
          class="input-modern font-mono"
          placeholder="192.168.1.50"
        />
      </div>
      <div class="form-group" style="width: 100px">
        <label for="add-monitor-port">المنفذ</label>
        <input
          type="number"
          id="add-monitor-port"
          name="monitorPort"
          bind:value={formMonitorPort}
          class="input-modern font-mono"
          min="1"
          max="65535"
        />
      </div>
      <div class="form-group" style="width: auto; align-self: flex-end">
        <button
          type="button"
          class="btn btn-secondary"
          onclick={testFormConnection}
          disabled={!formMonitorIp || testingConnection === 'form'}
        >
          {#if testingConnection === 'form'}
            <span class="loading-spinner"></span>
          {:else}
            <Volume2 class="w-4 h-4" />
          {/if}
          اختبار
        </button>
      </div>
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

<!-- Edit Station Modal -->
<Modal bind:open={showEditModal} onClose={closeModals}>
  {#snippet header()}
    <div class="modal-header">
      <h3>
        <Pencil class="w-5 h-5 text-primary-light" />
        تعديل الجهاز
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
          toast.success('تم تحديث الجهاز بنجاح');
          closeModals();
          await invalidateAll();
        } else if (result.type === 'failure') {
          toast.error(result.data?.error as string || 'فشل في تحديث الجهاز');
        }
      };
    }}
    class="form-grid"
  >
    <input type="hidden" name="id" value={formId} />

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
      <label for="edit-mac">MAC Address</label>
      <input
        type="text"
        id="edit-mac"
        name="macAddress"
        value={formMacAddress}
        oninput={formatMacAddress}
        class="input-modern font-mono"
        maxlength="17"
        required
      />
    </div>

    <div class="form-group">
      <label for="edit-rate">السعر بالساعة (ج.م)</label>
      <input
        type="number"
        id="edit-rate"
        name="hourlyRate"
        bind:value={formHourlyRate}
        class="input-modern"
        min="1"
        required
      />
    </div>

    <div class="form-group">
      <label for="edit-status">الحالة</label>
      <select
        id="edit-status"
        name="status"
        bind:value={formStatus}
        class="select-modern"
      >
        <option value="available">متاح</option>
        <option value="maintenance">صيانة</option>
      </select>
    </div>

    <!-- Monitor Settings Section -->
    <div class="form-section">
      <h4 class="form-section-title">
        <Monitor class="w-4 h-4" />
        إعدادات الشاشة (FreeKiosk)
      </h4>
      <p class="form-section-hint">اختياري - للتحكم في شاشة Android</p>
    </div>

    <div class="form-row">
      <div class="form-group flex-1">
        <label for="edit-monitor-ip">عنوان IP الشاشة</label>
        <input
          type="text"
          id="edit-monitor-ip"
          name="monitorIp"
          bind:value={formMonitorIp}
          class="input-modern font-mono"
          placeholder="192.168.1.50"
        />
      </div>
      <div class="form-group" style="width: 100px">
        <label for="edit-monitor-port">المنفذ</label>
        <input
          type="number"
          id="edit-monitor-port"
          name="monitorPort"
          bind:value={formMonitorPort}
          class="input-modern font-mono"
          min="1"
          max="65535"
        />
      </div>
      <div class="form-group" style="width: auto; align-self: flex-end">
        <button
          type="button"
          class="btn btn-secondary"
          onclick={testFormConnection}
          disabled={!formMonitorIp || testingConnection === 'form'}
        >
          {#if testingConnection === 'form'}
            <span class="loading-spinner"></span>
          {:else}
            <Volume2 class="w-4 h-4" />
          {/if}
          اختبار
        </button>
      </div>
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
        حذف الجهاز
      </h3>
      <button class="modal-close-btn" onclick={closeModals}>
        <X class="w-5 h-5" />
      </button>
    </div>
  {/snippet}

  <div class="delete-confirmation">
    <AlertTriangle class="w-12 h-12 text-warning" />
    <p>هل أنت متأكد من حذف الجهاز <strong>{selectedStation?.nameAr}</strong>؟</p>
    <p class="text-sm text-text-muted">سيتم إنهاء أي جلسة نشطة على هذا الجهاز.</p>

    <form
      method="POST"
      action="?/delete"
      use:enhance={() => {
        return async ({ result }) => {
          if (result.type === 'success') {
            toast.success('تم حذف الجهاز');
            closeModals();
            await invalidateAll();
          } else if (result.type === 'failure') {
            toast.error(result.data?.error as string || 'فشل في حذف الجهاز');
          }
        };
      }}
      class="form-actions"
    >
      <input type="hidden" name="id" value={selectedStation?.id} />
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
  .settings-page {
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

  .table-container {
    padding: 0;
    overflow-x: auto;
  }

  .action-buttons {
    display: flex;
    gap: 8px;
    justify-content: center;
  }

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

  .info-card {
    padding: 20px;
  }

  .info-card h3 {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 16px;
    color: var(--color-text-primary);
  }

  .info-card ul {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-right: 20px;
    color: var(--color-text-secondary);
    font-size: 14px;
    list-style: disc;
  }

  .info-card strong {
    color: var(--color-text-primary);
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

  /* Station name column */
  .station-name {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .station-name .name-ar {
    font-size: 12px;
    color: var(--color-text-muted);
  }

  /* Monitor info */
  .monitor-info {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .monitor-ip {
    color: var(--color-primary-light);
  }

  .btn-icon-success {
    background: rgba(16, 185, 129, 0.1);
    color: #34d399;
  }

  .btn-icon-success:hover:not(:disabled) {
    background: rgba(16, 185, 129, 0.2);
  }

  .btn-icon-sm {
    width: 24px;
    height: 24px;
  }

  /* Form sections */
  .form-section {
    border-top: 1px solid var(--color-border);
    padding-top: 16px;
    margin-top: 8px;
  }

  .form-section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 600;
    color: var(--color-primary-light);
    margin: 0;
  }

  .form-section-hint {
    font-size: 12px;
    color: var(--color-text-muted);
    margin-top: 4px;
  }

  .form-row {
    display: flex;
    gap: 12px;
    align-items: flex-start;
  }

  .flex-1 {
    flex: 1;
  }

  /* Loading spinner */
  .loading-spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: currentColor;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Responsive */
  @media (max-width: 640px) {
    .table-modern {
      min-width: 800px;
    }

    .form-row {
      flex-direction: column;
    }

    .form-row .form-group {
      width: 100% !important;
    }
  }
</style>
