<script lang="ts">
  import { page } from '$app/stores';
  import { mobileNav } from '$lib/stores/mobile-nav.svelte';
  import {
    LayoutDashboard,
    Ticket,
    Users,
    Radio,
    Wifi,
    Settings,
    Zap,
    Globe,
    BarChart3,
    Gamepad2,
    Coffee,
    X
  } from 'lucide-svelte';

  const nav = mobileNav();

  const navItems = [
    { href: '/', label: 'الرئيسية', icon: LayoutDashboard },
    { href: '/vouchers', label: 'الكروت', icon: Ticket },
    { href: '/users', label: 'المستخدمين', icon: Users },
    { href: '/sessions', label: 'الجلسات', icon: Radio },
    { href: '/playstation', label: 'البلايستيشن', icon: Gamepad2 },
    { href: '/fnb', label: 'مأكولات ومشروبات', icon: Coffee },
    { href: '/analytics', label: 'التقارير', icon: BarChart3 },
    { href: '/wifi', label: 'الواي فاي', icon: Wifi },
    { href: '/portal', label: 'البوابة', icon: Globe },
    { href: '/settings', label: 'الإعدادات', icon: Settings }
  ];

  // Close drawer on route change
  let currentPath = $derived($page.url.pathname);
  let prevPath = '';
  $effect(() => {
    if (prevPath && currentPath !== prevPath) {
      nav.close();
    }
    prevPath = currentPath;
  });

  // Close on Escape key
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && nav.isOpen) {
      nav.close();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Mobile backdrop -->
{#if nav.isOpen}
  <div class="sidebar-backdrop" onclick={() => nav.close()} role="presentation"></div>
{/if}

<aside class="sidebar" class:sidebar-open={nav.isOpen}>
  <!-- Logo Section -->
  <div class="sidebar-logo">
    <div class="flex items-center gap-3">
      <div class="logo-icon">
        <Zap class="w-6 h-6 text-primary-light" />
      </div>
      <div class="flex-1">
        <h1>لوحة التحكم</h1>
        <p>إدارة الواي فاي</p>
      </div>
      <!-- Mobile close button -->
      <button class="sidebar-close-btn" onclick={() => nav.close()} aria-label="إغلاق القائمة">
        <X class="w-5 h-5" />
      </button>
    </div>
  </div>

  <!-- Navigation -->
  <nav class="sidebar-nav">
    <ul class="space-y-1">
      {#each navItems as item, index}
        {@const isActive = $page.url.pathname === item.href ||
          (item.href !== '/' && $page.url.pathname.startsWith(item.href))}
        <li
          class="opacity-0 animate-fade-in"
          style="animation-delay: {index * 50}ms"
        >
          <a
            href={item.href}
            class="nav-item {isActive ? 'active' : ''}"
          >
            <item.icon class="nav-icon" />
            <span>{item.label}</span>
            {#if isActive}
              <div class="active-indicator"></div>
            {/if}
          </a>
        </li>
      {/each}
    </ul>
  </nav>

  <!-- Footer -->
  <div class="sidebar-footer">
    <div class="version-badge">
      <span class="dot"></span>
      <span>v2.2.0</span>
    </div>
  </div>
</aside>

<style>
  .logo-icon {
    width: 44px;
    height: 44px;
    background: linear-gradient(135deg, rgba(8, 145, 178, 0.2) 0%, rgba(8, 145, 178, 0.1) 100%);
    border: 1px solid rgba(8, 145, 178, 0.3);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .sidebar-close-btn {
    display: none;
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: transparent;
    border: 1px solid var(--color-border);
    color: var(--color-text-muted);
    cursor: pointer;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }

  .sidebar-close-btn:hover {
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.3);
    color: var(--color-danger);
  }

  .nav-item {
    position: relative;
  }

  .active-indicator {
    position: absolute;
    inset-inline-end: 16px;
    width: 6px;
    height: 6px;
    background: white;
    border-radius: 50%;
    box-shadow: 0 0 10px rgba(255, 255, 255, 0.8);
  }

  .sidebar-footer {
    padding: 16px 24px;
    border-top: 1px solid var(--color-border);
  }

  .version-badge {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--color-text-muted);
  }

  .version-badge .dot {
    width: 8px;
    height: 8px;
    background: var(--color-success);
    border-radius: 50%;
    animation: pulse 2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  /* Mobile backdrop */
  .sidebar-backdrop {
    display: none;
  }

  /* Mobile styles */
  @media (max-width: 768px) {
    .sidebar {
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      z-index: var(--z-modal);
      transform: translateX(100%);
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      width: 280px;
      box-shadow: -4px 0 20px rgba(0, 0, 0, 0.5);
    }

    .sidebar-open {
      transform: translateX(0);
    }

    .sidebar-backdrop {
      display: block;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(4px);
      z-index: var(--z-modal-backdrop);
      animation: backdrop-fade-in 0.2s ease;
    }

    .sidebar-close-btn {
      display: flex;
    }
  }

  @keyframes backdrop-fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  /* Hide sidebar when printing */
  @media print {
    .sidebar {
      display: none !important;
    }
    .sidebar-backdrop {
      display: none !important;
    }
  }
</style>
