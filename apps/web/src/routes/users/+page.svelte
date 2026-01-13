<script lang="ts">
  import { Users, Clock } from 'lucide-svelte';
</script>

<div class="placeholder-page">
  <header class="page-header opacity-0 animate-fade-in">
    <h1 class="page-title">المستخدمين</h1>
    <p class="page-subtitle">إدارة مستخدمي الواي فاي</p>
  </header>

  <div class="glass-card opacity-0 animate-fade-in" style="animation-delay: 100ms">
    <div class="empty-state">
      <div class="icon-wrapper">
        <Users class="w-12 h-12" />
      </div>
      <h3>قريباً...</h3>
      <p>سيتم إضافة إدارة المستخدمين في التحديث القادم</p>
      <div class="coming-soon-badge">
        <Clock class="w-4 h-4" />
        <span>قيد التطوير</span>
      </div>
    </div>
  </div>
</div>

<style>
  .placeholder-page {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .empty-state {
    padding: 64px 24px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }

  .icon-wrapper {
    width: 80px;
    height: 80px;
    border-radius: 20px;
    background: linear-gradient(135deg, rgba(8, 145, 178, 0.15) 0%, rgba(8, 145, 178, 0.05) 100%);
    border: 1px solid rgba(8, 145, 178, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-primary-light);
  }

  .empty-state h3 {
    font-size: 20px;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .empty-state p {
    font-size: 14px;
    color: var(--color-text-muted);
    max-width: 280px;
  }

  .coming-soon-badge {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    border-radius: 20px;
    background: rgba(8, 145, 178, 0.1);
    border: 1px solid rgba(8, 145, 178, 0.2);
    color: var(--color-primary-light);
    font-size: 13px;
    font-weight: 500;
    margin-top: 8px;
  }
</style>
