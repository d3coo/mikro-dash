<script lang="ts">
  import { enhance } from '$app/forms';
  import { Button } from '$lib/components/ui/button';
  import { Save, Wifi, Server, Building, CheckCircle, XCircle, Package, Users, Plus, Trash2, Edit } from 'lucide-svelte';

  let { data, form } = $props();

  let settings = $state({ ...data.settings });
  let activeTab = $state<'general' | 'packages' | 'profiles'>('general');

  // Package form state (metadata only - bytes come from MikroTik profile)
  let showPackageForm = $state(false);
  let editingPackage = $state<typeof data.packages[0] | null>(null);
  let packageForm = $state({
    id: '',
    name: '',
    nameAr: '',
    priceLE: 0,
    profile: 'default',
    server: '', // Hotspot server to restrict access to specific WiFi
    codePrefix: '',
    sortOrder: 0
  });

  // Profile form state
  let showProfileForm = $state(false);
  let editingProfile = $state<typeof data.profiles[0] | null>(null);
  let profileForm = $state({
    id: '',
    name: '',
    rateLimit: '',
    sessionTimeout: '',
    sharedUsers: '1',
    macCookieTimeout: ''
  });

  function resetPackageForm() {
    packageForm = { id: '', name: '', nameAr: '', priceLE: 0, profile: 'default', server: '', codePrefix: '', sortOrder: 0 };
    editingPackage = null;
    showPackageForm = false;
  }

  function editPackage(pkg: typeof data.packages[0]) {
    editingPackage = pkg;
    packageForm = { ...pkg, server: pkg.server || '' };
    showPackageForm = true;
  }

  function resetProfileForm() {
    profileForm = { id: '', name: '', rateLimit: '', sessionTimeout: '', sharedUsers: '1', macCookieTimeout: '' };
    editingProfile = null;
    showProfileForm = false;
  }

  function editProfile(profile: typeof data.profiles[0]) {
    editingProfile = profile;
    profileForm = {
      id: profile.id,
      name: profile.name,
      rateLimit: profile.rateLimit || '',
      sessionTimeout: profile.sessionTimeout || '',
      sharedUsers: profile.sharedUsers || '1',
      macCookieTimeout: profile.macCookieTimeout || ''
    };
    showProfileForm = true;
  }

  // Helper to format time duration (MikroTik format to Arabic)
  function formatDuration(duration: string | undefined): string {
    if (!duration) return 'غير محدد';
    const map: Record<string, string> = {
      '1h': 'ساعة',
      '2h': 'ساعتين',
      '4h': '٤ ساعات',
      '8h': '٨ ساعات',
      '12h': '١٢ ساعة',
      '1d': 'يوم',
      '2d': 'يومين',
      '3d': '٣ أيام',
      '7d': 'أسبوع',
      '14d': 'أسبوعين',
      '30d': 'شهر'
    };
    return map[duration] || duration;
  }
</script>

