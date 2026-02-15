<script lang="ts">
  import { enhance } from '$app/forms';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import {
    Wifi,
    WifiOff,
    Shield,
    Signal,
    Smartphone,
    Monitor,
    Power,
    PowerOff,
    Edit2,
    Trash2,
    Plus,
    Check,
    X,
    Loader2,
    RefreshCw,
    Lock,
    Unlock,
    Users,
    Radio
  } from 'lucide-svelte';
  import { invalidateAll } from '$app/navigation';
  import { Button } from '$lib/components/ui/button';
  import ConfirmModal from '$lib/components/confirm-modal.svelte';
  import Modal from '$lib/components/modal.svelte';
  import { toast } from 'svelte-sonner';

  let { data, form } = $props();

  // Show toast notifications for form results
  $effect(() => {
    if (form?.success) {
      if (form.vapCreated) toast.success('تم إنشاء الشبكة بنجاح');
      if (form.vapDeleted) toast.success('تم حذف الشبكة بنجاح');
      if (form.ssidUpdated) toast.success('تم تحديث اسم الشبكة بنجاح');
      if (form.passwordUpdated) toast.success('تم تحديث كلمة المرور بنجاح');
    }
    if (form?.error) {
      toast.error(form.error);
    }
  });

  // Loading states
  let isToggling = $state<string | null>(null);
  let isDeleting = $state<string | null>(null);
  let isUpdatingSSID = $state<string | null>(null);
  let isUpdatingPassword = $state<string | null>(null);

  // Edit states
  let editingSSID = $state<string | null>(null);
  let editSSIDValue = $state('');
  let showPassword = $state<string | null>(null);
  let newPasswordValue = $state('');

  // Modal states
  let showCreateVAP = $state(false);
  let vapForm = $state({
    masterInterface: '',
    ssid: '',
    securityProfile: 'open',
    name: ''
  });

  // Delete modal
  let showDeleteModal = $state(false);
  let deleteTarget = $state<{ id: string; name: string } | null>(null);
  let deleteFormEl: HTMLFormElement;

  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function formatSignal(signal: string): { value: number; label: string; color: string } {
    const match = signal.match(/^(-?\d+)/);
    const dbm = match ? parseInt(match[1], 10) : -100;

    if (dbm >= -50) return { value: 100, label: 'ممتاز', color: 'text-success' };
    if (dbm >= -60) return { value: 75, label: 'جيد جداً', color: 'text-success' };
    if (dbm >= -70) return { value: 50, label: 'جيد', color: 'text-warning' };
    if (dbm >= -80) return { value: 25, label: 'ضعيف', color: 'text-danger' };
    return { value: 10, label: 'ضعيف جداً', color: 'text-danger' };
  }

  function getBandLabel(band?: string, name?: string): string {
    if (band?.includes('5ghz')) return '5GHz';
    if (band?.includes('2ghz')) return '2.4GHz';
    if (name?.includes('wlan2')) return '5GHz';
    if (name?.includes('wlan1')) return '2.4GHz';
    return '';
  }

  function startEditSSID(ssid: string, ids: string[]) {
    editingSSID = ids.join(',');
    editSSIDValue = ssid;
  }

  function cancelEditSSID() {
    editingSSID = null;
    editSSIDValue = '';
  }

  function confirmDelete(id: string, name: string) {
    deleteTarget = { id, name };
    showDeleteModal = true;
  }

  function refresh() {
    goto($page.url.toString(), { invalidateAll: true });
  }
</script>

