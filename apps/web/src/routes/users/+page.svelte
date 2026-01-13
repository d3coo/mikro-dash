<script lang="ts">
  import { enhance } from '$app/forms';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { Button } from '$lib/components/ui/button';
  import ConfirmModal from '$lib/components/confirm-modal.svelte';
  import { Users, Clock, Monitor, Signal, WifiOff, LogOut, Loader2, ChevronRight, ChevronLeft, RefreshCw } from 'lucide-svelte';
  import { toast } from 'svelte-sonner';

  let { data, form } = $props();

  // Show toast notifications for form results
  $effect(() => {
    if (form?.success && form?.kicked) {
      toast.success('تم قطع اتصال المستخدم بنجاح');
    }
    if (form?.error) {
      toast.error(form.error);
    }
  });

  let isKicking = $state<string | null>(null);
  let showKickModal = $state(false);
  let selectedSession = $state<{ id: string; user: string } | null>(null);
  let kickFormEl: HTMLFormElement;

  // Format bytes to human readable
  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // Format uptime string
  function formatUptime(uptime: string): string {
    if (!uptime || uptime === '0s') return '-';

    const hours = uptime.match(/(\d+)h/);
    const minutes = uptime.match(/(\d+)m/);
    const seconds = uptime.match(/(\d+)s/);

    const parts = [];
    if (hours) parts.push(`${hours[1]}س`);
    if (minutes) parts.push(`${minutes[1]}د`);
    if (!hours && !minutes && seconds) parts.push(`${seconds[1]}ث`);

    return parts.join(' ') || '-';
  }

  function goToPage(pageNum: number) {
    const url = new URL($page.url);
    url.searchParams.set('page', pageNum.toString());
    goto(url.toString());
  }

  function confirmKick(session: { id: string; user: string }) {
    selectedSession = session;
    showKickModal = true;
  }

  function refresh() {
    goto($page.url.toString(), { invalidateAll: true });
  }
</script>

