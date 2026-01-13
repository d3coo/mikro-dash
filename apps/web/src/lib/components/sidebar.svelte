<script lang="ts">
  import { page } from '$app/stores';
  import {
    LayoutDashboard,
    Ticket,
    Users,
    Radio,
    Wifi,
    Settings
  } from 'lucide-svelte';

  const navItems = [
    { href: '/', label: 'الرئيسية', icon: LayoutDashboard },
    { href: '/vouchers', label: 'الكروت', icon: Ticket },
    { href: '/users', label: 'المستخدمين', icon: Users },
    { href: '/sessions', label: 'الجلسات', icon: Radio },
    { href: '/wifi', label: 'الواي فاي', icon: Wifi },
    { href: '/settings', label: 'الإعدادات', icon: Settings }
  ];
</script>

<aside class="w-64 bg-white dark:bg-gray-800 border-s border-gray-200 dark:border-gray-700 min-h-screen">
  <div class="p-6 border-b border-gray-200 dark:border-gray-700">
    <h1 class="text-xl font-bold text-primary">لوحة التحكم</h1>
    <p class="text-sm text-gray-500">إدارة الواي فاي</p>
  </div>

  <nav class="p-4">
    <ul class="space-y-2">
      {#each navItems as item}
        {@const isActive = $page.url.pathname === item.href}
        <li>
          <a
            href={item.href}
            class="flex items-center gap-3 px-4 py-3 rounded-lg transition-colors {isActive
              ? 'bg-primary text-white'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}"
          >
            <item.icon class="w-5 h-5" />
            <span class="text-lg">{item.label}</span>
          </a>
        </li>
      {/each}
    </ul>
  </nav>
</aside>
