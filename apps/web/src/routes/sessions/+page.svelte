<script lang="ts">
  import { enhance } from '$app/forms';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { Button } from '$lib/components/ui/button';
  import ConfirmModal from '$lib/components/confirm-modal.svelte';
  import {
    Radio, Clock, Smartphone, Signal, WifiOff, Trash2, Loader2,
    RefreshCw, Search, Eye, EyeOff, HardDrive, Wifi, Copy, Check
  } from 'lucide-svelte';
  import { toast } from 'svelte-sonner';

  let { data, form } = $props();

  // Show toast notifications
  $effect(() => {
    if (form?.success && form?.deleted) {
      toast.success('تم حذف المستخدم بنجاح');
    }
    if (form?.error) {
      toast.error(form.error);
    }
  });

  let searchQuery = $state(data.search || '');
  let selectedProfile = $state(data.filterProfile || '');
  let selectedServer = $state(data.filterServer || '');
  let isDeleting = $state<string | null>(null);
  let showDeleteModal = $state(false);
  let selectedUser = $state<{ id: string; username: string } | null>(null);
  let deleteFormEl: HTMLFormElement;

  // Password visibility
  let visiblePasswords = $state<Set<string>>(new Set());
  let copiedCodes = $state<Set<string>>(new Set());

  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function formatUptime(uptime: string | undefined): string {
    if (!uptime || uptime === '0s') return '-';
    const days = uptime.match(/(\d+)d/);
    const hours = uptime.match(/(\d+)h/);
    const minutes = uptime.match(/(\d+)m/);
    const seconds = uptime.match(/(\d+)s/);

    const parts = [];
    if (days) parts.push(`${days[1]}ي`);
    if (hours) parts.push(`${hours[1]}س`);
    if (minutes) parts.push(`${minutes[1]}د`);
    if (!days && !hours && !minutes && seconds) parts.push(`${seconds[1]}ث`);

    return parts.join(' ') || '-';
  }

  function formatTimeLeft(time: string | undefined): string {
    if (!time) return '-';
    const days = time.match(/(\d+)d/);
    const hours = time.match(/(\d+)h/);
    const minutes = time.match(/(\d+)m/);

    const parts = [];
    if (days) parts.push(`${days[1]} يوم`);
    if (hours) parts.push(`${hours[1]} ساعة`);
    if (minutes) parts.push(`${minutes[1]} دقيقة`);

    return parts.join(' و ') || time;
  }

  function getUsagePercent(used: number, limit: number): number {
    if (limit === 0) return 0;
    return Math.min(100, Math.round((used / limit) * 100));
  }

  function doSearch() {
    applyFilters();
  }

  function applyFilters() {
    const url = new URL($page.url);

    if (searchQuery.trim()) {
      url.searchParams.set('search', searchQuery.trim());
    } else {
      url.searchParams.delete('search');
    }

    if (selectedProfile) {
      url.searchParams.set('profile', selectedProfile);
    } else {
      url.searchParams.delete('profile');
    }

    if (selectedServer) {
      url.searchParams.set('server', selectedServer);
    } else {
      url.searchParams.delete('server');
    }

    goto(url.toString());
  }

  function clearFilters() {
    searchQuery = '';
    selectedProfile = '';
    selectedServer = '';
    goto($page.url.pathname);
  }

  function refresh() {
    goto($page.url.toString(), { invalidateAll: true });
  }

  function confirmDelete(user: { id: string; username: string }) {
    selectedUser = user;
    showDeleteModal = true;
  }

  function togglePassword(username: string) {
    if (visiblePasswords.has(username)) {
      visiblePasswords.delete(username);
    } else {
      visiblePasswords.add(username);
    }
    visiblePasswords = new Set(visiblePasswords);
  }

  async function copyCode(username: string, password: string | undefined) {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(`${username}\n${password}`);
      copiedCodes.add(username);
      copiedCodes = new Set(copiedCodes);
      toast.success('تم نسخ الكود والباسورد');
      setTimeout(() => {
        copiedCodes.delete(username);
        copiedCodes = new Set(copiedCodes);
      }, 2000);
    } catch {
      toast.error('فشل في النسخ');
    }
  }

  // Stats
  const onlineCount = $derived(data.sessions.filter(s => s.isOnline).length);
  const totalCount = $derived(data.sessions.length);