<div class="wifi-page">
  <!-- Page Header -->
  <header class="page-header opacity-0 animate-fade-in">
    <div class="flex items-center justify-between flex-wrap gap-4">
      <div>
        <h1 class="page-title">إدارة الواي فاي</h1>
        <p class="page-subtitle">الشبكات والأجهزة المتصلة</p>
      </div>
      <div class="header-actions">
        <span class="badge {data.routerConnected ? 'badge-success' : 'badge-danger'}">
          {#if data.routerConnected}
            <Signal class="w-3 h-3" />
            متصل بالراوتر
          {:else}
            <WifiOff class="w-3 h-3" />
            غير متصل
          {/if}
        </span>
        <Button variant="outline" size="sm" onclick={refresh}>
          <RefreshCw class="w-4 h-4" />
          تحديث
        </Button>
      </div>
    </div>
  </header>

  <!-- Router Connection Error -->
  {#if !data.routerConnected}
    <div class="alert alert-danger opacity-0 animate-fade-in" style="animation-delay: 100ms">
      <WifiOff class="w-5 h-5" />
      <span>غير متصل بالراوتر - تعذر تحميل الشبكات</span>
    </div>
  {/if}

  <!-- Networks Section -->
  <section class="networks-section glass-card opacity-0 animate-fade-in" style="animation-delay: 150ms">
    <div class="list-header">
      <div class="list-title">
        <h2>الشبكات اللاسلكية</h2>
        <span class="badge-count">{data.networkGroups.length}</span>
      </div>
      <Button size="sm" onclick={() => showCreateVAP = true} disabled={!data.routerConnected}>
        <Plus class="w-4 h-4" />
        إضافة شبكة
      </Button>
    </div>

    <div class="table-container">
      {#if data.networkGroups.length > 0}
        <table class="table-modern">
          <thead>
            <tr>
              <th>الشبكة</th>
              <th>الأمان</th>
              <th>النطاقات</th>
              <th>المتصلين</th>
              <th>الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {#each data.networkGroups as group, index}
              {@const anyRunning = group.interfaces.some(i => i.running)}
              {@const groupIds = group.interfaces.map(i => i.id)}
              <tr class="opacity-0 animate-fade-in" style="animation-delay: {200 + index * 30}ms">
                <td>
                  <div class="network-cell">
                    <div class="network-icon" class:running={anyRunning}>
                      <Wifi class="w-4 h-4" />
                    </div>
                    {#if editingSSID === groupIds.join(',')}
                      <form
                        method="POST"
                        action="?/updateSSID"
                        use:enhance={() => {
                          isUpdatingSSID = editingSSID;
                          return async ({ result }) => {
                            isUpdatingSSID = null;
                            if (result.type === 'success') {
                              editingSSID = null;
                              await invalidateAll();
                            }
                          };
                        }}
                        class="ssid-edit-form"
                      >
                        <input type="hidden" name="ids" value={groupIds.join(',')} />
                        <input
                          type="text"
                          name="ssid"
                          bind:value={editSSIDValue}
                          class="input-modern ssid-input"
                        />
                        <button type="submit" class="icon-btn icon-btn-md icon-btn-success" disabled={isUpdatingSSID !== null}>
                          {#if isUpdatingSSID}
                            <Loader2 class="w-4 h-4 animate-spin" />
                          {:else}
                            <Check class="w-4 h-4" />
                          {/if}
                        </button>
                        <button type="button" class="icon-btn icon-btn-md icon-btn-ghost" onclick={cancelEditSSID}>
                          <X class="w-4 h-4" />
                        </button>
                      </form>
                    {:else}
                      <div class="network-name-group">
                        <span class="network-name">{group.ssid}</span>
                        {#if group.isVirtual}
                          <span class="badge badge-info">افتراضي</span>
                        {/if}
                      </div>
                      <button class="icon-btn icon-btn-md icon-btn-ghost" onclick={() => startEditSSID(group.ssid, groupIds)}>
                        <Edit2 class="w-4 h-4" />
                      </button>
                    {/if}
                  </div>
                </td>
                <td>
                  <span class="badge {group.securityProfile === 'open' ? 'badge-warning' : 'badge-success'}">
                    {#if group.securityProfile === 'open'}
                      <Unlock class="w-3 h-3" />
                    {:else}
                      <Lock class="w-3 h-3" />
                    {/if}
                    {group.securityProfile}
                  </span>
                </td>
                <td>
                  <div class="bands-cell">
                    {#each group.interfaces as iface}
                      {@const bandLabel = getBandLabel(iface.band, iface.name)}
                      <div class="band-tag" class:running={iface.running} class:disabled={iface.disabled}>
                        <span class="band-label">{bandLabel || iface.name}</span>
                        <form
                          method="POST"
                          action="?/toggleAP"
                          use:enhance={() => {
                            isToggling = iface.id;
                            return async ({ result }) => {
                              isToggling = null;
                              if (result.type === 'success') {
                                await invalidateAll();
                              }
                            };
                          }}
                          class="inline"
                        >
                          <input type="hidden" name="id" value={iface.id} />
                          <input type="hidden" name="disabled" value={iface.disabled ? 'false' : 'true'} />
                          <button
                            type="submit"
                            class="band-toggle"
                            class:on={!iface.disabled}
                            disabled={isToggling === iface.id}
                            title={iface.disabled ? 'تشغيل' : 'إيقاف'}
                          >
                            {#if isToggling === iface.id}
                              <Loader2 class="w-3 h-3 animate-spin" />
                            {:else if iface.disabled}
                              <Power class="w-3 h-3" />
                            {:else}
                              <PowerOff class="w-3 h-3" />
                            {/if}
                          </button>
                        </form>
                      </div>
                    {/each}
                  </div>
                </td>
                <td>
                  <div class="clients-cell">
                    <Users class="w-4 h-4 text-primary-light" />
                    <span class="text-primary-light font-semibold">{group.totalClients}</span>
                  </div>
                </td>
                <td>
                  {#if group.isVirtual}
                    <Button
                      variant="ghost"
                      size="sm"
                      class="btn-danger-ghost"
                      onclick={() => confirmDelete(group.interfaces[0].id, group.ssid)}
                    >
                      <Trash2 class="w-4 h-4" />
                    </Button>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      {:else}
        <div class="empty-state">
          <Wifi class="empty-state-icon" />
          <p class="empty-state-text">
            {#if data.routerConnected}
              لا توجد شبكات لاسلكية
            {:else}
              غير متصل بالراوتر - تعذر تحميل الشبكات
            {/if}
          </p>
        </div>
      {/if}
    </div>
  </section>

  <!-- Clients Section -->
  <section class="clients-section glass-card opacity-0 animate-fade-in" style="animation-delay: 200ms">
    <div class="list-header">
      <div class="list-title">
        <h2>الأجهزة المتصلة</h2>
        <span class="badge-count">{data.clients.length}</span>
      </div>
    </div>

    <div class="table-container">
      {#if data.clients.length > 0}
        <table class="table-modern">
          <thead>
            <tr>
              <th>الجهاز</th>
              <th>الشبكة</th>
              <th>IP</th>
              <th>الإشارة</th>
              <th>الاستهلاك</th>
            </tr>
          </thead>
          <tbody>
            {#each data.clients as client, index}
              {@const signal = formatSignal(client.signalStrength)}
              <tr class="opacity-0 animate-fade-in" style="animation-delay: {250 + index * 30}ms">
                <td>
                  <div class="device-cell">
                    <div class="device-icon">
                      <Smartphone class="w-4 h-4" />
                    </div>
                    <div class="device-info">
                      <span class="device-name">{client.deviceName || 'جهاز غير معروف'}</span>
                      <span class="device-mac">{client.macAddress}</span>
                    </div>
                  </div>
                </td>
                <td>
                  <span class="badge badge-info">{client.interfaceName}</span>
                </td>
                <td class="font-mono text-text-secondary">{client.ipAddress || '-'}</td>
                <td>
                  <span class="{signal.color}">{signal.label}</span>
                </td>
                <td>
                  <span class="text-warning">↓{formatBytes(client.bytesIn)}</span>
                  <span class="text-success ms-2">↑{formatBytes(client.bytesOut)}</span>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      {:else}
        <div class="empty-state">
          <Monitor class="empty-state-icon" />
          <p class="empty-state-text">
            {#if data.routerConnected}
              لا توجد أجهزة متصلة
            {:else}
              غير متصل بالراوتر - تعذر تحميل الأجهزة
            {/if}
          </p>
        </div>
      {/if}
    </div>
  </section>

  <!-- Security Profiles Section -->
  <section class="security-section glass-card opacity-0 animate-fade-in" style="animation-delay: 250ms">
    <div class="list-header">
      <div class="list-title">
        <h2>بروفايلات الأمان</h2>
        <span class="badge-count">{data.securityProfiles.length}</span>
      </div>
    </div>

    <div class="table-container">
      {#if data.securityProfiles.length > 0}
        <table class="table-modern">
          <thead>
            <tr>
              <th>البروفايل</th>
              <th>نوع التشفير</th>
              <th>الحالة</th>
              <th>الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {#each data.securityProfiles as profile, index}
              <tr class="opacity-0 animate-fade-in" style="animation-delay: {300 + index * 30}ms">
                <td>
                  <div class="profile-cell">
                    <div class="profile-icon" class:secured={profile.hasPassword}>
                      {#if profile.hasPassword}
                        <Lock class="w-4 h-4" />
                      {:else}
                        <Unlock class="w-4 h-4" />
                      {/if}
                    </div>
                    <span class="profile-name">{profile.name}</span>
                  </div>
                </td>
                <td class="text-text-secondary">{profile.mode || 'none'}</td>
                <td>
                  <span class="badge {profile.hasPassword ? 'badge-success' : 'badge-warning'}">
                    {profile.hasPassword ? 'محمي' : 'مفتوح'}
                  </span>
                </td>
                <td>
                  {#if profile.mode !== 'none'}
                    {#if showPassword === profile.id}
                      <form
                        method="POST"
                        action="?/updatePassword"
                        use:enhance={() => {
                          isUpdatingPassword = profile.id;
                          return async ({ result }) => {
                            isUpdatingPassword = null;
                            if (result.type === 'success') {
                              showPassword = null;
                              newPasswordValue = '';
                              await invalidateAll();
                            }
                          };
                        }}
                        class="password-form"
                      >
                        <input type="hidden" name="id" value={profile.id} />
                        <input
                          type="password"
                          name="password"
                          bind:value={newPasswordValue}
                          placeholder="كلمة مرور جديدة"
                          class="input-modern password-input"
                          minlength="8"
                        />
                        <Button type="submit" size="sm" disabled={isUpdatingPassword === profile.id || newPasswordValue.length < 8}>
                          {#if isUpdatingPassword === profile.id}
                            <Loader2 class="w-4 h-4 animate-spin" />
                          {:else}
                            <Check class="w-4 h-4" />
                          {/if}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onclick={() => { showPassword = null; newPasswordValue = ''; }}
                        >
                          <X class="w-4 h-4" />
                        </Button>
                      </form>
                    {:else}
                      <Button
                        variant="ghost"
                        size="sm"
                        onclick={() => showPassword = profile.id}
                      >
                        <Edit2 class="w-4 h-4" />
                        تغيير كلمة المرور
                      </Button>
                    {/if}
                  {:else}
                    <span class="text-text-muted text-sm">شبكة مفتوحة</span>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      {:else}
        <div class="empty-state">
          <Shield class="empty-state-icon" />
          <p class="empty-state-text">لا توجد بروفايلات أمان</p>
        </div>
      {/if}
    </div>
  </section>
</div>

<!-- Create VAP Modal -->
<Modal bind:open={showCreateVAP} title="إضافة شبكة جديدة">
  {#snippet header()}
    <div class="modal-header">
      <h3>
        <Plus class="w-5 h-5 text-primary-light" />
        إضافة شبكة جديدة
      </h3>
      <button class="modal-close-btn" onclick={() => showCreateVAP = false}>
        <X class="w-5 h-5" />
      </button>
    </div>
  {/snippet}

  <form
    method="POST"
    action="?/createVAP"
    use:enhance={() => {
      return async ({ result }) => {
        if (result.type === 'success') {
          showCreateVAP = false;
          vapForm = { masterInterface: '', ssid: '', securityProfile: 'open', name: '' };
          await invalidateAll();
        }
      };
    }}
    class="vap-form"
  >
    <div class="form-group">
      <label for="masterInterface" class="form-label">النطاق</label>
      <select name="masterInterface" id="masterInterface" bind:value={vapForm.masterInterface} class="select-modern" required>
        <option value="">اختر النطاق...</option>
        {#each data.physicalInterfaces as iface}
          <option value={iface.name}>
            {getBandLabel(iface.band, iface.name) || iface.name}
            ({iface.name})
          </option>
        {/each}
      </select>
    </div>

    <div class="form-group">
      <label for="ssid" class="form-label">اسم الشبكة (SSID)</label>
      <input type="text" name="ssid" id="ssid" bind:value={vapForm.ssid} class="input-modern" required placeholder="مثال: MyNetwork" />
    </div>

    <div class="form-group">
      <label for="securityProfile" class="form-label">الأمان</label>
      <select name="securityProfile" id="securityProfile" bind:value={vapForm.securityProfile} class="select-modern" required>
        {#each data.securityProfiles as profile}
          <option value={profile.name}>
            {profile.name}
            {profile.mode === 'none' ? '(مفتوحة)' : '(محمية)'}
          </option>
        {/each}
      </select>
    </div>

    <div class="form-actions">
      <Button type="button" variant="ghost" onclick={() => showCreateVAP = false}>
        إلغاء
      </Button>
      <Button type="submit">
        <Plus class="w-4 h-4" />
        إنشاء
      </Button>
    </div>
  </form>
</Modal>

<!-- Delete Confirmation Form (hidden) -->
<form
  bind:this={deleteFormEl}
  method="POST"
  action="?/deleteVAP"
  use:enhance={() => {
    isDeleting = deleteTarget?.id || null;
    return async ({ result }) => {
      isDeleting = null;
      if (result.type === 'success') {
        deleteTarget = null;
        await invalidateAll();
      }
    };
  }}
  class="hidden"
>
  <input type="hidden" name="id" value={deleteTarget?.id || ''} />
</form>

<ConfirmModal
  bind:open={showDeleteModal}
  title="تأكيد الحذف"
  message="هل أنت متأكد من حذف شبكة {deleteTarget?.name}؟"
  confirmText="حذف"
  cancelText="إلغاء"
  variant="destructive"
  onConfirm={() => deleteFormEl.requestSubmit()}
/>

<style>
  .wifi-page {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  /* Sections */
  .networks-section,
  .clients-section,
  .security-section {
    padding: 0;
    overflow: hidden;
  }

  .table-container {
    overflow-x: auto;
  }

  /* Network Cell */
  .network-cell {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .network-icon {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: var(--color-bg-elevated);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-muted);
  }

  .network-icon.running {
    background: rgba(16, 185, 129, 0.15);
    color: var(--color-success);
  }

  .network-name-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .network-name {
    font-weight: 600;
    color: var(--color-text-primary);
  }

  /* SSID Edit */
  .ssid-edit-form {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .ssid-input {
    width: 150px;
    padding: 6px 10px;
    font-size: 14px;
  }

  /* Bands Cell */
  .bands-cell {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .band-tag {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 6px;
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    font-size: 12px;
  }

  .band-tag.running {
    background: rgba(16, 185, 129, 0.1);
    border-color: rgba(16, 185, 129, 0.3);
  }

  .band-tag.disabled {
    opacity: 0.5;
  }

  .band-label {
    font-weight: 500;
    color: var(--color-text-secondary);
  }

  .band-toggle {
    width: 22px;
    height: 22px;
    border-radius: 4px;
    border: none;
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--animation-duration-normal);
  }

  .band-toggle:hover {
    background: var(--color-bg-card);
    color: var(--color-text-primary);
  }

  .band-toggle.on {
    color: var(--color-success);
  }

  .band-toggle:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Clients Cell */
  .clients-cell {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  /* Profile Cell */
  .profile-cell {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .profile-icon {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: rgba(239, 68, 68, 0.1);
    color: var(--color-danger);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .profile-icon.secured {
    background: rgba(16, 185, 129, 0.1);
    color: var(--color-success);
  }

  .profile-name {
    font-weight: 500;
    color: var(--color-text-primary);
  }

  /* Password Form */
  .password-form {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .password-input {
    width: 150px;
    padding: 6px 10px;
    font-size: 13px;
  }

  /* VAP Form */
  .vap-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  /* Inline */
  .inline {
    display: inline;
  }

  @media (max-width: 768px) {
    .ssid-edit-form,
    .password-form {
      flex-wrap: wrap;
    }

    .ssid-input,
    .password-input {
      width: 100%;
      flex: 1;
    }
  }
</style>
