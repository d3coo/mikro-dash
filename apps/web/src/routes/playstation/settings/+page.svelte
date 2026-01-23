<script lang="ts">
  import { Gamepad2, Plus, Pencil, Trash2, ArrowRight, Save, X, AlertTriangle, Monitor, Bell, Wand2, CheckCircle, Circle, Loader2, Tv, Power } from 'lucide-svelte';
  import { toast } from 'svelte-sonner';
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';

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
  let formMonitorType = $state('tcl');
  let formTimerEndAction = $state('notify');
  let formHdmiInput = $state(2);

  // Test connection state
  let testingConnection = $state<string | null>(null);

  // Setup wizard state
  let showSetupModal = $state(false);
  let setupIp = $state('');
  let setupMonitorType = $state<'tcl' | 'skyworth'>('tcl');
  let setupHdmiInput = $state(2);
  let setupStep = $state(0); // 0 = not started
  let setupStatus = $state<'idle' | 'running' | 'success' | 'error'>('idle');
  let setupError = $state('');

  interface SetupStepInfo {
    name: string;
    description: string;
    status: 'pending' | 'running' | 'success' | 'error';
    error?: string;
  }

  let setupSteps = $state<SetupStepInfo[]>([
    { name: 'إعداد الشبكة', description: 'تجاوز Hotspot + حظر الإنترنت', status: 'pending' },
    { name: 'اتصال ADB', description: 'الاتصال بالشاشة وانتظار الموافقة', status: 'pending' },
    { name: 'تثبيت PiPup', description: 'تثبيت تطبيق الإشعارات', status: 'pending' },
    { name: 'تشغيل PiPup', description: 'فتح تطبيق الإشعارات', status: 'pending' },
    { name: 'اختبار الإشعارات', description: 'إرسال إشعار تجريبي', status: 'pending' },
    { name: 'اختبار HDMI', description: 'تبديل مدخل HDMI', status: 'pending' },
    { name: 'اختبار إيقاف الشاشة', description: 'إيقاف تشغيل الشاشة', status: 'pending' }
  ]);

  function openAddModal() {
    formId = `PS-${String(data.stations.length + 1).padStart(2, '0')}`;
    formName = `Station ${data.stations.length + 1}`;
    formNameAr = `جهاز ${data.stations.length + 1}`;
    formMacAddress = '';
    formHourlyRate = 20;
    formMonitorIp = '';
    formMonitorPort = 8080;
    formMonitorType = 'tcl';
    formTimerEndAction = 'notify';
    formHdmiInput = 2;
    showAddModal = true;
  }

  function openEditModal(station: typeof data.stations[0]) {
    selectedStation = station;
    formId = station.id;
    formName = station.name;
    formNameAr = station.nameAr;
    formMacAddress = station.macAddress;
    formHourlyRate = station.hourlyRate / 100;
    formStatus = station.status;
    formMonitorIp = station.monitorIp || '';
    formMonitorPort = station.monitorPort || 8080;
    formMonitorType = station.monitorType || 'tcl';
    formTimerEndAction = station.timerEndAction || 'notify';
    formHdmiInput = station.hdmiInput || 2;
    showEditModal = true;
  }

  // Test monitor connection via PiPup notification
  async function testMonitorConnection(ip: string, port: number, stationId: string) {
    if (!ip) {
      toast.error('أدخل عنوان IP للشاشة أولاً');
      return;
    }

    testingConnection = stationId;
    try {
      const response = await fetch('/api/playstation/monitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test_pipup', ip })
      });

      const result = await response.json();

      if (result.success) {
        toast.success('تم إرسال إشعار تجريبي للشاشة!');
      } else {
        toast.error(`فشل الإرسال: ${result.error || 'غير معروف'}`);
      }
    } catch (err) {
      toast.error('فشل في الاتصال بالشاشة');
    } finally {
      testingConnection = null;
    }
  }

  function testFormConnection() {
    testMonitorConnection(formMonitorIp, formMonitorPort, 'form');
  }

  // Setup wizard functions
  function openSetupModal(ip?: string, monitorType?: string, hdmiInput?: number) {
    setupIp = ip || '';
    setupMonitorType = (monitorType as 'tcl' | 'skyworth') || 'tcl';
    setupHdmiInput = hdmiInput || 2;
    setupStep = 0;
    setupStatus = 'idle';
    setupError = '';
    setupSteps = setupSteps.map(s => ({ ...s, status: 'pending' as const, error: undefined }));
    showSetupModal = true;
  }

  function closeSetupModal() {
    showSetupModal = false;
    setupIp = '';
    setupStep = 0;
    setupStatus = 'idle';
  }

  async function runSetupStep(stepIndex: number, action: string, extraParams: Record<string, any> = {}) {
    setupSteps = setupSteps.map((s, i) =>
      i === stepIndex ? { ...s, status: 'running' as const } : s
    );

    try {
      const response = await fetch('/api/playstation/monitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          ip: setupIp,
          monitorType: setupMonitorType,
          hdmiInput: setupHdmiInput,
          ...extraParams
        })
      });

      const result = await response.json();

      if (result.success) {
        setupSteps = setupSteps.map((s, i) =>
          i === stepIndex ? { ...s, status: 'success' as const } : s
        );
        return true;
      } else {
        setupSteps = setupSteps.map((s, i) =>
          i === stepIndex ? { ...s, status: 'error' as const, error: result.error } : s
        );
        return false;
      }
    } catch (err) {
      setupSteps = setupSteps.map((s, i) =>
        i === stepIndex ? { ...s, status: 'error' as const, error: 'Connection failed' } : s
      );
      return false;
    }
  }

  async function startSetup() {
    if (!setupIp) {
      toast.error('أدخل عنوان IP للشاشة');
      return;
    }

    setupStatus = 'running';
    setupStep = 1;

    // Step 1: Network setup (bypass hotspot + block internet)
    const networkResult = await runSetupStep(0, 'setup_network');
    if (!networkResult) {
      setupStatus = 'error';
      setupError = 'فشل في إعداد الشبكة على MikroTik';
      return;
    }

    setupStep = 2;

    // Step 2: ADB Connect and wait for authorization
    // First initiate connection
    await fetch('/api/playstation/monitor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'setup_adb_connect', ip: setupIp })
    });

    toast.info('اضغط "السماح" على شاشة التلفزيون');

    // Wait for authorization
    setupSteps = setupSteps.map((s, i) =>
      i === 1 ? { ...s, status: 'running' as const } : s
    );

    const adbResult = await runSetupStep(1, 'setup_adb_wait', { timeout: 60000 });
    if (!adbResult) {
      setupStatus = 'error';
      setupError = 'فشل في الاتصال بـ ADB - تأكد من الضغط على "السماح" على الشاشة';
      return;
    }

    setupStep = 3;

    // Step 3: Install PiPup
    const installResult = await runSetupStep(2, 'setup_install_pipup');
    if (!installResult) {
      setupStatus = 'error';
      setupError = 'فشل في تثبيت PiPup';
      return;
    }

    setupStep = 4;

    // Step 4: Launch PiPup app
    const launchResult = await runSetupStep(3, 'setup_launch_pipup');
    if (!launchResult) {
      // Non-critical, continue but warn
      toast.warning('قد لا يعمل تشغيل PiPup تلقائياً');
    }

    // Wait for PiPup to fully start
    await new Promise(r => setTimeout(r, 3000));

    setupStep = 5;

    // Step 5: Test PiPup notification
    const pipupResult = await runSetupStep(4, 'test_pipup');
    if (!pipupResult) {
      setupStatus = 'error';
      setupError = 'فشل في اختبار الإشعارات - تأكد من تشغيل تطبيق PiPup على الشاشة';
      return;
    }

    setupStep = 6;

    // Step 6: Test HDMI switch
    const hdmiResult = await runSetupStep(5, 'setup_test_hdmi');
    if (!hdmiResult) {
      // Non-critical, continue
      toast.warning('تبديل HDMI قد لا يعمل بشكل صحيح');
    }

    setupStep = 7;

    // Step 7: Test screen off
    const screenResult = await runSetupStep(6, 'setup_test_screen_off');
    if (!screenResult) {
      // Non-critical, continue
      toast.warning('إيقاف الشاشة قد لا يعمل بشكل صحيح');
    }

    // All done!
    setupStatus = 'success';
    toast.success('تم إعداد الشاشة بنجاح!');
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

  function formatMacAddress(event: Event) {
    const input = event.target as HTMLInputElement;
    let value = input.value.toUpperCase().replace(/[^0-9A-F]/g, '');
    const formatted = value.match(/.{1,2}/g)?.join(':').slice(0, 17) || '';
    formMacAddress = formatted;
  }

  function getStatusClass(status: string): string {
    switch (status) {
      case 'available': return 'badge-success';
      case 'occupied': return 'badge-warning';
      case 'maintenance': return 'badge-danger';
      default: return 'badge-neutral';
    }
  }

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
      <div class="header-buttons">
        <button class="btn btn-secondary" onclick={() => openSetupModal()}>
          <Wand2 class="w-4 h-4" />
          إعداد شاشة
        </button>
        <button class="btn btn-primary" onclick={openAddModal}>
          <Plus class="w-4 h-4" />
          إضافة جهاز
        </button>
      </div>
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
                    <span class="monitor-ip font-mono text-sm">{station.monitorIp}</span>
                    <button
                      class="btn-icon btn-icon-success btn-icon-sm"
                      onclick={() => testMonitorConnection(station.monitorIp!, station.monitorPort || 8080, station.id)}
                      disabled={testingConnection === station.id}
                      title="إرسال إشعار تجريبي"
                    >
                      {#if testingConnection === station.id}
                        <span class="loading-spinner"></span>
                      {:else}
                        <Bell class="w-3 h-3" />
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
{#if showAddModal}
  <div class="modal-overlay" onclick={closeModals}>
    <div class="modal-box modal-lg modal-rtl" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <button class="modal-close" onclick={closeModals}>
          <X class="w-5 h-5" />
        </button>
        <h3>
          <Plus class="w-5 h-5 text-primary-light" />
          إضافة جهاز جديد
        </h3>
      </div>
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
      >
        <div class="modal-body">
          <div class="form-grid-2col">
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
          </div>

          <div class="form-grid-2col">
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

          <!-- Monitor Settings Section -->
          <div class="form-section-divider">
            <Monitor class="w-4 h-4" />
            <span>إعدادات الشاشة (اختياري)</span>
          </div>

          <div class="form-grid-3col">
            <div class="form-group">
              <label for="add-monitor-ip">عنوان IP</label>
              <input
                type="text"
                id="add-monitor-ip"
                name="monitorIp"
                bind:value={formMonitorIp}
                class="input-modern font-mono"
                placeholder="10.10.10.188"
              />
            </div>
            <div class="form-group">
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
            <div class="form-group">
              <label>&nbsp;</label>
              <button
                type="button"
                class="btn btn-secondary btn-full"
                onclick={testFormConnection}
                disabled={!formMonitorIp || testingConnection === 'form'}
              >
                {#if testingConnection === 'form'}
                  <span class="loading-spinner"></span>
                {:else}
                  <Bell class="w-4 h-4" />
                {/if}
                اختبار
              </button>
            </div>
          </div>

          <div class="form-grid-3col">
            <div class="form-group">
              <label for="add-monitor-type">نوع الشاشة</label>
              <select
                id="add-monitor-type"
                name="monitorType"
                bind:value={formMonitorType}
                class="select-modern"
              >
                <option value="tcl">TCL</option>
                <option value="skyworth">Skyworth</option>
              </select>
            </div>
            <div class="form-group">
              <label for="add-timer-end-action">عند انتهاء المؤقت</label>
              <select
                id="add-timer-end-action"
                name="timerEndAction"
                bind:value={formTimerEndAction}
                class="select-modern"
              >
                <option value="notify">إشعار فقط</option>
                <option value="screen_off">إيقاف الشاشة</option>
              </select>
            </div>
            <div class="form-group">
              <label for="add-hdmi-input">منفذ HDMI</label>
              <input
                type="number"
                id="add-hdmi-input"
                name="hdmiInput"
                bind:value={formHdmiInput}
                class="input-modern font-mono"
                min="1"
                max="4"
              />
            </div>
          </div>
        </div>

        <div class="modal-footer-rtl">
          <button type="submit" class="btn btn-primary">
            <Save class="w-4 h-4" />
            حفظ
          </button>
          <button type="button" class="btn btn-ghost" onclick={closeModals}>إلغاء</button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- Edit Station Modal -->
{#if showEditModal}
  <div class="modal-overlay" onclick={closeModals}>
    <div class="modal-box modal-lg modal-rtl" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <button class="modal-close" onclick={closeModals}>
          <X class="w-5 h-5" />
        </button>
        <h3>
          <Pencil class="w-5 h-5 text-primary-light" />
          تعديل الجهاز
        </h3>
      </div>
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
      >
        <input type="hidden" name="id" value={formId} />
        <div class="modal-body">
          <div class="form-grid-2col">
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
          </div>

          <div class="form-grid-2col">
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
          <div class="form-section-divider">
            <Monitor class="w-4 h-4" />
            <span>إعدادات الشاشة (اختياري)</span>
          </div>

          <div class="form-grid-3col">
            <div class="form-group">
              <label for="edit-monitor-ip">عنوان IP</label>
              <input
                type="text"
                id="edit-monitor-ip"
                name="monitorIp"
                bind:value={formMonitorIp}
                class="input-modern font-mono"
                placeholder="10.10.10.188"
              />
            </div>
            <div class="form-group">
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
            <div class="form-group">
              <label>&nbsp;</label>
              <button
                type="button"
                class="btn btn-secondary btn-full"
                onclick={testFormConnection}
                disabled={!formMonitorIp || testingConnection === 'form'}
              >
                {#if testingConnection === 'form'}
                  <span class="loading-spinner"></span>
                {:else}
                  <Bell class="w-4 h-4" />
                {/if}
                اختبار
              </button>
            </div>
          </div>

          <div class="form-grid-3col">
            <div class="form-group">
              <label for="edit-monitor-type">نوع الشاشة</label>
              <select
                id="edit-monitor-type"
                name="monitorType"
                bind:value={formMonitorType}
                class="select-modern"
              >
                <option value="tcl">TCL</option>
                <option value="skyworth">Skyworth</option>
              </select>
            </div>
            <div class="form-group">
              <label for="edit-timer-end-action">عند انتهاء المؤقت</label>
              <select
                id="edit-timer-end-action"
                name="timerEndAction"
                bind:value={formTimerEndAction}
                class="select-modern"
              >
                <option value="notify">إشعار فقط</option>
                <option value="screen_off">إيقاف الشاشة</option>
              </select>
            </div>
            <div class="form-group">
              <label for="edit-hdmi-input">منفذ HDMI</label>
              <input
                type="number"
                id="edit-hdmi-input"
                name="hdmiInput"
                bind:value={formHdmiInput}
                class="input-modern font-mono"
                min="1"
                max="4"
              />
            </div>
          </div>
        </div>

        <div class="modal-footer-rtl">
          <button type="submit" class="btn btn-primary">
            <Save class="w-4 h-4" />
            حفظ التغييرات
          </button>
          <button type="button" class="btn btn-ghost" onclick={closeModals}>إلغاء</button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- Delete Confirmation Modal -->
{#if showDeleteModal && selectedStation}
  <div class="modal-overlay" onclick={closeModals}>
    <div class="modal-box modal-rtl" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <button class="modal-close" onclick={closeModals}>
          <X class="w-5 h-5" />
        </button>
        <h3>
          <Trash2 class="w-5 h-5 text-danger" />
          حذف الجهاز
        </h3>
      </div>
      <div class="modal-body">
        <div class="delete-confirmation">
          <AlertTriangle class="w-12 h-12 text-warning" />
          <p>هل أنت متأكد من حذف الجهاز <strong>{selectedStation.nameAr}</strong>؟</p>
          <p class="text-sm text-text-muted">سيتم إنهاء أي جلسة نشطة على هذا الجهاز.</p>
        </div>
      </div>
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
      >
        <input type="hidden" name="id" value={selectedStation.id} />
        <div class="modal-footer-rtl">
          <button type="submit" class="btn btn-danger">
            <Trash2 class="w-4 h-4" />
            حذف
          </button>
          <button type="button" class="btn btn-ghost" onclick={closeModals}>إلغاء</button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- Setup Wizard Modal -->
{#if showSetupModal}
  <div class="modal-overlay" onclick={closeSetupModal}>
    <div class="modal-box modal-lg modal-rtl" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <button class="modal-close" onclick={closeSetupModal}>
          <X class="w-5 h-5" />
        </button>
        <h3>
          <Wand2 class="w-5 h-5 text-primary-light" />
          إعداد شاشة جديدة
        </h3>
      </div>
      <div class="modal-body">
        {#if setupStatus === 'idle'}
          <!-- Setup form -->
          <div class="setup-intro">
            <Tv class="w-12 h-12 text-primary-light" />
            <p>أدخل عنوان IP للشاشة وسيتم إعدادها تلقائياً</p>
          </div>

          <div class="form-group">
            <label for="setup-ip">عنوان IP للشاشة</label>
            <input
              type="text"
              id="setup-ip"
              bind:value={setupIp}
              class="input-modern font-mono"
              placeholder="10.10.10.188"
              required
            />
          </div>

          <div class="form-grid-2col">
            <div class="form-group">
              <label for="setup-type">نوع الشاشة</label>
              <select
                id="setup-type"
                bind:value={setupMonitorType}
                class="select-modern"
              >
                <option value="tcl">TCL</option>
                <option value="skyworth">Skyworth</option>
              </select>
            </div>
            <div class="form-group">
              <label for="setup-hdmi">منفذ HDMI</label>
              <input
                type="number"
                id="setup-hdmi"
                bind:value={setupHdmiInput}
                class="input-modern font-mono"
                min="1"
                max="4"
              />
            </div>
          </div>

          <div class="setup-note">
            <AlertTriangle class="w-4 h-4 text-warning" />
            <span>تأكد من تفعيل "USB Debugging" على الشاشة</span>
            <ul>
              <li>Settings → About → اضغط 7 مرات على Build Number</li>
              <li>Developer Options → USB Debugging = ON</li>
              <li>عند الإعداد ستحتاج للضغط على "السماح" على الشاشة</li>
            </ul>
          </div>
        {:else}
          <!-- Setup progress -->
          <div class="setup-progress">
            {#each setupSteps as step, index}
              <div class="setup-step" class:active={setupStep === index + 1} class:completed={step.status === 'success'} class:error={step.status === 'error'}>
                <div class="step-icon">
                  {#if step.status === 'success'}
                    <CheckCircle class="w-5 h-5 text-success" />
                  {:else if step.status === 'running'}
                    <Loader2 class="w-5 h-5 text-primary-light animate-spin" />
                  {:else if step.status === 'error'}
                    <X class="w-5 h-5 text-danger" />
                  {:else}
                    <Circle class="w-5 h-5 text-text-muted" />
                  {/if}
                </div>
                <div class="step-content">
                  <span class="step-name">{step.name}</span>
                  <span class="step-desc">
                    {#if step.status === 'error' && step.error}
                      {step.error}
                    {:else}
                      {step.description}
                    {/if}
                  </span>
                </div>
              </div>
            {/each}
          </div>

          {#if setupStatus === 'error'}
            <div class="setup-error">
              <AlertTriangle class="w-5 h-5" />
              <span>{setupError}</span>
            </div>
          {/if}

          {#if setupStatus === 'success'}
            <div class="setup-success">
              <CheckCircle class="w-8 h-8 text-success" />
              <span>تم إعداد الشاشة بنجاح!</span>
              <p class="text-sm text-text-muted">يمكنك الآن استخدام عنوان IP هذا عند إضافة جهاز جديد</p>
            </div>
          {/if}
        {/if}
      </div>
      <div class="modal-footer-rtl">
        {#if setupStatus === 'idle'}
          <button
            type="button"
            class="btn btn-primary"
            onclick={startSetup}
            disabled={!setupIp}
          >
            <Wand2 class="w-4 h-4" />
            بدء الإعداد
          </button>
        {:else if setupStatus === 'running'}
          <button type="button" class="btn btn-secondary" disabled>
            <Loader2 class="w-4 h-4 animate-spin" />
            جاري الإعداد...
          </button>
        {:else if setupStatus === 'error'}
          <button
            type="button"
            class="btn btn-primary"
            onclick={() => { setupStatus = 'idle'; setupSteps = setupSteps.map(s => ({ ...s, status: 'pending' as const })); }}
          >
            إعادة المحاولة
          </button>
        {:else}
          <button type="button" class="btn btn-primary" onclick={closeSetupModal}>
            <CheckCircle class="w-4 h-4" />
            تم
          </button>
        {/if}
        <button type="button" class="btn btn-ghost" onclick={closeSetupModal}>
          {setupStatus === 'success' ? 'إغلاق' : 'إلغاء'}
        </button>
      </div>
    </div>
  </div>
{/if}

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

  /* Modal Styles */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 20px;
  }

  .modal-box {
    background: var(--color-bg-card);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    width: 100%;
    max-width: 400px;
    max-height: 90vh;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    animation: modalSlideIn 0.2s ease-out;
  }

  .modal-box.modal-lg {
    max-width: 520px;
  }

  .modal-rtl {
    direction: rtl;
    text-align: right;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .modal-header h3 {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 16px;
    font-weight: 600;
    color: var(--color-text-primary);
    margin: 0;
  }

  .modal-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: transparent;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    transition: all 0.2s;
  }

  .modal-close:hover {
    background: rgba(255, 255, 255, 0.1);
    color: var(--color-text-primary);
  }

  .modal-body {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .modal-footer-rtl {
    display: flex;
    flex-direction: row-reverse;
    gap: 12px;
    padding: 16px 20px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  /* Form Styles */
  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .form-group label {
    font-size: 13px;
    font-weight: 500;
    color: var(--color-text-secondary);
  }

  .form-grid-2col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .form-grid-3col {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 12px;
  }

  .form-section-divider {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 0 4px;
    margin-top: 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    color: var(--color-primary-light);
    font-size: 13px;
    font-weight: 500;
  }

  .btn-full {
    width: 100%;
  }

  /* Delete Confirmation */
  .delete-confirmation {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    text-align: center;
    padding: 8px 0;
  }

  .delete-confirmation p {
    color: var(--color-text-primary);
    font-size: 15px;
    margin: 0;
  }

  .delete-confirmation strong {
    color: var(--color-primary-light);
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

  @keyframes modalSlideIn {
    from {
      opacity: 0;
      transform: translateY(-20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* Header Buttons */
  .header-buttons {
    display: flex;
    gap: 12px;
  }

  /* Setup Wizard Styles */
  .setup-intro {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 20px;
    text-align: center;
  }

  .setup-intro p {
    color: var(--color-text-secondary);
    font-size: 14px;
    margin: 0;
  }

  .setup-note {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    background: rgba(251, 191, 36, 0.1);
    border: 1px solid rgba(251, 191, 36, 0.2);
    border-radius: 10px;
    font-size: 13px;
  }

  .setup-note > span {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .setup-note ul {
    margin: 0;
    padding-right: 24px;
    color: var(--color-text-secondary);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .setup-progress {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .setup-step {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    transition: all 0.2s;
  }

  .setup-step.active {
    background: rgba(8, 145, 178, 0.1);
    border-color: rgba(8, 145, 178, 0.3);
  }

  .setup-step.completed {
    background: rgba(16, 185, 129, 0.1);
    border-color: rgba(16, 185, 129, 0.3);
  }

  .setup-step.error {
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.3);
  }

  .step-icon {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
  }

  .step-content {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .step-name {
    font-size: 14px;
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .step-desc {
    font-size: 12px;
    color: var(--color-text-muted);
  }

  .setup-step.error .step-desc {
    color: #f87171;
  }

  .setup-error {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 10px;
    color: #f87171;
    font-size: 13px;
  }

  .setup-success {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 20px;
    text-align: center;
  }

  .setup-success span {
    font-size: 16px;
    font-weight: 600;
    color: #34d399;
  }

  .text-success {
    color: #34d399;
  }

  .text-danger {
    color: #f87171;
  }

  .text-warning {
    color: #fbbf24;
  }

  .animate-spin {
    animation: spin 1s linear infinite;
  }

  /* Responsive */
  @media (max-width: 640px) {
    .table-modern {
      min-width: 700px;
    }

    .form-grid-2col,
    .form-grid-3col {
      grid-template-columns: 1fr;
    }

    .header-buttons {
      width: 100%;
      justify-content: stretch;
    }

    .header-buttons .btn {
      flex: 1;
    }
  }
</style>
