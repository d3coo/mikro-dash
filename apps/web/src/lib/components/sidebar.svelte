<script lang="ts">
  import { page } from '$app/stores';
  import {
    LayoutDashboard,
    Ticket,
    Users,
    Radio,
    Wifi,
    Settings,
    Zap,
    Globe
  } from 'lucide-svelte';

  const navItems = [
    { href: '/', label: 'الرئيسية', icon: LayoutDashboard },
    { href: '/vouchers', label: 'الكروت', icon: Ticket },
    { href: '/users', label: 'المستخدمين', icon: Users },
    { href: '/sessions', label: 'الجلسات', icon: Radio },
    { href: '/wifi', label: 'الواي فاي', icon: Wifi },
    { href: '/portal', label: 'البوابة', icon: Globe },
    { href: '/settings', label: 'الإعدادات', icon: Settings }
  ];
</script>

<aside class="sidebar">
  <!-- Logo Section -->
  <div class="sidebar-logo">
    <div class="flex items-center gap-3">
      <div class="logo-icon">
        <Zap class="w-6 h-6 text-primary-light" />
      </div>
      <div>
        <h1>لوحة التحكم</h1>
        <p>إدارة الواي فاي</p>
      </div>
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
      <span>v1.0.0</span>
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
</style>
