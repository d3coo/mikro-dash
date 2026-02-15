<script lang="ts">
  import { page } from '$app/stores';
  import {
    LayoutDashboard,
    Ticket,
    Users,
    Gamepad2,
    Settings
  } from 'lucide-svelte';

  const navItems = [
    { href: '/', label: 'الرئيسية', icon: LayoutDashboard },
    { href: '/vouchers', label: 'الكروت', icon: Ticket },
    { href: '/playstation', label: 'بلايستيشن', icon: Gamepad2 },
    { href: '/users', label: 'المستخدمين', icon: Users },
    { href: '/settings', label: 'الإعدادات', icon: Settings }
  ];
</script>

<nav class="bottom-nav">
  {#each navItems as item}
    {@const isActive = $page.url.pathname === item.href ||
      (item.href !== '/' && $page.url.pathname.startsWith(item.href))}
    <a href={item.href} class="bottom-nav-item" class:active={isActive}>
      <item.icon class="bottom-nav-icon" />
      <span class="bottom-nav-label">{item.label}</span>
    </a>
  {/each}
</nav>

<style>
  .bottom-nav {
    display: none;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 64px;
    background: var(--color-glass);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-top: 1px solid var(--color-glass-border);
    z-index: var(--z-fixed);
    justify-content: space-around;
    align-items: center;
    padding: 0 4px;
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }

  .bottom-nav-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    flex: 1;
    height: 100%;
    text-decoration: none;
    color: var(--color-text-muted);
    font-size: 10px;
    font-weight: 500;
    transition: color 0.2s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .bottom-nav-item.active {
    color: var(--color-primary-light);
  }

  .bottom-nav-item :global(.bottom-nav-icon) {
    width: 22px;
    height: 22px;
  }

  .bottom-nav-label {
    line-height: 1;
  }

  @media (max-width: 768px) {
    .bottom-nav {
      display: flex;
    }
  }

  @media print {
    .bottom-nav {
      display: none !important;
    }
  }
</style>