<div class="settings-page">
  <!-- Page Header -->
  <header class="page-header opacity-0 animate-fade-in">
    <h1 class="page-title">الإعدادات</h1>
    <p class="page-subtitle">إعدادات الاتصال والتطبيق والباقات</p>
  </header>

  <!-- Alerts -->
  {#if form?.error}
    <div class="alert alert-error opacity-0 animate-fade-in" style="animation-delay: 100ms">
      <XCircle class="w-5 h-5" />
      <span>{form.error}</span>
    </div>
  {/if}

  {#if form?.success || form?.packageSuccess || form?.profileSuccess}
    <div class="alert alert-success opacity-0 animate-fade-in" style="animation-delay: 100ms">
      <CheckCircle class="w-5 h-5" />
      <span>تم حفظ التغييرات بنجاح</span>
    </div>
  {/if}

  {#if form?.testResult}
    <div class="alert {form.testResult.success ? 'alert-success' : 'alert-error'} opacity-0 animate-fade-in" style="animation-delay: 100ms">
      {#if form.testResult.success}
        <CheckCircle class="w-5 h-5" />
      {:else}
        <XCircle class="w-5 h-5" />
      {/if}
      <span>{form.testResult.message}</span>
    </div>
  {/if}

  <!-- Tabs -->
  <div class="tabs-container glass-card opacity-0 animate-fade-in" style="animation-delay: 150ms">
    <button
      class="tab-btn {activeTab === 'general' ? 'active' : ''}"
      onclick={() => activeTab = 'general'}
    >
      <Server class="w-4 h-4" />
      <span>عام</span>
    </button>
    <button
      class="tab-btn {activeTab === 'packages' ? 'active' : ''}"
      onclick={() => activeTab = 'packages'}
    >
      <Package class="w-4 h-4" />
      <span>الباقات</span>
    </button>
    <button
      class="tab-btn {activeTab === 'profiles' ? 'active' : ''}"
      onclick={() => activeTab = 'profiles'}
    >
      <Users class="w-4 h-4" />
      <span>البروفايلات</span>
    </button>
  </div>

  <!-- General Settings Tab -->
  {#if activeTab === 'general'}
    <form method="POST" action="?/save" use:enhance class="settings-form">
      <!-- Router Connection -->
      <section class="settings-section glass-card opacity-0 animate-fade-in" style="animation-delay: 200ms">
        <div class="section-header">
          <Server class="w-5 h-5 text-primary-light" />
          <h2>اتصال الراوتر</h2>
        </div>

        <div class="settings-grid">
          <div class="form-group">
            <label for="mikrotik_host">عنوان IP</label>
            <input
              type="text"
              id="mikrotik_host"
              name="mikrotik_host"
              bind:value={settings.mikrotik.host}
              class="input-modern"
              placeholder="192.168.1.109"
            />
          </div>

          <div class="form-group">
            <label for="mikrotik_user">اسم المستخدم</label>
            <input
              type="text"
              id="mikrotik_user"
              name="mikrotik_user"
              bind:value={settings.mikrotik.user}
              class="input-modern"
              placeholder="admin"
            />
          </div>

          <div class="form-group">
            <label for="mikrotik_pass">كلمة المرور</label>
            <input
              type="password"
              id="mikrotik_pass"
              name="mikrotik_pass"
              bind:value={settings.mikrotik.pass}
              class="input-modern"
              autocomplete="off"
            />
          </div>

        </div>

        <div class="section-footer">
          <Button type="submit" variant="outline" formaction="?/testConnection">
            <Wifi class="w-4 h-4" />
            <span>اختبار الاتصال</span>
          </Button>
        </div>
      </section>

      <!-- Business Settings -->
      <section class="settings-section glass-card opacity-0 animate-fade-in" style="animation-delay: 250ms">
        <div class="section-header">
          <Building class="w-5 h-5 text-primary-light" />
          <h2>إعدادات العمل</h2>
        </div>

        <div class="settings-grid">
          <div class="form-group">
            <label for="business_name">اسم العمل</label>
            <input
              type="text"
              id="business_name"
              name="business_name"
              bind:value={settings.business.name}
              class="input-modern"
              placeholder="AboYassen WiFi"
            />
          </div>

        </div>
      </section>

      <!-- Save Button -->
      <div class="form-actions opacity-0 animate-fade-in" style="animation-delay: 300ms">
        <Button type="submit">
          <Save class="w-4 h-4" />
          <span>حفظ الإعدادات</span>
        </Button>
      </div>
    </form>
  {/if}

  <!-- Packages Tab -->
  {#if activeTab === 'packages'}
    <section class="settings-section glass-card opacity-0 animate-fade-in" style="animation-delay: 200ms">
      <div class="section-header">
        <Package class="w-5 h-5 text-primary-light" />
        <h2>باقات الكروت</h2>
        <Button variant="outline" size="sm" onclick={() => { resetPackageForm(); showPackageForm = true; }} class="mr-auto">
          <Plus class="w-4 h-4" />
          <span>إضافة باقة</span>
        </Button>
      </div>

      <!-- Package Form -->
      {#if showPackageForm}
        <form
          method="POST"
          action={editingPackage ? '?/updatePackage' : '?/createPackage'}
          use:enhance={() => {
            return async ({ result, update }) => {
              if (result.type === 'success') {
                resetPackageForm();
              }
              await update();
            };
          }}
          class="package-form"
        >
          <div class="form-grid">
            <div class="form-group">
              <label for="pkg-id">المعرف</label>
              <input
                type="text"
                id="pkg-id"
                name="id"
                bind:value={packageForm.id}
                class="input-modern"
                placeholder="3GB"
                disabled={!!editingPackage}
              />
            </div>
            <div class="form-group">
              <label for="pkg-name">الاسم (إنجليزي)</label>
              <input
                type="text"
                id="pkg-name"
                name="name"
                bind:value={packageForm.name}
                class="input-modern"
                placeholder="3 GB"
              />
            </div>
            <div class="form-group">
              <label for="pkg-nameAr">الاسم (عربي)</label>
              <input
                type="text"
                id="pkg-nameAr"
                name="nameAr"
                bind:value={packageForm.nameAr}
                class="input-modern"
                placeholder="٣ جيجا"
              />
            </div>
            <div class="form-group">
              <label for="pkg-price">السعر (جنيه)</label>
              <input
                type="number"
                id="pkg-price"
                name="priceLE"
                bind:value={packageForm.priceLE}
                class="input-modern"
                placeholder="10"
              />
            </div>
            <div class="form-group">
              <label for="pkg-profile">البروفايل</label>
              <select id="pkg-profile" name="profile" bind:value={packageForm.profile} class="input-modern">
                {#each data.profiles as profile}
                  <option value={profile.name}>{profile.name}</option>
                {/each}
                <option value="default">default</option>
              </select>
            </div>
            <div class="form-group">
              <label for="pkg-server">شبكة WiFi المسموح بها</label>
              <select id="pkg-server" name="server" bind:value={packageForm.server} class="input-modern">
                <option value="">جميع الشبكات</option>
                {#each data.hotspotServers as server}
                  <option value={server.name}>{server.name}</option>
                {/each}
              </select>
              <span class="form-hint">اختر شبكة معينة لتقييد الوصول (مثل Guest-WiFi فقط)</span>
            </div>
            <div class="form-group">
              <label for="pkg-prefix">بادئة الكود</label>
              <input
                type="text"
                id="pkg-prefix"
                name="codePrefix"
                bind:value={packageForm.codePrefix}
                class="input-modern"
                placeholder="G3"
                maxlength="5"
              />
            </div>
            <div class="form-group">
              <label for="pkg-order">الترتيب</label>
              <input
                type="number"
                id="pkg-order"
                name="sortOrder"
                bind:value={packageForm.sortOrder}
                class="input-modern"
                placeholder="1"
              />
            </div>
          </div>
          <div class="form-buttons">
            <Button type="submit">
              <Save class="w-4 h-4" />
              <span>{editingPackage ? 'تحديث' : 'إضافة'}</span>
            </Button>
            <Button type="button" variant="outline" onclick={resetPackageForm}>
              إلغاء
            </Button>
          </div>
        </form>
      {/if}

      <!-- Packages List -->
      <div class="items-list">
        {#each data.packages as pkg}
          <div class="item-card">
            <div class="item-info">
              <span class="item-name">{pkg.nameAr}</span>
              <span class="item-details">
                {pkg.priceLE} ج.م | {pkg.profile} | {pkg.codePrefix}
                {#if pkg.server}
                  | <span class="tag tag-primary">{pkg.server}</span>
                {/if}
              </span>
            </div>
            <div class="item-actions">
              <button class="icon-btn icon-btn-md icon-btn-ghost" onclick={() => editPackage(pkg)} title="تعديل">
                <Edit class="w-4 h-4" />
              </button>
              <form method="POST" action="?/deletePackage" use:enhance class="inline-form">
                <input type="hidden" name="id" value={pkg.id} />
                <button type="submit" class="icon-btn icon-btn-md icon-btn-danger" title="حذف">
                  <Trash2 class="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        {/each}
        {#if data.packages.length === 0}
          <p class="empty-message">لا توجد باقات</p>
        {/if}
      </div>
    </section>
  {/if}

  <!-- Profiles Tab -->
  {#if activeTab === 'profiles'}
    <section class="settings-section glass-card opacity-0 animate-fade-in" style="animation-delay: 200ms">
      <div class="section-header">
        <Users class="w-5 h-5 text-primary-light" />
        <h2>بروفايلات المستخدمين (MikroTik)</h2>
        <Button variant="outline" size="sm" onclick={() => { resetProfileForm(); showProfileForm = true; }} class="mr-auto">
          <Plus class="w-4 h-4" />
          <span>إضافة بروفايل</span>
        </Button>
      </div>

      <!-- Profile Form -->
      {#if showProfileForm}
        <form
          method="POST"
          action={editingProfile ? '?/updateProfile' : '?/createProfile'}
          use:enhance={() => {
            return async ({ result, update }) => {
              if (result.type === 'success') {
                resetProfileForm();
              }
              await update();
            };
          }}
          class="package-form"
        >
          {#if editingProfile}
            <input type="hidden" name="id" value={profileForm.id} />
          {/if}
          <div class="form-grid">
            <div class="form-group">
              <label for="profile-name">الاسم</label>
              <input
                type="text"
                id="profile-name"
                name="name"
                bind:value={profileForm.name}
                class="input-modern"
                placeholder="users-profile"
              />
            </div>
            <div class="form-group">
              <label for="profile-rate">حد السرعة</label>
              <input
                type="text"
                id="profile-rate"
                name="rateLimit"
                bind:value={profileForm.rateLimit}
                class="input-modern"
                placeholder="10M/10M"
              />
              <span class="form-hint">مثال: 10M/10M أو 5M/2M</span>
            </div>
            <div class="form-group">
              <label for="profile-timeout">مدة الجلسة</label>
              <select
                id="profile-timeout"
                name="sessionTimeout"
                bind:value={profileForm.sessionTimeout}
                class="input-modern"
              >
                <option value="">بلا حد</option>
                <option value="1h">ساعة واحدة</option>
                <option value="2h">ساعتين</option>
                <option value="4h">٤ ساعات</option>
                <option value="8h">٨ ساعات</option>
                <option value="12h">١٢ ساعة</option>
                <option value="1d">يوم واحد</option>
                <option value="2d">يومين</option>
                <option value="3d">٣ أيام</option>
                <option value="7d">أسبوع</option>
                <option value="14d">أسبوعين</option>
                <option value="30d">شهر</option>
              </select>
              <span class="form-hint">المدة القصوى للجلسة الواحدة</span>
            </div>
            <div class="form-group">
              <label for="profile-shared">المستخدمين المشتركين</label>
              <select
                id="profile-shared"
                name="sharedUsers"
                bind:value={profileForm.sharedUsers}
                class="input-modern"
              >
                <option value="1">١ مستخدم</option>
                <option value="2">٢ مستخدمين</option>
                <option value="3">٣ مستخدمين</option>
                <option value="4">٤ مستخدمين</option>
                <option value="5">٥ مستخدمين</option>
                <option value="6">٦ مستخدمين</option>
                <option value="8">٨ مستخدمين</option>
                <option value="10">١٠ مستخدمين</option>
                <option value="unlimited">غير محدود</option>
              </select>
              <span class="form-hint">عدد الأجهزة التي يمكنها استخدام نفس الكود</span>
            </div>
            <div class="form-group">
              <label for="profile-mac-cookie">مدة حفظ الجلسة (MAC Cookie)</label>
              <select
                id="profile-mac-cookie"
                name="macCookieTimeout"
                bind:value={profileForm.macCookieTimeout}
                class="input-modern"
              >
                <option value="">غير مفعل</option>
                <option value="1h">ساعة واحدة</option>
                <option value="4h">٤ ساعات</option>
                <option value="12h">١٢ ساعة</option>
                <option value="1d">يوم واحد</option>
                <option value="2d">يومين</option>
                <option value="3d">٣ أيام</option>
                <option value="7d">أسبوع</option>
                <option value="14d">أسبوعين</option>
                <option value="30d">شهر</option>
              </select>
              <span class="form-hint">يحفظ الجلسة عند خروج المستخدم من نطاق WiFi</span>
            </div>
          </div>
          <div class="form-buttons">
            <Button type="submit">
              <Save class="w-4 h-4" />
              <span>{editingProfile ? 'تحديث' : 'إضافة'}</span>
            </Button>
            <Button type="button" variant="outline" onclick={resetProfileForm}>
              إلغاء
            </Button>
          </div>
        </form>
      {/if}

      <!-- Profiles List -->
      <div class="items-list">
        {#each data.profiles as profile}
          <div class="item-card">
            <div class="item-info">
              <span class="item-name">{profile.name}</span>
              <span class="item-details">
                السرعة: {profile.rateLimit || 'غير محدد'} | المستخدمين: {profile.sharedUsers || '1'} | مدة الجلسة: {formatDuration(profile.sessionTimeout)} | حفظ: {formatDuration(profile.macCookieTimeout)}
              </span>
            </div>
            <div class="item-actions">
              <button class="icon-btn icon-btn-md icon-btn-ghost" onclick={() => editProfile(profile)} title="تعديل">
                <Edit class="w-4 h-4" />
              </button>
              <form method="POST" action="?/deleteProfile" use:enhance class="inline-form">
                <input type="hidden" name="id" value={profile.id} />
                <button type="submit" class="icon-btn icon-btn-md icon-btn-danger" title="حذف">
                  <Trash2 class="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        {/each}
        {#if data.profiles.length === 0}
          <p class="empty-message">لا توجد بروفايلات (تأكد من اتصال الراوتر)</p>
        {/if}
      </div>
    </section>
  {/if}
</div>

<style>
  .settings-page {
    display: flex;
    flex-direction: column;
    gap: 24px;
    max-width: 900px;
  }

  .settings-form {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .settings-section {
    padding: 24px;
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 24px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--color-border);
  }

  .section-header h2 {
    font-size: 16px;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .settings-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 20px;
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

  .form-hint {
    font-size: 12px;
    color: var(--color-text-muted);
  }

  .section-footer {
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px solid var(--color-border);
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
  }

  .text-primary-light {
    color: var(--color-primary-light);
  }

  /* Tabs */
  .tabs-container {
    display: flex;
    gap: 8px;
    padding: 12px 16px;
  }

  .tab-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    border-radius: 8px;
    background: transparent;
    border: 1px solid transparent;
    color: var(--color-text-secondary);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--animation-duration-normal);
  }

  .tab-btn:hover {
    background: rgba(8, 145, 178, 0.1);
    color: var(--color-text-primary);
  }

  .tab-btn.active {
    background: linear-gradient(135deg, rgba(8, 145, 178, 0.2) 0%, rgba(8, 145, 178, 0.1) 100%);
    border-color: rgba(8, 145, 178, 0.3);
    color: var(--color-primary-light);
  }

  /* Package/Profile Form */
  .package-form {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 20px;
  }

  .form-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 16px;
    margin-bottom: 16px;
  }

  .form-buttons {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
  }

  /* Items List */
  .items-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .item-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 10px;
    border: 1px solid var(--color-border);
  }

  .item-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .item-name {
    font-size: 15px;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .item-details {
    font-size: 13px;
    color: var(--color-text-muted);
  }

  .item-actions {
    display: flex;
    gap: 8px;
  }

  .inline-form {
    display: inline;
  }

  .empty-message {
    text-align: center;
    color: var(--color-text-muted);
    padding: 24px;
    font-size: 14px;
  }

  .mr-auto {
    margin-inline-start: auto;
  }
</style>