</script>

<div class="sessions-page">
  <!-- Page Header -->
  <header class="page-header opacity-0 animate-fade-in">
    <div class="flex items-center justify-between flex-wrap gap-4">
      <div>
        <h1 class="page-title">الجلسات</h1>
        <p class="page-subtitle">جميع الكروت والأجهزة المرتبطة</p>
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

  <!-- Stats Cards -->
  <div class="stats-row opacity-0 animate-fade-in" style="animation-delay: 100ms">
    <div class="mini-stat glass-card">
      <Radio class="w-5 h-5 text-success" />
      <div class="mini-stat-content">
        <span class="mini-stat-value">{onlineCount}</span>
        <span class="mini-stat-label">متصل الآن</span>
      </div>
    </div>
    <div class="mini-stat glass-card">
      <HardDrive class="w-5 h-5 text-primary-light" />
      <div class="mini-stat-content">
        <span class="mini-stat-value">{totalCount}</span>
        <span class="mini-stat-label">إجمالي الكروت</span>
      </div>
    </div>
  </div>

  <!-- Search and Filters -->
  <div class="search-section glass-card opacity-0 animate-fade-in" style="animation-delay: 150ms">
    <div class="search-box">
      <Search class="search-icon" />
      <input
        type="text"
        bind:value={searchQuery}
        placeholder="بحث بالكود أو MAC أو اسم الجهاز..."
        class="search-input"
        onkeydown={(e) => e.key === 'Enter' && doSearch()}
      />
      <Button variant="default" size="sm" onclick={doSearch}>
        بحث
      </Button>
    </div>

    <!-- Filters -->
    <div class="filters-row">
      <div class="filter-group">
        <label for="filter-profile">البروفايل</label>
        <select
          id="filter-profile"
          bind:value={selectedProfile}
          onchange={applyFilters}
          class="filter-select"
        >
          <option value="">الكل</option>
          {#each data.profiles as profile}
            <option value={profile}>{profile}</option>
          {/each}
        </select>
      </div>

      <div class="filter-group">
        <label for="filter-server">شبكة WiFi</label>
        <select
          id="filter-server"
          bind:value={selectedServer}
          onchange={applyFilters}
          class="filter-select"
        >
          <option value="">الكل</option>
          {#each data.servers as server}
            <option value={server}>{server}</option>
          {/each}
        </select>
      </div>

      {#if data.search || data.filterProfile || data.filterServer}
        <button class="clear-filters-btn" onclick={clearFilters}>
          مسح الفلاتر
        </button>
      {/if}
    </div>

    {#if data.search || data.filterProfile || data.filterServer}
      <div class="active-filters">
        {#if data.search}
          <span class="filter-tag">بحث: {data.search}</span>
        {/if}
        {#if data.filterProfile}
          <span class="filter-tag">البروفايل: {data.filterProfile}</span>
        {/if}
        {#if data.filterServer}
          <span class="filter-tag">الشبكة: {data.filterServer}</span>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Sessions List -->
  <section class="sessions-list glass-card opacity-0 animate-fade-in" style="animation-delay: 200ms">
    <div class="list-header">
      <h2>الكروت والجلسات</h2>
    </div>

    {#if data.sessions.length > 0}
      <div class="sessions-grid">
        {#each data.sessions as session, index}
          <div
            class="session-card {session.isOnline ? 'online' : ''}"
            style="animation-delay: {250 + index * 30}ms"
          >
            <!-- Status indicator -->
            <div class="status-indicator {session.isOnline ? 'online' : 'offline'}">
              {#if session.isOnline}
                <Wifi class="w-3 h-3" />
              {:else}
                <WifiOff class="w-3 h-3" />
              {/if}
            </div>

            <!-- Header -->
            <div class="card-header">
              <div class="voucher-code">{session.username}</div>
              <div class="card-tags">
                {#if session.profile}
                  <span class="tag tag-purple">{session.profile}</span>
                {/if}
                {#if session.server}
                  <span class="tag tag-primary">{session.server}</span>
                {/if}
              </div>
              {#if session.password}
                <div class="password-row">
                  <span class="password-label">كلمة السر:</span>
                  <span class="password-value">
                    {visiblePasswords.has(session.username) ? session.password : '••••••'}
                  </span>
                  <button
                    class="icon-btn icon-btn-sm icon-btn-ghost"
                    onclick={() => togglePassword(session.username)}
                    title={visiblePasswords.has(session.username) ? 'إخفاء' : 'إظهار'}
                  >
                    {#if visiblePasswords.has(session.username)}
                      <EyeOff class="w-3.5 h-3.5" />
                    {:else}
                      <Eye class="w-3.5 h-3.5" />
                    {/if}
                  </button>
                  <button
                    class="icon-btn icon-btn-sm icon-btn-ghost"
                    onclick={() => copyCode(session.username, session.password)}
                    title="نسخ"
                  >
                    {#if copiedCodes.has(session.username)}
                      <Check class="w-3.5 h-3.5 text-success" />
                    {:else}
                      <Copy class="w-3.5 h-3.5" />
                    {/if}
                  </button>
                </div>
              {/if}
            </div>

            <!-- Device Info -->
            {#if session.deviceName || session.macAddress}
              <div class="device-info">
                <Smartphone class="w-4 h-4" />
                <div class="device-details">
                  {#if session.deviceName}
                    <span class="device-name">{session.deviceName}</span>
                  {/if}
                  {#if session.macAddress}
                    <span class="device-mac">{session.macAddress}</span>
                  {/if}
                </div>
              </div>
            {/if}

            <!-- Usage Bar -->
            {#if session.limitBytes > 0}
              <div class="usage-section">
                <div class="usage-header">
                  <span>الاستهلاك</span>
                  <span class="usage-text">
                    {formatBytes(session.usedBytes)} / {formatBytes(session.limitBytes)}
                  </span>
                </div>
                <div class="usage-bar">
                  <div
                    class="usage-fill"
                    style="width: {getUsagePercent(session.usedBytes, session.limitBytes)}%"
                    class:warning={getUsagePercent(session.usedBytes, session.limitBytes) > 80}
                    class:danger={getUsagePercent(session.usedBytes, session.limitBytes) > 95}
                  ></div>
                </div>
                <div class="usage-remaining">
                  المتبقي: <strong>{formatBytes(session.remainingBytes)}</strong>
                </div>
              </div>
            {:else if session.usedBytes > 0}
              <!-- No limit but has usage (guest users) -->
              <div class="usage-section">
                <div class="usage-header">
                  <span>الاستهلاك</span>
                  <span class="usage-text unlimited">
                    {formatBytes(session.usedBytes)} (بلا حد)
                  </span>
                </div>
              </div>
            {/if}

            <!-- Session Info -->
            <div class="session-info">
              {#if session.isOnline}
                <div class="info-item">
                  <Clock class="w-3.5 h-3.5" />
                  <span>متصل منذ {formatUptime(session.uptime)}</span>
                </div>
                {#if session.ipAddress}
                  <div class="info-item">
                    <Signal class="w-3.5 h-3.5" />
                    <span>{session.ipAddress}</span>
                  </div>
                {/if}
              {:else if session.cookieExpiresIn}
                <div class="info-item cookie-info">
                  <Clock class="w-3.5 h-3.5" />
                  <span>الجلسة محفوظة: {formatTimeLeft(session.cookieExpiresIn)}</span>
                </div>
              {/if}
            </div>

            <!-- Actions -->
            <div class="card-actions">
              <Button
                variant="ghost"
                size="sm"
                class="btn-danger-ghost"
                disabled={isDeleting === session.id}
                onclick={() => confirmDelete({ id: session.id, username: session.username })}
              >
                {#if isDeleting === session.id}
                  <Loader2 class="w-4 h-4 animate-spin" />
                {:else}
                  <Trash2 class="w-4 h-4" />
                {/if}
                حذف
              </Button>
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <div class="empty-state">
        <Radio class="empty-state-icon" />
        <p class="empty-state-text">
          {#if data.search}
            لا توجد نتائج للبحث
          {:else if data.routerConnected}
            لا توجد كروت
          {:else}
            غير متصل بالراوتر
          {/if}
        </p>
      </div>
    {/if}
  </section>
</div>

<!-- Hidden form for delete action -->
<form
  bind:this={deleteFormEl}
  method="POST"
  action="?/delete"
  use:enhance={() => {
    if (selectedUser) {
      isDeleting = selectedUser.id;
    }
    return async ({ update }) => {
      await update();
      isDeleting = null;
      selectedUser = null;
    };
  }}
  class="hidden"
>
  <input type="hidden" name="userId" value={selectedUser?.id || ''} />
</form>

<ConfirmModal
  bind:open={showDeleteModal}
  title="تأكيد الحذف"
  message="هل أنت متأكد من حذف الكرت {selectedUser?.username}؟ لن يتمكن المستخدم من الاتصال بهذا الكرت مرة أخرى."
  confirmText="حذف"
  cancelText="إلغاء"
  variant="destructive"
  onConfirm={() => deleteFormEl.requestSubmit()}
/>

<style>
  .sessions-page {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  /* Stats Row */
  .stats-row {
    display: flex;
    gap: 16px;
  }

  /* Filters */
  .filters-row {
    display: flex;
    align-items: flex-end;
    gap: 16px;
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--color-border);
    flex-wrap: wrap;
  }

  .filter-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .filter-group label {
    font-size: 12px;
    color: var(--color-text-muted);
  }

  .filter-select {
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 8px 12px;
    color: var(--color-text-primary);
    font-size: 13px;
    min-width: 140px;
    cursor: pointer;
  }

  .filter-select:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  .clear-filters-btn {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 8px;
    padding: 8px 16px;
    color: #ef4444;
    font-size: 13px;
    cursor: pointer;
    transition: all var(--animation-duration-normal);
  }

  .clear-filters-btn:hover {
    background: rgba(239, 68, 68, 0.2);
  }

  .active-filters {
    display: flex;
    gap: 8px;
    margin-top: 12px;
    flex-wrap: wrap;
  }

  /* Sessions List */
  .sessions-list {
    padding: 0;
    overflow: hidden;
  }

  .sessions-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 16px;
    padding: 20px;
  }

  /* Session Card */
  .session-card {
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    padding: 16px;
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 12px;
    opacity: 0;
    animation: fadeInCard var(--animation-duration-slow) ease forwards;
  }

  .session-card.online {
    border-color: rgba(52, 211, 153, 0.3);
    background: rgba(52, 211, 153, 0.05);
  }

  /* Status Indicator */
  .status-indicator {
    position: absolute;
    top: 12px;
    left: 12px;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .status-indicator.online {
    background: rgba(52, 211, 153, 0.2);
    color: #34d399;
  }

  .status-indicator.offline {
    background: rgba(156, 163, 175, 0.2);
    color: #9ca3af;
  }

  /* Card Header */
  .card-header {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .voucher-code {
    font-family: var(--font-family-mono);
    font-size: 18px;
    font-weight: 700;
    color: var(--color-primary-light);
  }

  .card-tags {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .password-row {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
  }

  .password-label {
    color: var(--color-text-muted);
  }

  .password-value {
    font-family: var(--font-family-mono);
    color: var(--color-text-secondary);
  }

  /* Device Info */
  .device-info {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 10px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 8px;
    color: var(--color-text-secondary);
  }

  .device-details {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .device-name {
    font-size: 14px;
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .device-mac {
    font-family: var(--font-family-mono);
    font-size: 12px;
    color: var(--color-text-muted);
  }

  /* Usage Section */
  .usage-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .usage-header {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    color: var(--color-text-muted);
  }

  .usage-text {
    font-family: var(--font-family-mono);
  }

  .usage-text.unlimited {
    color: var(--color-primary-light);
  }

  .usage-bar {
    height: 6px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
    overflow: hidden;
  }

  .usage-fill {
    height: 100%;
    background: var(--color-primary);
    border-radius: 3px;
    transition: width var(--animation-duration-slow) ease;
  }

  .usage-fill.warning {
    background: var(--color-warning);
  }

  .usage-fill.danger {
    background: var(--color-danger);
  }

  .usage-remaining {
    font-size: 12px;
    color: var(--color-text-muted);
    text-align: left;
  }

  /* Session Info */
  .session-info {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .info-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--color-text-muted);
  }

  .info-item.cookie-info {
    color: var(--color-primary-light);
  }

  /* Card Actions */
  .card-actions {
    display: flex;
    justify-content: flex-end;
    padding-top: 8px;
    border-top: 1px solid var(--color-border);
  }

  @keyframes fadeInCard {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
