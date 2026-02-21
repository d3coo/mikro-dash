<script lang="ts">
  import { page } from '$app/stores';
  import { Menu } from 'lucide-svelte';
  import { mobileNav } from '$lib/stores/mobile-nav.svelte';

  const nav = mobileNav();

  const pageTitles: Record<string, string> = {
    '/': 'الرئيسية',
    '/vouchers': 'الكروت',
    '/users': 'المستخدمين',
    '/sessions': 'الجلسات',
    '/playstation': 'البلايستيشن',
    '/fnb': 'مأكولات ومشروبات',
    '/analytics': 'التقارير',
    '/wifi': 'الواي فاي',
    '/portal': 'البوابة',
    '/settings': 'الإعدادات'
  };

  let title = $derived(
    pageTitles[$page.url.pathname] ||
    Object.entries(pageTitles).find(([k]) => k !== '/' && $page.url.pathname.startsWith(k))?.[1] ||
    'لوحة التحكم'
  );
</script>

<header class="mobile-header">
  <button class="hamburger-btn" onclick={() => nav.toggle()} aria-label="القائمة">
    <Menu class="w-6 h-6" />
  </button>
  <h1 class="mobile-title">{title}</h1>
</header>

<style>
  .mobile-header {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 56px;
    background: var(--color-glass);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-bottom: 1px solid var(--color-glass-border);
    z-index: var(--z-fixed);
    align-items: center;
    padding: 0 16px;
    gap: 12px;
  }

  .hamburger-btn {
    width: 44px;
    height: 44px;
    border-radius: 10px;
    background: transparent;
    border: 1px solid var(--color-border);
    color: var(--color-text-primary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }

  .hamburger-btn:hover {
    background: rgba(8, 145, 178, 0.1);
    border-color: var(--color-primary);
  }

  .mobile-title {
    font-size: 18px;
    font-weight: 600;
    color: var(--color-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  @media print {
    .mobile-header {
      display: none !important;
    }
  }

  @media (max-width: 768px) {
    .mobile-header {
      display: flex;
    }
  }
</style>