<div class="users-page">
  <!-- Page Header -->
  <header class="page-header opacity-0 animate-fade-in">
    <div class="flex items-center justify-between flex-wrap gap-4">
      <div>
        <h1 class="page-title">المستخدمين</h1>
        <p class="page-subtitle">إدارة المستخدمين المتصلين</p>
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
      <Users class="w-5 h-5 text-primary-light" />
      <div class="mini-stat-content">
        <span class="mini-stat-value">{data.totalSessions}</span>
        <span class="mini-stat-label">إجمالي المتصلين</span>
      </div>
    </div>
  </div>

  <!-- Users List -->
  <section class="users-list glass-card opacity-0 animate-fade-in" style="animation-delay: 150ms">
    <div class="list-header">
      <div class="list-title">
        <h2>المستخدمين المتصلين</h2>
        <span class="count-badge">{data.totalSessions}</span>
      </div>
    </div>

    <div class="table-container">
      {#if data.sessions.length > 0}
        <table class="table-modern">
          <thead>
            <tr>
              <th>المستخدم</th>
              <th>العنوان IP</th>
              <th>MAC Address</th>
              <th>وقت الاتصال</th>
              <th>الرفع</th>
              <th>التحميل</th>
              <th>الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {#each data.sessions as session, index}
              <tr class="opacity-0 animate-fade-in" style="animation-delay: {200 + index * 30}ms">
                <td>
                  <div class="user-cell">
                    <div class="user-avatar">
                      <Users class="w-4 h-4" />
                    </div>
                    <span class="font-mono text-primary-light">{session.user}</span>
                  </div>
                </td>
                <td class="font-mono text-text-secondary">{session.address}</td>
                <td class="font-mono text-text-secondary text-sm">{session['mac-address']}</td>
                <td>
                  <div class="uptime-cell">
                    <Clock class="w-4 h-4 text-primary-light" />
                    <span>{formatUptime(session.uptime)}</span>
                  </div>
                </td>
                <td class="text-warning">{formatBytes(parseInt(session['bytes-in'] || '0'))}</td>
                <td class="text-success">{formatBytes(parseInt(session['bytes-out'] || '0'))}</td>
                <td>
                  <Button
                    variant="ghost"
                    size="sm"
                    class="kick-btn"
                    disabled={isKicking === session['.id']}
                    onclick={() => confirmKick({ id: session['.id'], user: session.user })}
                  >
                    {#if isKicking === session['.id']}
                      <Loader2 class="w-4 h-4 animate-spin" />
                    {:else}
                      <LogOut class="w-4 h-4" />
                    {/if}
                    قطع
                  </Button>
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
              لا يوجد مستخدمين متصلين حالياً
            {:else}
              غير متصل بالراوتر - تعذر تحميل المستخدمين
            {/if}
          </p>
        </div>
      {/if}
    </div>

    <!-- Pagination -->
    {#if data.pagination.totalPages > 1}
      <div class="pagination">
        <Button
          variant="outline"
          size="sm"
          disabled={!data.pagination.hasPrev}
          onclick={() => goToPage(data.pagination.currentPage - 1)}
        >
          <ChevronRight class="w-4 h-4" />
          السابق
        </Button>

        <div class="page-numbers">
          {#each Array.from({ length: data.pagination.totalPages }, (_, i) => i + 1) as pageNum}
            <button
              class="page-number"
              class:active={pageNum === data.pagination.currentPage}
              onclick={() => goToPage(pageNum)}
            >
              {pageNum}
            </button>
          {/each}
        </div>

        <Button
          variant="outline"
          size="sm"
          disabled={!data.pagination.hasNext}
          onclick={() => goToPage(data.pagination.currentPage + 1)}
        >
          التالي
          <ChevronLeft class="w-4 h-4" />
        </Button>
      </div>
    {/if}
  </section>
</div>

<!-- Hidden form for kick action -->
<form
  bind:this={kickFormEl}
  method="POST"
  action="?/kick"
  use:enhance={() => {
    if (selectedSession) {
      isKicking = selectedSession.id;
    }
    return async ({ update }) => {
      await update();
      isKicking = null;
      selectedSession = null;
    };
  }}
  class="hidden"
>
  <input type="hidden" name="sessionId" value={selectedSession?.id || ''} />
</form>

<ConfirmModal
  bind:open={showKickModal}
  title="تأكيد قطع الاتصال"
  message="هل أنت متأكد من قطع اتصال المستخدم {selectedSession?.user}؟"
  confirmText="قطع الاتصال"
  cancelText="إلغاء"
  variant="destructive"
  onConfirm={() => kickFormEl.requestSubmit()}
/>

<style>
  .users-page {
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

  .mini-stat {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 20px;
  }

  .mini-stat-content {
    display: flex;
    flex-direction: column;
  }

  .mini-stat-value {
    font-size: 24px;
    font-weight: 700;
    color: var(--color-text-primary);
  }

  .mini-stat-label {
    font-size: 13px;
    color: var(--color-text-muted);
  }

  /* Users List */
  .users-list {
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

  .table-container {
    overflow-x: auto;
  }

  .table-modern {
    min-width: 800px;
  }

  /* User Cell */
  .user-cell {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .user-avatar {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: rgba(8, 145, 178, 0.15);
    border: 1px solid rgba(8, 145, 178, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-primary-light);
  }

  /* Uptime Cell */
  .uptime-cell {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  /* Kick Button */
  .kick-btn {
    color: var(--color-danger) !important;
  }

  .kick-btn:hover {
    background: rgba(239, 68, 68, 0.1) !important;
  }

  /* Text Colors */
  .font-mono {
    font-family: var(--font-family-mono);
    font-size: 13px;
  }

  .text-primary-light { color: var(--color-primary-light); }
  .text-text-secondary { color: var(--color-text-secondary); }
  .text-success { color: #34d399; }
  .text-warning { color: #fbbf24; }
  .text-sm { font-size: 12px; }

  /* Pagination */
  .pagination {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 20px 24px;
    border-top: 1px solid var(--color-border);
  }

  .page-numbers {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .page-number {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    border: 1px solid var(--color-border);
    background: transparent;
    color: var(--color-text-secondary);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .page-number:hover {
    border-color: var(--color-primary);
    color: var(--color-primary-light);
  }

  .page-number.active {
    background: var(--color-primary);
    border-color: var(--color-primary);
    color: white;
  }

  .hidden {
    display: none;
  }
</style>
