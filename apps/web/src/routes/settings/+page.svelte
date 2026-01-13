<script lang="ts">
  import { enhance } from '$app/forms';
  import { Button } from '$lib/components/ui/button';
  import { Save, Wifi, Server, Building, CheckCircle, XCircle, Loader2 } from 'lucide-svelte';

  let { data, form } = $props();

  let settings = $state({ ...data.settings });
</script>

<div class="settings-page">
  <!-- Page Header -->
  <header class="page-header opacity-0 animate-fade-in">
    <h1 class="page-title">الإعدادات</h1>
    <p class="page-subtitle">إعدادات الاتصال والتطبيق</p>
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
      <span>تم حفظ الإعدادات بنجاح</span>
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

  <form method="POST" action="?/save" use:enhance class="settings-form">
    <!-- Router Connection -->
    <section class="settings-section glass-card opacity-0 animate-fade-in" style="animation-delay: 150ms">
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
            bind:value={settings.mikrotik_host}
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
            bind:value={settings.mikrotik_user}
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
            bind:value={settings.mikrotik_pass}
            class="input-modern"
          />
        </div>

        <div class="form-group">
          <label for="hotspot_server">سيرفر Hotspot</label>
          <input
            type="text"
            id="hotspot_server"
            name="hotspot_server"
            bind:value={settings.hotspot_server}
            class="input-modern"
            placeholder="guest-hotspot"
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
    <section class="settings-section glass-card opacity-0 animate-fade-in" style="animation-delay: 200ms">
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
            bind:value={settings.business_name}
            class="input-modern"
            placeholder="AboYassen WiFi"
          />
        </div>

        <div class="form-group">
          <label for="voucher_prefix">بادئة الكروت</label>
          <input
            type="text"
            id="voucher_prefix"
            name="voucher_prefix"
            bind:value={settings.voucher_prefix}
            class="input-modern"
            placeholder="ABO"
            maxlength="5"
          />
          <span class="form-hint">الحد الأقصى 5 أحرف</span>
        </div>
      </div>
    </section>

    <!-- Save Button -->
    <div class="form-actions opacity-0 animate-fade-in" style="animation-delay: 250ms">
      <Button type="submit">
        <Save class="w-4 h-4" />
        <span>حفظ الإعدادات</span>
      </Button>
    </div>
  </form>
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
</style>
