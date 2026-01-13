<script lang="ts">
  import { enhance } from '$app/forms';
  import { Button } from '$lib/components/ui/button';
  import {
    Upload,
    Download,
    FolderSync,
    FileCode,
    CheckCircle,
    XCircle,
    CloudOff,
    Loader2,
    FolderOpen,
    RotateCcw,
    Archive,
    Shield,
    ShieldCheck,
    ShieldOff,
    Plus,
    Trash2,
    Lock
  } from 'lucide-svelte';
  import { toast } from 'svelte-sonner';

  let { data, form } = $props();

  // Show toast notifications for form results
  $effect(() => {
    if (form?.success && form?.message) {
      toast.success(form.message);
    }
    if (form?.error) {
      toast.error(form.error);
    }
    // Show FTP info modal if available
    if (form?.ftpInfo) {
      showFtpModal = true;
    }
  });

  let showFtpModal = $state(false);
  let showCertModal = $state(false);

  let isBackingUp = $state(false);
  let isRestoring = $state(false);
  let isUploading = $state(false);
  let isSwitching = $state(false);
  let isCreatingCert = $state(false);
  let isEnablingHttps = $state(false);
  let isDisablingHttps = $state(false);
  let isDeletingCert = $state(false);
  let selectedDirectory = $state(data.currentDirectory);
  let selectedCertificate = $state(data.certificates[0]?.name || '');
  let newCertName = $state('hotspot-cert');
  let newCertCommonName = $state('hotspot');

  // Check if HTTPS is enabled on the first profile
  let httpsEnabled = $derived(
    data.profiles.length > 0 &&
    data.profiles[0].sslCertificate &&
    data.profiles[0].sslCertificate !== ''
  );

  function formatSize(size: string): string {
    const bytes = parseInt(size, 10);
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
</script>

<div class="portal-page">
  <!-- Page Header -->
  <header class="page-header opacity-0 animate-fade-in">
    <div>
      <h1 class="page-title">بوابة الهوتسبوت</h1>
      <p class="page-subtitle">إدارة ملفات صفحة تسجيل الدخول</p>
    </div>
  </header>

  <!-- Router Connection Status -->
  {#if !data.routerConnected}
    <div class="alert alert-danger opacity-0 animate-fade-in" style="animation-delay: 100ms">
      <CloudOff class="w-5 h-5" />
      <span>غير متصل بالراوتر - تعذر تحميل الملفات</span>
    </div>
  {/if}

  <div class="grid-layout">
    <!-- Current Router Files -->
    <section class="glass-card opacity-0 animate-fade-in" style="animation-delay: 150ms">
      <div class="section-header">
        <div class="section-title">
          <FolderOpen class="w-5 h-5 text-primary-light" />
          <h2>ملفات الراوتر الحالية</h2>
        </div>
        <span class="directory-badge">{data.currentDirectory}/</span>
      </div>

      <div class="files-list">
        {#each data.routerFiles as file}
          <div class="file-item">
            <div class="file-info">
              <FileCode class="w-5 h-5 text-text-muted" />
              <span class="file-name">{file.name}</span>
              {#if file.exists}
                <span class="file-size">{formatSize(file.size)}</span>
              {/if}
            </div>
            <div class="file-status">
              {#if file.exists}
                <span class="status-badge success">
                  <CheckCircle class="w-4 h-4" />
                  موجود
                </span>
              {:else}
                <span class="status-badge danger">
                  <XCircle class="w-4 h-4" />
                  غير موجود
                </span>
              {/if}
              {#if file.hasBackup}
                <span class="status-badge info">
                  <Archive class="w-4 h-4" />
                  نسخة احتياطية
                </span>
              {/if}
            </div>
          </div>
        {/each}
      </div>

      <!-- Actions -->
      <div class="actions-bar">
        <form
          method="POST"
          action="?/backup"
          use:enhance={() => {
            isBackingUp = true;
            return async ({ update }) => {
              await update();
              isBackingUp = false;
            };
          }}
        >
          <Button type="submit" variant="outline" disabled={isBackingUp || !data.routerConnected}>
            {#if isBackingUp}
              <Loader2 class="w-4 h-4 animate-spin" />
            {:else}
              <Archive class="w-4 h-4" />
            {/if}
            استخدام النسخة الاحتياطية
          </Button>
        </form>

        <form
          method="POST"
          action="?/restore"
          use:enhance={() => {
            isRestoring = true;
            return async ({ update }) => {
              await update();
              isRestoring = false;
            };
          }}
        >
          <Button type="submit" variant="outline" disabled={isRestoring || !data.routerConnected}>
            {#if isRestoring}
              <Loader2 class="w-4 h-4 animate-spin" />
            {:else}
              <RotateCcw class="w-4 h-4" />
            {/if}
            العودة للأصلي
          </Button>
        </form>
      </div>

      <div class="info-box">
        <p>
          <strong>ملاحظة:</strong> لديك نسخة احتياطية في <code>static/hotspot</code>.
          يمكنك التبديل بين المجلدين بضغط الأزرار أعلاه.
        </p>
      </div>
    </section>

    <!-- Local Files to Upload -->
    <section class="glass-card opacity-0 animate-fade-in" style="animation-delay: 200ms">
      <div class="section-header">
        <div class="section-title">
          <Upload class="w-5 h-5 text-primary-light" />
          <h2>الملفات المحلية</h2>
        </div>
        <span class="directory-badge">static/hotspot/</span>
      </div>

      <div class="files-list">
        {#each data.localFiles as file}
          <div class="file-item">
            <div class="file-info">
              <FileCode class="w-5 h-5 text-primary-light" />
              <span class="file-name">{file}</span>
            </div>
            <span class="status-badge success">
              <CheckCircle class="w-4 h-4" />
              جاهز للرفع
            </span>
          </div>
        {:else}
          <div class="empty-state-small">
            <p>لا توجد ملفات محلية</p>
          </div>
        {/each}
      </div>

      <!-- Upload Action -->
      <div class="actions-bar">
        <form
          method="POST"
          action="?/upload"
          use:enhance={() => {
            isUploading = true;
            return async ({ update }) => {
              await update();
              isUploading = false;
            };
          }}
        >
          <Button
            type="submit"
            disabled={isUploading || !data.routerConnected || data.localFiles.length === 0}
          >
            {#if isUploading}
              <Loader2 class="w-4 h-4 animate-spin" />
              جاري الرفع...
            {:else}
              <Upload class="w-4 h-4" />
              رفع الملفات للراوتر
            {/if}
          </Button>
        </form>
      </div>

      <div class="info-box">
        <p>
          <strong>ملاحظة:</strong> قبل الرفع، يُنصح بعمل نسخة احتياطية من الملفات الحالية.
          يمكنك استعادة الملفات الأصلية في أي وقت.
        </p>
      </div>
    </section>
  </div>

  <!-- Hotspot Profiles -->
  {#if data.profiles.length > 0}
    <section class="glass-card opacity-0 animate-fade-in" style="animation-delay: 250ms">
      <div class="section-header">
        <div class="section-title">
          <FolderSync class="w-5 h-5 text-primary-light" />
          <h2>بروفايلات الهوتسبوت</h2>
        </div>
      </div>

      <div class="profiles-list">
        {#each data.profiles as profile}
          <div class="profile-item">
            <div class="profile-info">
              <span class="profile-name">{profile.name}</span>
              <span class="profile-directory">{profile.htmlDirectory}/</span>
            </div>
            <form
              method="POST"
              action="?/switchDirectory"
              use:enhance={() => {
                isSwitching = true;
                return async ({ update }) => {
                  await update();
                  isSwitching = false;
                };
              }}
              class="profile-form"
            >
              <input type="hidden" name="profileId" value={profile.id} />
              <select name="directory" class="select-modern" bind:value={selectedDirectory}>
                <option value="hotspot">hotspot (الأصلي)</option>
                <option value="hotspot-backup">hotspot-backup (النسخة)</option>
                <option value="hotspot-custom">hotspot-custom (مخصص)</option>
              </select>
              <Button type="submit" variant="outline" size="sm" disabled={isSwitching}>
                {#if isSwitching}
                  <Loader2 class="w-4 h-4 animate-spin" />
                {:else}
                  <FolderSync class="w-4 h-4" />
                {/if}
                تغيير
              </Button>
            </form>
          </div>
        {/each}
      </div>
    </section>
  {/if}

  <!-- HTTPS / SSL Configuration -->
  <section class="glass-card opacity-0 animate-fade-in" style="animation-delay: 275ms">
    <div class="section-header">
      <div class="section-title">
        <Shield class="w-5 h-5 text-primary-light" />
        <h2>إعدادات HTTPS</h2>
      </div>
      {#if httpsEnabled}
        <span class="status-badge success">
          <ShieldCheck class="w-4 h-4" />
          HTTPS مفعّل
        </span>
      {:else}
        <span class="status-badge danger">
          <ShieldOff class="w-4 h-4" />
          HTTP فقط
        </span>
      {/if}
    </div>

    <div class="ssl-content">
      <!-- Current Status -->
      <div class="ssl-status-box">
        <div class="ssl-status-icon" class:enabled={httpsEnabled}>
          {#if httpsEnabled}
            <Lock class="w-8 h-8" />
          {:else}
            <ShieldOff class="w-8 h-8" />
          {/if}
        </div>
        <div class="ssl-status-info">
          <h4>{httpsEnabled ? 'البوابة محمية بـ HTTPS' : 'البوابة تعمل على HTTP فقط'}</h4>
          <p>
            {#if httpsEnabled}
              QR Scanner يعمل بشكل كامل مع الكاميرا المباشرة
            {:else}
              QR Scanner يعمل برفع الصور فقط - فعّل HTTPS لاستخدام الكاميرا المباشرة
            {/if}
          </p>
          {#if data.profiles[0]?.sslCertificate}
            <span class="cert-name">الشهادة: {data.profiles[0].sslCertificate}</span>
          {/if}
        </div>
      </div>

      <!-- Certificates List -->
      {#if data.certificates.length > 0}
        <div class="certificates-section">
          <h4>الشهادات المتاحة</h4>
          <div class="certificates-list">
            {#each data.certificates as cert}
              <div class="cert-item">
                <div class="cert-info">
                  <Shield class="w-5 h-5 text-primary-light" />
                  <div>
                    <span class="cert-name">{cert.name}</span>
                    <span class="cert-cn">{cert.commonName}</span>
                  </div>
                </div>
                <div class="cert-actions">
                  {#if cert.expiresAfter}
                    <span class="cert-expires">تنتهي: {cert.expiresAfter}</span>
                  {/if}
                  <form
                    method="POST"
                    action="?/deleteCertificate"
                    use:enhance={() => {
                      isDeletingCert = true;
                      return async ({ update }) => {
                        await update();
                        isDeletingCert = false;
                      };
                    }}
                  >
                    <input type="hidden" name="certId" value={cert.id} />
                    <Button type="submit" variant="ghost" size="sm" disabled={isDeletingCert}>
                      {#if isDeletingCert}
                        <Loader2 class="w-4 h-4 animate-spin" />
                      {:else}
                        <Trash2 class="w-4 h-4 text-danger" />
                      {/if}
                    </Button>
                  </form>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Actions -->
      <div class="ssl-actions">
        {#if !httpsEnabled}
          <!-- Enable HTTPS -->
          {#if data.certificates.length > 0}
            <form
              method="POST"
              action="?/enableHttps"
              use:enhance={() => {
                isEnablingHttps = true;
                return async ({ update }) => {
                  await update();
                  isEnablingHttps = false;
                };
              }}
              class="enable-https-form"
            >
              <input type="hidden" name="profileId" value={data.profiles[0]?.id} />
              <select name="certificate" class="select-modern" bind:value={selectedCertificate}>
                {#each data.certificates as cert}
                  <option value={cert.name}>{cert.name}</option>
                {/each}
              </select>
              <Button type="submit" disabled={isEnablingHttps || !data.routerConnected}>
                {#if isEnablingHttps}
                  <Loader2 class="w-4 h-4 animate-spin" />
                {:else}
                  <ShieldCheck class="w-4 h-4" />
                {/if}
                تفعيل HTTPS
              </Button>
            </form>
          {:else}
            <p class="no-certs-message">لا توجد شهادات. أنشئ شهادة أولاً</p>
          {/if}
        {:else}
          <!-- Disable HTTPS -->
          <form
            method="POST"
            action="?/disableHttps"
            use:enhance={() => {
              isDisablingHttps = true;
              return async ({ update }) => {
                await update();
                isDisablingHttps = false;
              };
            }}
          >
            <input type="hidden" name="profileId" value={data.profiles[0]?.id} />
            <Button type="submit" variant="outline" disabled={isDisablingHttps || !data.routerConnected}>
              {#if isDisablingHttps}
                <Loader2 class="w-4 h-4 animate-spin" />
              {:else}
                <ShieldOff class="w-4 h-4" />
              {/if}
              تعطيل HTTPS
            </Button>
          </form>
        {/if}

        <Button variant="outline" onclick={() => showCertModal = true}>
          <Plus class="w-4 h-4" />
          إنشاء شهادة جديدة
        </Button>
      </div>

      <div class="info-box">
        <p>
          <strong>ملاحظة:</strong> تفعيل HTTPS يتيح استخدام QR Scanner بالكاميرا المباشرة.
          الشهادة ذاتية التوقيع قد تظهر تحذير في المتصفح - هذا طبيعي وآمن للاستخدام المحلي.
        </p>
      </div>
    </div>
  </section>

  <!-- Debug: All Router Files -->
  {#if data.allRouterFiles && data.allRouterFiles.length > 0}
    <section class="glass-card opacity-0 animate-fade-in" style="animation-delay: 275ms">
      <div class="section-header">
        <div class="section-title">
          <FileCode class="w-5 h-5 text-warning" />
          <h2>جميع ملفات الراوتر (للتشخيص)</h2>
        </div>
        <span class="directory-badge">{data.allRouterFiles.length} ملف</span>
      </div>

      <div class="debug-files">
        {#each data.allRouterFiles.filter(f => f.name.includes('hotspot') || f.type === 'directory') as file}
          <div class="debug-file-item">
            <span class="file-name">{file.name}</span>
            <span class="file-type">{file.type}</span>
            <span class="file-size">{formatSize(file.size)}</span>
          </div>
        {/each}
        {#if data.allRouterFiles.filter(f => f.name.includes('hotspot') || f.type === 'directory').length === 0}
          <p class="text-muted p-4">لا توجد ملفات متعلقة بـ hotspot</p>
        {/if}
      </div>
    </section>
  {/if}

  <!-- Instructions -->
  <section class="glass-card opacity-0 animate-fade-in" style="animation-delay: 300ms">
    <div class="section-header">
      <div class="section-title">
        <FileCode class="w-5 h-5 text-primary-light" />
        <h2>تعليمات الاستخدام</h2>
      </div>
    </div>

    <div class="instructions">
      <div class="instruction-step">
        <span class="step-number">1</span>
        <div class="step-content">
          <h3>النسخ الاحتياطي</h3>
          <p>قبل تعديل أي ملفات، اضغط على "نسخ احتياطي" لحفظ الملفات الأصلية</p>
        </div>
      </div>

      <div class="instruction-step">
        <span class="step-number">2</span>
        <div class="step-content">
          <h3>رفع الملفات</h3>
          <p>اضغط "رفع الملفات للراوتر" لرفع ملفات البوابة المخصصة من المشروع</p>
        </div>
      </div>

      <div class="instruction-step">
        <span class="step-number">3</span>
        <div class="step-content">
          <h3>الاختبار</h3>
          <p>اتصل بشبكة الواي فاي وافتح أي موقع HTTP لاختبار البوابة الجديدة</p>
        </div>
      </div>

      <div class="instruction-step">
        <span class="step-number">4</span>
        <div class="step-content">
          <h3>الاستعادة</h3>
          <p>إذا حدثت مشكلة، اضغط "استعادة النسخة" للعودة للملفات الأصلية</p>
        </div>
      </div>
    </div>
  </section>
</div>

<!-- FTP Info Modal -->
{#if showFtpModal && form?.ftpInfo}
  <div class="modal-overlay" onclick={() => showFtpModal = false}>
    <div class="modal-content" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h3>رفع الملفات عبر FTP</h3>
        <button class="modal-close" onclick={() => showFtpModal = false}>&times;</button>
      </div>
      <div class="modal-body">
        <p class="modal-description">
          لا يمكن رفع الملفات عبر REST API. استخدم إحدى الطرق التالية:
        </p>

        <div class="ftp-info">
          <h4>معلومات الاتصال:</h4>
          <div class="info-grid">
            <span class="label">Host:</span>
            <code>{form.ftpInfo.host}</code>
            <span class="label">Username:</span>
            <code>{form.ftpInfo.username}</code>
            <span class="label">Protocol:</span>
            <code>FTP</code>
            <span class="label">Remote Path:</span>
            <code>{form.ftpInfo.remotePath}</code>
          </div>
        </div>

        <div class="upload-methods">
          <h4>طرق الرفع:</h4>
          <ol>
            <li><strong>WinBox:</strong> افتح Files ثم اسحب الملفات إلى مجلد hotspot</li>
            <li><strong>FileZilla:</strong> اتصل بالراوتر وارفع الملفات إلى /hotspot/</li>
            <li><strong>SCP:</strong> <code>scp static/hotspot/*.html admin@{form.ftpInfo.host}:/hotspot/</code></li>
          </ol>
        </div>
      </div>
      <div class="modal-footer">
        <Button variant="outline" onclick={() => showFtpModal = false}>إغلاق</Button>
      </div>
    </div>
  </div>
{/if}

<!-- Create Certificate Modal -->
{#if showCertModal}
  <div class="modal-overlay" onclick={() => showCertModal = false}>
    <div class="modal-content" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h3>إنشاء شهادة SSL</h3>
        <button class="modal-close" onclick={() => showCertModal = false}>&times;</button>
      </div>
      <form
        method="POST"
        action="?/createCertificate"
        use:enhance={() => {
          isCreatingCert = true;
          return async ({ update }) => {
            await update();
            isCreatingCert = false;
            showCertModal = false;
          };
        }}
      >
        <div class="modal-body">
          <p class="modal-description">
            إنشاء شهادة SSL ذاتية التوقيع للاستخدام مع بوابة الهوتسبوت.
            صالحة لمدة 10 سنوات.
          </p>

          <div class="form-group">
            <label for="cert-name">اسم الشهادة</label>
            <input
              type="text"
              id="cert-name"
              name="name"
              class="input-modern"
              bind:value={newCertName}
              placeholder="hotspot-cert"
            />
          </div>

          <div class="form-group">
            <label for="cert-cn">Common Name</label>
            <input
              type="text"
              id="cert-cn"
              name="commonName"
              class="input-modern"
              bind:value={newCertCommonName}
              placeholder="hotspot"
            />
            <span class="form-hint">عادةً يكون اسم الدومين أو IP</span>
          </div>
        </div>
        <div class="modal-footer">
          <Button type="button" variant="outline" onclick={() => showCertModal = false}>إلغاء</Button>
          <Button type="submit" disabled={isCreatingCert}>
            {#if isCreatingCert}
              <Loader2 class="w-4 h-4 animate-spin" />
              جاري الإنشاء...
            {:else}
              <Shield class="w-4 h-4" />
              إنشاء الشهادة
            {/if}
          </Button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  .portal-page {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .grid-layout {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
    gap: 24px;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px;
    border-bottom: 1px solid var(--color-border);
  }

  .section-title {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .section-title h2 {
    font-size: 16px;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .directory-badge {
    font-family: var(--font-family-mono);
    font-size: 12px;
    padding: 4px 10px;
    background: rgba(8, 145, 178, 0.15);
    color: var(--color-primary-light);
    border-radius: 6px;
  }

  .files-list {
    padding: 16px 24px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .file-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: var(--color-bg-elevated);
    border-radius: 10px;
    transition: background 0.2s ease;
  }

  .file-item:hover {
    background: var(--color-bg-hover);
  }

  .file-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .file-name {
    font-family: var(--font-family-mono);
    font-size: 14px;
    color: var(--color-text-primary);
  }

  .file-size {
    font-size: 12px;
    color: var(--color-text-muted);
  }

  .file-status {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .status-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
  }

  .status-badge.success {
    background: rgba(16, 185, 129, 0.15);
    color: var(--color-success);
  }

  .status-badge.danger {
    background: rgba(239, 68, 68, 0.15);
    color: var(--color-danger);
  }

  .status-badge.info {
    background: rgba(8, 145, 178, 0.15);
    color: var(--color-primary-light);
  }

  .actions-bar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 24px;
    border-top: 1px solid var(--color-border);
  }

  .info-box {
    padding: 0 24px 20px;
  }

  .info-box p {
    font-size: 13px;
    color: var(--color-text-muted);
    background: rgba(8, 145, 178, 0.1);
    padding: 12px 16px;
    border-radius: 8px;
    border-right: 3px solid var(--color-primary);
  }

  .info-box strong {
    color: var(--color-primary-light);
  }

  .empty-state-small {
    padding: 32px;
    text-align: center;
    color: var(--color-text-muted);
  }

  /* Profiles */
  .profiles-list {
    padding: 16px 24px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .profile-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 16px;
    padding: 16px 20px;
    background: var(--color-bg-elevated);
    border-radius: 12px;
  }

  .profile-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .profile-name {
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .profile-directory {
    font-family: var(--font-family-mono);
    font-size: 13px;
    color: var(--color-text-muted);
  }

  .profile-form {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  /* Instructions */
  .instructions {
    padding: 24px;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 20px;
  }

  .instruction-step {
    display: flex;
    gap: 16px;
    padding: 16px;
    background: var(--color-bg-elevated);
    border-radius: 12px;
  }

  .step-number {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-light) 100%);
    color: white;
    font-weight: 700;
    border-radius: 8px;
    flex-shrink: 0;
  }

  .step-content h3 {
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text-primary);
    margin-bottom: 4px;
  }

  .step-content p {
    font-size: 13px;
    color: var(--color-text-secondary);
    line-height: 1.5;
  }

  /* Debug Files */
  .debug-files {
    padding: 16px 24px;
    max-height: 300px;
    overflow-y: auto;
  }

  .debug-file-item {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 8px 12px;
    background: var(--color-bg-elevated);
    border-radius: 6px;
    margin-bottom: 4px;
    font-family: var(--font-family-mono);
    font-size: 12px;
  }

  .debug-file-item .file-name {
    flex: 1;
    color: var(--color-text-primary);
  }

  .debug-file-item .file-type {
    color: var(--color-warning);
    padding: 2px 8px;
    background: rgba(245, 158, 11, 0.15);
    border-radius: 4px;
  }

  .debug-file-item .file-size {
    color: var(--color-text-muted);
  }

  .text-muted {
    color: var(--color-text-muted);
  }

  .p-4 {
    padding: 16px;
  }

  /* Modal */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    padding: 20px;
  }

  .modal-content {
    background: var(--color-bg-base);
    border: 1px solid var(--color-border);
    border-radius: 16px;
    max-width: 500px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px;
    border-bottom: 1px solid var(--color-border);
  }

  .modal-header h3 {
    font-size: 18px;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .modal-close {
    background: none;
    border: none;
    font-size: 24px;
    color: var(--color-text-muted);
    cursor: pointer;
    padding: 0;
    line-height: 1;
  }

  .modal-close:hover {
    color: var(--color-text-primary);
  }

  .modal-body {
    padding: 24px;
  }

  .modal-description {
    color: var(--color-text-secondary);
    margin-bottom: 20px;
  }

  .ftp-info {
    background: var(--color-bg-elevated);
    padding: 16px;
    border-radius: 10px;
    margin-bottom: 20px;
  }

  .ftp-info h4 {
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text-primary);
    margin-bottom: 12px;
  }

  .info-grid {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 8px 16px;
    align-items: center;
  }

  .info-grid .label {
    color: var(--color-text-muted);
    font-size: 13px;
  }

  .info-grid code {
    font-family: var(--font-family-mono);
    font-size: 13px;
    color: var(--color-primary-light);
    background: var(--color-bg-base);
    padding: 4px 8px;
    border-radius: 4px;
  }

  .upload-methods h4 {
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text-primary);
    margin-bottom: 12px;
  }

  .upload-methods ol {
    padding-right: 20px;
    color: var(--color-text-secondary);
    font-size: 14px;
  }

  .upload-methods li {
    margin-bottom: 10px;
  }

  .upload-methods code {
    font-family: var(--font-family-mono);
    font-size: 12px;
    color: var(--color-primary-light);
    background: var(--color-bg-elevated);
    padding: 2px 6px;
    border-radius: 4px;
  }

  .modal-footer {
    padding: 16px 24px;
    border-top: 1px solid var(--color-border);
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }

  /* SSL Section Styles */
  .ssl-content {
    padding: 24px;
  }

  .ssl-status-box {
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 20px;
    background: var(--color-bg-elevated);
    border-radius: 12px;
    margin-bottom: 24px;
  }

  .ssl-status-icon {
    width: 64px;
    height: 64px;
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(239, 68, 68, 0.15);
    color: var(--color-danger);
    flex-shrink: 0;
  }

  .ssl-status-icon.enabled {
    background: rgba(16, 185, 129, 0.15);
    color: var(--color-success);
  }

  .ssl-status-info h4 {
    font-size: 16px;
    font-weight: 600;
    color: var(--color-text-primary);
    margin-bottom: 4px;
  }

  .ssl-status-info p {
    font-size: 14px;
    color: var(--color-text-secondary);
    margin-bottom: 8px;
  }

  .ssl-status-info .cert-name {
    font-family: var(--font-family-mono);
    font-size: 12px;
    color: var(--color-primary-light);
    background: rgba(8, 145, 178, 0.15);
    padding: 4px 8px;
    border-radius: 4px;
  }

  .certificates-section {
    margin-bottom: 24px;
  }

  .certificates-section h4 {
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text-primary);
    margin-bottom: 12px;
  }

  .certificates-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .cert-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: var(--color-bg-elevated);
    border-radius: 10px;
  }

  .cert-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .cert-info div {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .cert-info .cert-name {
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .cert-info .cert-cn {
    font-size: 12px;
    color: var(--color-text-muted);
    font-family: var(--font-family-mono);
  }

  .cert-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .cert-expires {
    font-size: 12px;
    color: var(--color-text-muted);
  }

  .ssl-actions {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 20px;
  }

  .enable-https-form {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .no-certs-message {
    color: var(--color-text-muted);
    font-size: 14px;
  }

  /* Form styles for modal */
  .form-group {
    margin-bottom: 16px;
  }

  .form-group label {
    display: block;
    font-size: 14px;
    font-weight: 500;
    color: var(--color-text-primary);
    margin-bottom: 8px;
  }

  .input-modern {
    width: 100%;
    padding: 12px 16px;
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    font-family: inherit;
    font-size: 14px;
    color: var(--color-text-primary);
    outline: none;
    transition: all 0.2s ease;
  }

  .input-modern:focus {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px rgba(8, 145, 178, 0.15);
  }

  .input-modern::placeholder {
    color: var(--color-text-muted);
  }

  .form-hint {
    display: block;
    margin-top: 6px;
    font-size: 12px;
    color: var(--color-text-muted);
  }

  .text-danger {
    color: var(--color-danger);
  }

  .info-box code {
    font-family: var(--font-family-mono);
    font-size: 12px;
    color: var(--color-primary-light);
    background: var(--color-bg-elevated);
    padding: 2px 6px;
    border-radius: 4px;
  }

  @media (max-width: 768px) {
    .grid-layout {
      grid-template-columns: 1fr;
    }

    .profile-item {
      flex-direction: column;
      align-items: stretch;
    }

    .profile-form {
      flex-direction: column;
    }
  }
</style>
