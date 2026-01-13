# MikroTik WiFi Dashboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a full-stack SvelteKit 2 RTL Arabic dashboard for managing MikroTik WiFi vouchers.

**Architecture:** Single SvelteKit app with server-side API routes, SQLite database via Drizzle ORM, and MikroTik REST API integration. RTL-first with Arabic as primary language.

**Tech Stack:** SvelteKit 2, Svelte 5, TailwindCSS 4, shadcn-svelte, Drizzle ORM, SQLite, TypeScript

---

## Task 1: Remove Next.js and Create SvelteKit App

**Files:**
- Delete: `apps/web/` (entire directory)
- Delete: `apps/docs/` (entire directory)
- Create: `apps/web/` (fresh SvelteKit app)

**Step 1: Remove existing apps**

```bash
rm -rf apps/web apps/docs
```

**Step 2: Create SvelteKit app**

```bash
cd apps
bunx sv create web --template minimal --types ts --no-add-ons --no-install
```

**Step 3: Update package.json for Bun**

File: `apps/web/package.json`

```json
{
  "name": "web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite dev --port 3000",
    "build": "vite build",
    "preview": "vite preview",
    "check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json",
    "check:watch": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --watch"
  }
}
```

**Step 4: Install dependencies**

```bash
cd apps/web
bun install
```

**Step 5: Verify SvelteKit runs**

```bash
cd apps/web && bun run dev
```
Expected: Server starts at http://localhost:3000

**Step 6: Commit**

```bash
git add -A
git commit -m "chore: replace Next.js with SvelteKit 2 skeleton"
```

---

## Task 2: Configure TailwindCSS 4 with RTL Support

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/src/app.css`
- Modify: `apps/web/src/routes/+layout.svelte`
- Modify: `apps/web/vite.config.ts`

**Step 1: Install TailwindCSS 4**

```bash
cd apps/web
bun add tailwindcss @tailwindcss/vite
```

**Step 2: Configure Vite**

File: `apps/web/vite.config.ts`

```typescript
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()]
});
```

**Step 3: Create app.css with RTL support**

File: `apps/web/src/app.css`

```css
@import 'tailwindcss';

@theme {
  --font-family-cairo: 'Cairo', sans-serif;

  --color-primary: #2563eb;
  --color-success: #22c55e;
  --color-warning: #f59e0b;
  --color-danger: #ef4444;
}

@font-face {
  font-family: 'Cairo';
  src: url('https://fonts.gstatic.com/s/cairo/v28/SLXgc1nY6HkvangtZmpcWmhzfH5lWWgcQyyS4J0.woff2') format('woff2');
  font-weight: 400 700;
  font-display: swap;
}

html {
  font-family: var(--font-family-cairo);
}

/* RTL utilities */
[dir="rtl"] .flip-rtl {
  transform: scaleX(-1);
}
```

**Step 4: Update root layout for RTL**

File: `apps/web/src/routes/+layout.svelte`

```svelte
<script lang="ts">
  import '../app.css';

  let { children } = $props();
</script>

<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700&display=swap" rel="stylesheet" />
</svelte:head>

<div dir="rtl" lang="ar" class="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
  {@render children()}
</div>
```

**Step 5: Test RTL styling**

File: `apps/web/src/routes/+page.svelte`

```svelte
<div class="p-8">
  <h1 class="text-3xl font-bold text-primary mb-4">مرحباً بك</h1>
  <p class="text-gray-600">لوحة تحكم الواي فاي</p>
</div>
```

**Step 6: Run and verify**

```bash
cd apps/web && bun run dev
```
Expected: Arabic text displays RTL with Cairo font

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: add TailwindCSS 4 with RTL support and Cairo font"
```

---

## Task 3: Add shadcn-svelte Components

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/src/lib/components/ui/`
- Create: `apps/web/src/lib/utils.ts`

**Step 1: Install shadcn-svelte dependencies**

```bash
cd apps/web
bun add bits-ui clsx tailwind-merge tailwind-variants lucide-svelte
```

**Step 2: Create utils**

File: `apps/web/src/lib/utils.ts`

```typescript
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

**Step 3: Create Button component**

File: `apps/web/src/lib/components/ui/button/index.ts`

```typescript
import Root, {
  type ButtonProps,
  type ButtonSize,
  type ButtonVariant,
  buttonVariants
} from './button.svelte';

export {
  Root,
  type ButtonProps,
  type ButtonSize,
  type ButtonVariant,
  buttonVariants,
  Root as Button
};
```

File: `apps/web/src/lib/components/ui/button/button.svelte`

```svelte
<script lang="ts" module>
  import { tv, type VariantProps } from 'tailwind-variants';

  export const buttonVariants = tv({
    base: 'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 gap-2',
    variants: {
      variant: {
        default: 'bg-primary text-white hover:bg-primary/90',
        destructive: 'bg-danger text-white hover:bg-danger/90',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline'
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  });

  export type ButtonVariant = VariantProps<typeof buttonVariants>['variant'];
  export type ButtonSize = VariantProps<typeof buttonVariants>['size'];
  export type ButtonProps = {
    variant?: ButtonVariant;
    size?: ButtonSize;
    class?: string;
  } & Partial<HTMLButtonElement>;
</script>

<script lang="ts">
  import { cn } from '$lib/utils';

  let {
    class: className,
    variant = 'default',
    size = 'default',
    children,
    ...restProps
  }: ButtonProps & { children?: import('svelte').Snippet } = $props();
</script>

<button class={cn(buttonVariants({ variant, size }), className)} {...restProps}>
  {@render children?.()}
</button>
```

**Step 4: Create Card component**

File: `apps/web/src/lib/components/ui/card/index.ts`

```typescript
import Root from './card.svelte';
import Content from './card-content.svelte';
import Header from './card-header.svelte';
import Title from './card-title.svelte';

export {
  Root,
  Content,
  Header,
  Title,
  Root as Card,
  Content as CardContent,
  Header as CardHeader,
  Title as CardTitle
};
```

File: `apps/web/src/lib/components/ui/card/card.svelte`

```svelte
<script lang="ts">
  import { cn } from '$lib/utils';

  let { class: className, children, ...restProps }: { class?: string; children?: import('svelte').Snippet } & Record<string, unknown> = $props();
</script>

<div class={cn('rounded-lg border bg-card text-card-foreground shadow-sm', className)} {...restProps}>
  {@render children?.()}
</div>
```

File: `apps/web/src/lib/components/ui/card/card-header.svelte`

```svelte
<script lang="ts">
  import { cn } from '$lib/utils';

  let { class: className, children, ...restProps }: { class?: string; children?: import('svelte').Snippet } & Record<string, unknown> = $props();
</script>

<div class={cn('flex flex-col space-y-1.5 p-6', className)} {...restProps}>
  {@render children?.()}
</div>
```

File: `apps/web/src/lib/components/ui/card/card-title.svelte`

```svelte
<script lang="ts">
  import { cn } from '$lib/utils';

  let { class: className, children, ...restProps }: { class?: string; children?: import('svelte').Snippet } & Record<string, unknown> = $props();
</script>

<h3 class={cn('text-2xl font-semibold leading-none tracking-tight', className)} {...restProps}>
  {@render children?.()}
</h3>
```

File: `apps/web/src/lib/components/ui/card/card-content.svelte`

```svelte
<script lang="ts">
  import { cn } from '$lib/utils';

  let { class: className, children, ...restProps }: { class?: string; children?: import('svelte').Snippet } & Record<string, unknown> = $props();
</script>

<div class={cn('p-6 pt-0', className)} {...restProps}>
  {@render children?.()}
</div>
```

**Step 5: Create index exports**

File: `apps/web/src/lib/components/ui/index.ts`

```typescript
export * from './button';
export * from './card';
```

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: add shadcn-svelte Button and Card components"
```

---

## Task 4: Set Up Database with Drizzle ORM

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/src/lib/server/db/schema.ts`
- Create: `apps/web/src/lib/server/db/index.ts`
- Create: `apps/web/drizzle.config.ts`

**Step 1: Install Drizzle dependencies**

```bash
cd apps/web
bun add drizzle-orm better-sqlite3
bun add -d drizzle-kit @types/better-sqlite3
```

**Step 2: Create database schema**

File: `apps/web/src/lib/server/db/schema.ts`

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const vouchers = sqliteTable('vouchers', {
  id: text('id').primaryKey(), // e.g., "ABO-1G5-001"
  password: text('password').notNull(),
  package: text('package').notNull(), // "1.5GB", "3GB", "5GB", "10GB"
  priceLE: integer('price_le').notNull(),
  bytesLimit: integer('bytes_limit').notNull(),
  status: text('status').notNull().default('available'), // "available", "used", "expired"
  createdAt: text('created_at').notNull(),
  usedAt: text('used_at')
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull()
});

export type Voucher = typeof vouchers.$inferSelect;
export type NewVoucher = typeof vouchers.$inferInsert;
export type Setting = typeof settings.$inferSelect;
```

**Step 3: Create database connection**

File: `apps/web/src/lib/server/db/index.ts`

```typescript
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';

const sqlite = new Database('data.db');
export const db = drizzle(sqlite, { schema });

// Initialize default settings
const defaultSettings = [
  { key: 'mikrotik_host', value: '192.168.1.109' },
  { key: 'mikrotik_user', value: 'admin' },
  { key: 'mikrotik_pass', value: '' },
  { key: 'hotspot_server', value: 'guest-hotspot' },
  { key: 'voucher_prefix', value: 'ABO' },
  { key: 'business_name', value: 'AboYassen WiFi' },
  { key: 'language', value: 'ar' },
  { key: 'theme', value: 'light' }
];

export function initializeDb() {
  // Create tables if not exist
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS vouchers (
      id TEXT PRIMARY KEY,
      password TEXT NOT NULL,
      package TEXT NOT NULL,
      price_le INTEGER NOT NULL,
      bytes_limit INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'available',
      created_at TEXT NOT NULL,
      used_at TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Insert default settings if not exist
  const insertSetting = sqlite.prepare(
    'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)'
  );
  for (const setting of defaultSettings) {
    insertSetting.run(setting.key, setting.value);
  }
}

// Initialize on import
initializeDb();
```

**Step 4: Create Drizzle config**

File: `apps/web/drizzle.config.ts`

```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/lib/server/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: 'data.db'
  }
});
```

**Step 5: Add data.db to gitignore**

Append to `apps/web/.gitignore`:

```
data.db
data.db-journal
```

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: add Drizzle ORM with SQLite schema for vouchers and settings"
```

---

## Task 5: Create MikroTik REST API Client

**Files:**
- Create: `apps/web/src/lib/server/mikrotik/client.ts`
- Create: `apps/web/src/lib/server/mikrotik/types.ts`
- Create: `apps/web/src/lib/server/mikrotik/index.ts`

**Step 1: Create types**

File: `apps/web/src/lib/server/mikrotik/types.ts`

```typescript
export interface HotspotUser {
  '.id': string;
  name: string;
  password?: string;
  profile: string;
  'limit-bytes-total'?: string;
  'bytes-in'?: string;
  'bytes-out'?: string;
  disabled: string;
}

export interface ActiveSession {
  '.id': string;
  user: string;
  address: string;
  'mac-address': string;
  uptime: string;
  'bytes-in': string;
  'bytes-out': string;
  'session-time-left'?: string;
}

export interface WirelessInterface {
  '.id': string;
  name: string;
  ssid: string;
  band: string;
  disabled: string;
  'security-profile': string;
}

export interface SecurityProfile {
  '.id': string;
  name: string;
  mode: string;
  'wpa2-pre-shared-key'?: string;
}

export interface SystemResource {
  uptime: string;
  'cpu-load': string;
  'free-memory': string;
  'total-memory': string;
  'board-name': string;
  version: string;
}

export interface MikroTikConfig {
  host: string;
  username: string;
  password: string;
}
```

**Step 2: Create client**

File: `apps/web/src/lib/server/mikrotik/client.ts`

```typescript
import type {
  MikroTikConfig,
  HotspotUser,
  ActiveSession,
  WirelessInterface,
  SecurityProfile,
  SystemResource
} from './types';

export class MikroTikClient {
  private baseUrl: string;
  private authHeader: string;

  constructor(config: MikroTikConfig) {
    this.baseUrl = `http://${config.host}/rest`;
    this.authHeader = 'Basic ' + btoa(`${config.username}:${config.password}`);
  }

  private async request<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET',
    body?: Record<string, unknown>
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers: {
        'Authorization': this.authHeader,
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`MikroTik API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  // System
  async getSystemResources(): Promise<SystemResource> {
    return this.request<SystemResource>('/system/resource');
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.getSystemResources();
      return true;
    } catch {
      return false;
    }
  }

  // Hotspot Users
  async getHotspotUsers(): Promise<HotspotUser[]> {
    return this.request<HotspotUser[]>('/ip/hotspot/user');
  }

  async createHotspotUser(
    name: string,
    password: string,
    profile: string,
    limitBytes?: number
  ): Promise<void> {
    const body: Record<string, unknown> = {
      name,
      password,
      profile
    };
    if (limitBytes) {
      body['limit-bytes-total'] = limitBytes.toString();
    }
    await this.request('/ip/hotspot/user/add', 'POST', body);
  }

  async deleteHotspotUser(id: string): Promise<void> {
    await this.request(`/ip/hotspot/user/${id}`, 'DELETE');
  }

  // Active Sessions
  async getActiveSessions(): Promise<ActiveSession[]> {
    return this.request<ActiveSession[]>('/ip/hotspot/active');
  }

  async kickSession(id: string): Promise<void> {
    await this.request(`/ip/hotspot/active/${id}`, 'DELETE');
  }

  // WiFi
  async getWirelessInterfaces(): Promise<WirelessInterface[]> {
    return this.request<WirelessInterface[]>('/interface/wireless');
  }

  async updateWirelessSSID(id: string, ssid: string): Promise<void> {
    await this.request(`/interface/wireless/${id}`, 'PATCH', { ssid });
  }

  async toggleWirelessInterface(id: string, disabled: boolean): Promise<void> {
    await this.request(`/interface/wireless/${id}`, 'PATCH', {
      disabled: disabled ? 'true' : 'false'
    });
  }

  async getSecurityProfiles(): Promise<SecurityProfile[]> {
    return this.request<SecurityProfile[]>('/interface/wireless/security-profiles');
  }

  async updateSecurityPassword(id: string, password: string): Promise<void> {
    await this.request(`/interface/wireless/security-profiles/${id}`, 'PATCH', {
      'wpa2-pre-shared-key': password
    });
  }
}
```

**Step 3: Create index export**

File: `apps/web/src/lib/server/mikrotik/index.ts`

```typescript
export { MikroTikClient } from './client';
export * from './types';
```

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: add MikroTik REST API client"
```

---

## Task 6: Create Settings Service

**Files:**
- Create: `apps/web/src/lib/server/services/settings.ts`

**Step 1: Create settings service**

File: `apps/web/src/lib/server/services/settings.ts`

```typescript
import { db } from '$lib/server/db';
import { settings } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { MikroTikClient } from '$lib/server/mikrotik';

export type SettingsKey =
  | 'mikrotik_host'
  | 'mikrotik_user'
  | 'mikrotik_pass'
  | 'hotspot_server'
  | 'voucher_prefix'
  | 'business_name'
  | 'language'
  | 'theme';

export async function getSetting(key: SettingsKey): Promise<string> {
  const result = db.select().from(settings).where(eq(settings.key, key)).get();
  return result?.value ?? '';
}

export async function setSetting(key: SettingsKey, value: string): Promise<void> {
  db.insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } })
    .run();
}

export async function getAllSettings(): Promise<Record<SettingsKey, string>> {
  const rows = db.select().from(settings).all();
  const result: Record<string, string> = {};
  for (const row of rows) {
    result[row.key] = row.value;
  }
  return result as Record<SettingsKey, string>;
}

export async function getMikroTikClient(): Promise<MikroTikClient> {
  const host = await getSetting('mikrotik_host');
  const user = await getSetting('mikrotik_user');
  const pass = await getSetting('mikrotik_pass');

  return new MikroTikClient({
    host,
    username: user,
    password: pass
  });
}
```

**Step 2: Commit**

```bash
git add -A
git commit -m "feat: add settings service"
```

---

## Task 7: Create App Layout with RTL Sidebar

**Files:**
- Modify: `apps/web/src/routes/+layout.svelte`
- Create: `apps/web/src/lib/components/sidebar.svelte`

**Step 1: Create Sidebar component**

File: `apps/web/src/lib/components/sidebar.svelte`

```svelte
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
            <span class="text-lg">{item.label}</span>
            <item.icon class="w-5 h-5" />
          </a>
        </li>
      {/each}
    </ul>
  </nav>
</aside>
```

**Step 2: Update root layout**

File: `apps/web/src/routes/+layout.svelte`

```svelte
<script lang="ts">
  import '../app.css';
  import Sidebar from '$lib/components/sidebar.svelte';

  let { children } = $props();
</script>

<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <title>لوحة التحكم - إدارة الواي فاي</title>
</svelte:head>

<div dir="rtl" lang="ar" class="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
  <div class="flex">
    <!-- Main Content (comes first in RTL) -->
    <main class="flex-1 p-8">
      {@render children()}
    </main>

    <!-- Sidebar (appears on right in RTL) -->
    <Sidebar />
  </div>
</div>
```

**Step 3: Run and verify**

```bash
cd apps/web && bun run dev
```
Expected: Sidebar appears on right side with Arabic labels

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: add RTL sidebar navigation"
```

---

## Task 8: Create Dashboard Page

**Files:**
- Modify: `apps/web/src/routes/+page.svelte`
- Create: `apps/web/src/routes/+page.server.ts`
- Create: `apps/web/src/routes/api/stats/+server.ts`

**Step 1: Create stats API endpoint**

File: `apps/web/src/routes/api/stats/+server.ts`

```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { vouchers } from '$lib/server/db/schema';
import { eq, and, gte } from 'drizzle-orm';
import { getMikroTikClient } from '$lib/server/services/settings';

export const GET: RequestHandler = async () => {
  try {
    // Get voucher stats from local DB
    const allVouchers = db.select().from(vouchers).all();
    const availableVouchers = allVouchers.filter(v => v.status === 'available').length;

    // Get today's used vouchers for revenue
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    const usedToday = allVouchers.filter(
      v => v.status === 'used' && v.usedAt && v.usedAt >= todayISO
    );
    const todayRevenue = usedToday.reduce((sum, v) => sum + v.priceLE, 0);

    // Get active sessions from MikroTik
    let activeUsers = 0;
    let routerConnected = false;

    try {
      const client = await getMikroTikClient();
      const sessions = await client.getActiveSessions();
      activeUsers = sessions.length;
      routerConnected = true;
    } catch {
      routerConnected = false;
    }

    return json({
      activeUsers,
      availableVouchers,
      todayRevenue,
      routerConnected,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Stats API error:', error);
    return json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
};
```

**Step 2: Create page server load**

File: `apps/web/src/routes/+page.server.ts`

```typescript
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { vouchers } from '$lib/server/db/schema';
import { getMikroTikClient, getSetting } from '$lib/server/services/settings';

export const load: PageServerLoad = async () => {
  const allVouchers = db.select().from(vouchers).all();
  const availableVouchers = allVouchers.filter(v => v.status === 'available').length;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString();

  const usedToday = allVouchers.filter(
    v => v.status === 'used' && v.usedAt && v.usedAt >= todayISO
  );
  const todayRevenue = usedToday.reduce((sum, v) => sum + v.priceLE, 0);

  let activeUsers = 0;
  let routerConnected = false;

  try {
    const client = await getMikroTikClient();
    const sessions = await client.getActiveSessions();
    activeUsers = sessions.length;
    routerConnected = true;
  } catch {
    routerConnected = false;
  }

  const businessName = await getSetting('business_name');

  return {
    stats: {
      activeUsers,
      availableVouchers,
      todayRevenue,
      routerConnected
    },
    businessName
  };
};
```

**Step 3: Create Dashboard page**

File: `apps/web/src/routes/+page.svelte`

```svelte
<script lang="ts">
  import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Users, Ticket, Banknote, Wifi, WifiOff } from 'lucide-svelte';

  let { data } = $props();
</script>

<div class="space-y-8">
  <div>
    <h1 class="text-3xl font-bold">{data.businessName}</h1>
    <p class="text-gray-500 mt-1">لوحة التحكم الرئيسية</p>
  </div>

  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
    <!-- Active Users -->
    <Card>
      <CardHeader class="flex flex-row items-center justify-between pb-2">
        <CardTitle class="text-sm font-medium text-gray-500">المستخدمين النشطين</CardTitle>
        <Users class="w-5 h-5 text-primary" />
      </CardHeader>
      <CardContent>
        <div class="text-3xl font-bold">{data.stats.activeUsers}</div>
        <p class="text-xs text-gray-500 mt-1">متصل الآن</p>
      </CardContent>
    </Card>

    <!-- Available Vouchers -->
    <Card>
      <CardHeader class="flex flex-row items-center justify-between pb-2">
        <CardTitle class="text-sm font-medium text-gray-500">الكروت المتاحة</CardTitle>
        <Ticket class="w-5 h-5 text-success" />
      </CardHeader>
      <CardContent>
        <div class="text-3xl font-bold">{data.stats.availableVouchers}</div>
        <p class="text-xs text-gray-500 mt-1">جاهزة للبيع</p>
      </CardContent>
    </Card>

    <!-- Today's Revenue -->
    <Card>
      <CardHeader class="flex flex-row items-center justify-between pb-2">
        <CardTitle class="text-sm font-medium text-gray-500">إيراد اليوم</CardTitle>
        <Banknote class="w-5 h-5 text-warning" />
      </CardHeader>
      <CardContent>
        <div class="text-3xl font-bold">{data.stats.todayRevenue} ج.م</div>
        <p class="text-xs text-gray-500 mt-1">المبيعات اليوم</p>
      </CardContent>
    </Card>

    <!-- Router Status -->
    <Card>
      <CardHeader class="flex flex-row items-center justify-between pb-2">
        <CardTitle class="text-sm font-medium text-gray-500">حالة الراوتر</CardTitle>
        {#if data.stats.routerConnected}
          <Wifi class="w-5 h-5 text-success" />
        {:else}
          <WifiOff class="w-5 h-5 text-danger" />
        {/if}
      </CardHeader>
      <CardContent>
        <div class="text-3xl font-bold">
          {#if data.stats.routerConnected}
            <span class="text-success">متصل</span>
          {:else}
            <span class="text-danger">غير متصل</span>
          {/if}
        </div>
        <p class="text-xs text-gray-500 mt-1">MikroTik</p>
      </CardContent>
    </Card>
  </div>
</div>
```

**Step 4: Run and verify**

```bash
cd apps/web && bun run dev
```
Expected: Dashboard with 4 stat cards in Arabic RTL layout

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add Dashboard page with stats cards"
```

---

## Task 9: Create Voucher Service

**Files:**
- Create: `apps/web/src/lib/server/services/vouchers.ts`
- Create: `apps/web/src/lib/voucher-packages.ts`

**Step 1: Create voucher packages config**

File: `apps/web/src/lib/voucher-packages.ts`

```typescript
export interface VoucherPackage {
  id: string;
  name: string;
  nameAr: string;
  bytes: number;
  priceLE: number;
  profile: string;
}

export const VOUCHER_PACKAGES: VoucherPackage[] = [
  {
    id: '1.5GB',
    name: '1.5 GB',
    nameAr: '١.٥ جيجا',
    bytes: 1610612736,
    priceLE: 5,
    profile: 'aboyassen-users'
  },
  {
    id: '3GB',
    name: '3 GB',
    nameAr: '٣ جيجا',
    bytes: 3221225472,
    priceLE: 10,
    profile: 'aboyassen-users'
  },
  {
    id: '5GB',
    name: '5 GB',
    nameAr: '٥ جيجا',
    bytes: 5368709120,
    priceLE: 15,
    profile: 'aboyassen-users'
  },
  {
    id: '10GB',
    name: '10 GB',
    nameAr: '١٠ جيجا',
    bytes: 10737418240,
    priceLE: 30,
    profile: 'aboyassen-users'
  }
];

export function getPackageById(id: string): VoucherPackage | undefined {
  return VOUCHER_PACKAGES.find(p => p.id === id);
}
```

**Step 2: Create voucher service**

File: `apps/web/src/lib/server/services/vouchers.ts`

```typescript
import { db } from '$lib/server/db';
import { vouchers, type Voucher, type NewVoucher } from '$lib/server/db/schema';
import { eq, and, like } from 'drizzle-orm';
import { getMikroTikClient, getSetting } from './settings';
import { getPackageById, type VoucherPackage } from '$lib/voucher-packages';

function generatePassword(length = 8): string {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function generateVoucherId(pkg: VoucherPackage): Promise<string> {
  const prefix = await getSetting('voucher_prefix');
  const pkgCode = pkg.id.replace('.', '').replace('GB', 'G');

  // Find the highest existing number for this prefix+package
  const existing = db
    .select()
    .from(vouchers)
    .where(like(vouchers.id, `${prefix}-${pkgCode}-%`))
    .all();

  let maxNum = 0;
  for (const v of existing) {
    const parts = v.id.split('-');
    const num = parseInt(parts[parts.length - 1], 10);
    if (num > maxNum) maxNum = num;
  }

  const nextNum = (maxNum + 1).toString().padStart(3, '0');
  return `${prefix}-${pkgCode}-${nextNum}`;
}

export async function createVouchers(
  packageId: string,
  quantity: number
): Promise<Voucher[]> {
  const pkg = getPackageById(packageId);
  if (!pkg) throw new Error(`Invalid package: ${packageId}`);

  const client = await getMikroTikClient();
  const created: Voucher[] = [];
  const now = new Date().toISOString();

  for (let i = 0; i < quantity; i++) {
    const id = await generateVoucherId(pkg);
    const password = generatePassword();

    const newVoucher: NewVoucher = {
      id,
      password,
      package: pkg.id,
      priceLE: pkg.priceLE,
      bytesLimit: pkg.bytes,
      status: 'available',
      createdAt: now
    };

    // Insert into local DB
    db.insert(vouchers).values(newVoucher).run();

    // Sync to MikroTik
    try {
      await client.createHotspotUser(id, password, pkg.profile, pkg.bytes);
    } catch (error) {
      console.error(`Failed to sync voucher ${id} to MikroTik:`, error);
      // Continue anyway - voucher exists locally
    }

    created.push(newVoucher as Voucher);
  }

  return created;
}

export function getVouchers(status?: string): Voucher[] {
  if (status) {
    return db.select().from(vouchers).where(eq(vouchers.status, status)).all();
  }
  return db.select().from(vouchers).all();
}

export function getVoucherById(id: string): Voucher | undefined {
  return db.select().from(vouchers).where(eq(vouchers.id, id)).get();
}

export async function deleteVoucher(id: string): Promise<void> {
  const voucher = getVoucherById(id);
  if (!voucher) return;

  // Delete from MikroTik
  try {
    const client = await getMikroTikClient();
    const users = await client.getHotspotUsers();
    const user = users.find(u => u.name === id);
    if (user) {
      await client.deleteHotspotUser(user['.id']);
    }
  } catch (error) {
    console.error(`Failed to delete voucher ${id} from MikroTik:`, error);
  }

  // Delete from local DB
  db.delete(vouchers).where(eq(vouchers.id, id)).run();
}

export async function deleteVouchers(ids: string[]): Promise<void> {
  for (const id of ids) {
    await deleteVoucher(id);
  }
}
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: add voucher service with MikroTik sync"
```

---

## Task 10: Create Vouchers API Endpoints

**Files:**
- Create: `apps/web/src/routes/api/vouchers/+server.ts`
- Create: `apps/web/src/routes/api/vouchers/[id]/+server.ts`

**Step 1: Create vouchers list/create endpoint**

File: `apps/web/src/routes/api/vouchers/+server.ts`

```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createVouchers, getVouchers, deleteVouchers } from '$lib/server/services/vouchers';

export const GET: RequestHandler = async ({ url }) => {
  const status = url.searchParams.get('status') ?? undefined;
  const vouchers = getVouchers(status);
  return json(vouchers);
};

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { packageId, quantity } = await request.json();

    if (!packageId || !quantity) {
      return json({ error: 'packageId and quantity required' }, { status: 400 });
    }

    if (quantity < 1 || quantity > 100) {
      return json({ error: 'quantity must be 1-100' }, { status: 400 });
    }

    const vouchers = await createVouchers(packageId, quantity);
    return json(vouchers, { status: 201 });
  } catch (error) {
    console.error('Create vouchers error:', error);
    return json({ error: 'Failed to create vouchers' }, { status: 500 });
  }
};

export const DELETE: RequestHandler = async ({ request }) => {
  try {
    const { ids } = await request.json();

    if (!ids || !Array.isArray(ids)) {
      return json({ error: 'ids array required' }, { status: 400 });
    }

    await deleteVouchers(ids);
    return json({ success: true });
  } catch (error) {
    console.error('Delete vouchers error:', error);
    return json({ error: 'Failed to delete vouchers' }, { status: 500 });
  }
};
```

**Step 2: Create single voucher endpoint**

File: `apps/web/src/routes/api/vouchers/[id]/+server.ts`

```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getVoucherById, deleteVoucher } from '$lib/server/services/vouchers';

export const GET: RequestHandler = async ({ params }) => {
  const voucher = getVoucherById(params.id);
  if (!voucher) {
    return json({ error: 'Voucher not found' }, { status: 404 });
  }
  return json(voucher);
};

export const DELETE: RequestHandler = async ({ params }) => {
  try {
    await deleteVoucher(params.id);
    return json({ success: true });
  } catch (error) {
    console.error('Delete voucher error:', error);
    return json({ error: 'Failed to delete voucher' }, { status: 500 });
  }
};
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: add vouchers API endpoints"
```

---

## Task 11: Create Vouchers Page

**Files:**
- Create: `apps/web/src/routes/vouchers/+page.server.ts`
- Create: `apps/web/src/routes/vouchers/+page.svelte`

**Step 1: Create page server load**

File: `apps/web/src/routes/vouchers/+page.server.ts`

```typescript
import type { PageServerLoad, Actions } from './$types';
import { getVouchers, createVouchers, deleteVouchers } from '$lib/server/services/vouchers';
import { VOUCHER_PACKAGES } from '$lib/voucher-packages';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async () => {
  const vouchers = getVouchers();
  return {
    vouchers,
    packages: VOUCHER_PACKAGES
  };
};

export const actions: Actions = {
  generate: async ({ request }) => {
    const formData = await request.formData();
    const packageId = formData.get('packageId') as string;
    const quantity = parseInt(formData.get('quantity') as string, 10);

    if (!packageId) {
      return fail(400, { error: 'يجب اختيار الباقة' });
    }

    if (!quantity || quantity < 1 || quantity > 100) {
      return fail(400, { error: 'الكمية يجب أن تكون بين 1 و 100' });
    }

    try {
      const vouchers = await createVouchers(packageId, quantity);
      return { success: true, created: vouchers.length };
    } catch (error) {
      console.error('Generate vouchers error:', error);
      return fail(500, { error: 'فشل في إنشاء الكروت' });
    }
  },

  delete: async ({ request }) => {
    const formData = await request.formData();
    const ids = formData.getAll('ids') as string[];

    if (!ids.length) {
      return fail(400, { error: 'يجب اختيار كروت للحذف' });
    }

    try {
      await deleteVouchers(ids);
      return { success: true, deleted: ids.length };
    } catch (error) {
      console.error('Delete vouchers error:', error);
      return fail(500, { error: 'فشل في حذف الكروت' });
    }
  }
};
```

**Step 2: Create vouchers page**

File: `apps/web/src/routes/vouchers/+page.svelte`

```svelte
<script lang="ts">
  import { enhance } from '$app/forms';
  import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';
  import { Plus, Trash2, Printer } from 'lucide-svelte';

  let { data, form } = $props();

  let selectedPackage = $state('');
  let quantity = $state(10);
  let selectedIds = $state<string[]>([]);
  let statusFilter = $state('all');

  let filteredVouchers = $derived(
    statusFilter === 'all'
      ? data.vouchers
      : data.vouchers.filter(v => v.status === statusFilter)
  );

  function toggleSelect(id: string) {
    if (selectedIds.includes(id)) {
      selectedIds = selectedIds.filter(i => i !== id);
    } else {
      selectedIds = [...selectedIds, id];
    }
  }

  function selectAll() {
    if (selectedIds.length === filteredVouchers.length) {
      selectedIds = [];
    } else {
      selectedIds = filteredVouchers.map(v => v.id);
    }
  }

  function formatDate(iso: string): string {
    const date = new Date(iso);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${day}-${month}-${year} ${hours}:${minutes}`;
  }

  const statusLabels: Record<string, string> = {
    available: 'متاح',
    used: 'مستخدم',
    expired: 'منتهي'
  };

  const statusColors: Record<string, string> = {
    available: 'bg-green-100 text-green-800',
    used: 'bg-gray-100 text-gray-800',
    expired: 'bg-red-100 text-red-800'
  };
</script>

<div class="space-y-8">
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-3xl font-bold">الكروت</h1>
      <p class="text-gray-500 mt-1">إنشاء وإدارة كروت الواي فاي</p>
    </div>
    <a href="/vouchers/print?ids={selectedIds.join(',')}" class="inline-block">
      <Button variant="outline" disabled={selectedIds.length === 0}>
        <span>طباعة ({selectedIds.length})</span>
        <Printer class="w-4 h-4" />
      </Button>
    </a>
  </div>

  {#if form?.error}
    <div class="bg-red-50 text-red-800 p-4 rounded-lg">{form.error}</div>
  {/if}

  {#if form?.success}
    <div class="bg-green-50 text-green-800 p-4 rounded-lg">
      تم بنجاح! {form.created ? `تم إنشاء ${form.created} كرت` : ''}
      {form.deleted ? `تم حذف ${form.deleted} كرت` : ''}
    </div>
  {/if}

  <!-- Generate Form -->
  <Card>
    <CardHeader>
      <CardTitle>إنشاء كروت جديدة</CardTitle>
    </CardHeader>
    <CardContent>
      <form method="POST" action="?/generate" use:enhance class="flex flex-wrap gap-4 items-end">
        <div class="flex-1 min-w-[200px]">
          <label class="block text-sm font-medium mb-2">الباقة</label>
          <select
            name="packageId"
            bind:value={selectedPackage}
            class="w-full p-2 border rounded-lg bg-white dark:bg-gray-800"
            required
          >
            <option value="">اختر الباقة...</option>
            {#each data.packages as pkg}
              <option value={pkg.id}>{pkg.nameAr} - {pkg.priceLE} ج.م</option>
            {/each}
          </select>
        </div>

        <div class="w-32">
          <label class="block text-sm font-medium mb-2">الكمية</label>
          <input
            type="number"
            name="quantity"
            bind:value={quantity}
            min="1"
            max="100"
            class="w-full p-2 border rounded-lg bg-white dark:bg-gray-800"
            required
          />
        </div>

        <Button type="submit">
          <span>إنشاء</span>
          <Plus class="w-4 h-4" />
        </Button>
      </form>
    </CardContent>
  </Card>

  <!-- Vouchers List -->
  <Card>
    <CardHeader class="flex flex-row items-center justify-between">
      <CardTitle>قائمة الكروت ({filteredVouchers.length})</CardTitle>
      <div class="flex gap-2">
        <select
          bind:value={statusFilter}
          class="p-2 border rounded-lg bg-white dark:bg-gray-800 text-sm"
        >
          <option value="all">الكل</option>
          <option value="available">متاح</option>
          <option value="used">مستخدم</option>
          <option value="expired">منتهي</option>
        </select>

        {#if selectedIds.length > 0}
          <form method="POST" action="?/delete" use:enhance>
            {#each selectedIds as id}
              <input type="hidden" name="ids" value={id} />
            {/each}
            <Button type="submit" variant="destructive" size="sm">
              <span>حذف ({selectedIds.length})</span>
              <Trash2 class="w-4 h-4" />
            </Button>
          </form>
        {/if}
      </div>
    </CardHeader>
    <CardContent>
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="border-b">
              <th class="p-3 text-start">
                <input
                  type="checkbox"
                  checked={selectedIds.length === filteredVouchers.length && filteredVouchers.length > 0}
                  onchange={selectAll}
                  class="w-4 h-4"
                />
              </th>
              <th class="p-3 text-start">الكود</th>
              <th class="p-3 text-start">كلمة المرور</th>
              <th class="p-3 text-start">الباقة</th>
              <th class="p-3 text-start">السعر</th>
              <th class="p-3 text-start">الحالة</th>
              <th class="p-3 text-start">تاريخ الإنشاء</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredVouchers as voucher}
              <tr class="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                <td class="p-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(voucher.id)}
                    onchange={() => toggleSelect(voucher.id)}
                    class="w-4 h-4"
                  />
                </td>
                <td class="p-3 font-mono">{voucher.id}</td>
                <td class="p-3 font-mono">{voucher.password}</td>
                <td class="p-3">{voucher.package}</td>
                <td class="p-3">{voucher.priceLE} ج.م</td>
                <td class="p-3">
                  <span class="px-2 py-1 rounded-full text-xs {statusColors[voucher.status]}">
                    {statusLabels[voucher.status]}
                  </span>
                </td>
                <td class="p-3 text-sm text-gray-500">{formatDate(voucher.createdAt)}</td>
              </tr>
            {/each}
          </tbody>
        </table>

        {#if filteredVouchers.length === 0}
          <div class="text-center py-8 text-gray-500">
            لا توجد كروت
          </div>
        {/if}
      </div>
    </CardContent>
  </Card>
</div>
```

**Step 3: Run and verify**

```bash
cd apps/web && bun run dev
```
Expected: Vouchers page with generate form and list table

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: add Vouchers page with generate and list"
```

---

## Task 12: Create Print Page for Vouchers

**Files:**
- Create: `apps/web/src/routes/vouchers/print/+page.server.ts`
- Create: `apps/web/src/routes/vouchers/print/+page.svelte`

**Step 1: Install QR code library**

```bash
cd apps/web
bun add qrcode
bun add -d @types/qrcode
```

**Step 2: Create print page server**

File: `apps/web/src/routes/vouchers/print/+page.server.ts`

```typescript
import type { PageServerLoad } from './$types';
import { getVoucherById } from '$lib/server/services/vouchers';
import { getSetting } from '$lib/server/services/settings';
import { getPackageById } from '$lib/voucher-packages';

export const load: PageServerLoad = async ({ url }) => {
  const idsParam = url.searchParams.get('ids') ?? '';
  const ids = idsParam.split(',').filter(Boolean);

  const vouchers = ids
    .map(id => getVoucherById(id))
    .filter((v): v is NonNullable<typeof v> => v !== undefined)
    .map(v => ({
      ...v,
      pkg: getPackageById(v.package)
    }));

  const businessName = await getSetting('business_name');

  return {
    vouchers,
    businessName
  };
};
```

**Step 3: Create print page**

File: `apps/web/src/routes/vouchers/print/+page.svelte`

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import QRCode from 'qrcode';

  let { data } = $props();

  let qrCodes = $state<Record<string, string>>({});

  onMount(async () => {
    for (const voucher of data.vouchers) {
      const loginUrl = `http://10.10.10.1/login?dst=http://google.com&username=${voucher.id}&password=${voucher.password}`;
      qrCodes[voucher.id] = await QRCode.toDataURL(loginUrl, {
        width: 100,
        margin: 1
      });
    }
  });

  function print() {
    window.print();
  }
</script>

<svelte:head>
  <title>طباعة الكروت</title>
  <style>
    @media print {
      body { margin: 0; padding: 0; }
      .no-print { display: none !important; }
      .print-page { page-break-after: always; }
    }
  </style>
</svelte:head>

<div class="no-print p-4 bg-gray-100 flex justify-between items-center">
  <span>عدد الكروت: {data.vouchers.length}</span>
  <button
    onclick={print}
    class="bg-primary text-white px-4 py-2 rounded-lg"
  >
    طباعة
  </button>
</div>

<div dir="rtl" class="p-4">
  <!-- 12 cards per page: 3 columns × 4 rows -->
  {#each Array(Math.ceil(data.vouchers.length / 12)) as _, pageIndex}
    <div class="print-page grid grid-cols-3 gap-4">
      {#each data.vouchers.slice(pageIndex * 12, (pageIndex + 1) * 12) as voucher}
        <div class="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
          <!-- Header -->
          <div class="text-lg font-bold text-primary mb-1">
            🌐 {data.businessName}
          </div>

          <!-- Package Info -->
          <div class="text-2xl font-bold">{voucher.pkg?.nameAr}</div>
          <div class="text-xl text-gray-600">{voucher.priceLE} ج.م</div>

          <!-- QR Code -->
          <div class="my-4 flex justify-center">
            {#if qrCodes[voucher.id]}
              <img src={qrCodes[voucher.id]} alt="QR" class="w-24 h-24" />
            {:else}
              <div class="w-24 h-24 bg-gray-200 animate-pulse"></div>
            {/if}
          </div>

          <!-- Credentials -->
          <div class="text-sm space-y-1">
            <div>
              <span class="text-gray-500">المستخدم:</span>
              <span class="font-mono font-bold">{voucher.id}</span>
            </div>
            <div>
              <span class="text-gray-500">كلمة المرور:</span>
              <span class="font-mono font-bold">{voucher.password}</span>
            </div>
          </div>

          <!-- Instructions -->
          <div class="mt-3 text-xs text-gray-500">
            اتصل بالشبكة ← امسح الكود
          </div>
        </div>
      {/each}
    </div>
  {/each}
</div>
```

**Step 4: Run and verify**

```bash
cd apps/web && bun run dev
```
Expected: Print page with voucher cards and QR codes

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add voucher print page with QR codes"
```

---

## Task 13: Create Settings Page

**Files:**
- Create: `apps/web/src/routes/settings/+page.server.ts`
- Create: `apps/web/src/routes/settings/+page.svelte`

**Step 1: Create settings page server**

File: `apps/web/src/routes/settings/+page.server.ts`

```typescript
import type { PageServerLoad, Actions } from './$types';
import { getAllSettings, setSetting, getMikroTikClient } from '$lib/server/services/settings';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async () => {
  const settings = await getAllSettings();
  return { settings };
};

export const actions: Actions = {
  save: async ({ request }) => {
    const formData = await request.formData();

    const fields = [
      'mikrotik_host',
      'mikrotik_user',
      'mikrotik_pass',
      'hotspot_server',
      'voucher_prefix',
      'business_name'
    ] as const;

    try {
      for (const field of fields) {
        const value = formData.get(field) as string;
        if (value !== null) {
          await setSetting(field, value);
        }
      }
      return { success: true };
    } catch (error) {
      console.error('Save settings error:', error);
      return fail(500, { error: 'فشل في حفظ الإعدادات' });
    }
  },

  testConnection: async () => {
    try {
      const client = await getMikroTikClient();
      const connected = await client.testConnection();

      if (connected) {
        const resources = await client.getSystemResources();
        return {
          testResult: {
            success: true,
            message: `متصل بنجاح! ${resources['board-name']} - ${resources.version}`
          }
        };
      } else {
        return {
          testResult: {
            success: false,
            message: 'فشل الاتصال بالراوتر'
          }
        };
      }
    } catch (error) {
      return {
        testResult: {
          success: false,
          message: `خطأ: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      };
    }
  }
};
```

**Step 2: Create settings page**

File: `apps/web/src/routes/settings/+page.svelte`

```svelte
<script lang="ts">
  import { enhance } from '$app/forms';
  import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';
  import { Save, Wifi } from 'lucide-svelte';

  let { data, form } = $props();

  let settings = $state({ ...data.settings });
</script>

<div class="space-y-8">
  <div>
    <h1 class="text-3xl font-bold">الإعدادات</h1>
    <p class="text-gray-500 mt-1">إعدادات الاتصال والتطبيق</p>
  </div>

  {#if form?.error}
    <div class="bg-red-50 text-red-800 p-4 rounded-lg">{form.error}</div>
  {/if}

  {#if form?.success}
    <div class="bg-green-50 text-green-800 p-4 rounded-lg">تم حفظ الإعدادات بنجاح</div>
  {/if}

  {#if form?.testResult}
    <div class="p-4 rounded-lg {form.testResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}">
      {form.testResult.message}
    </div>
  {/if}

  <form method="POST" action="?/save" use:enhance class="space-y-6">
    <!-- Router Connection -->
    <Card>
      <CardHeader>
        <CardTitle>اتصال الراوتر</CardTitle>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium mb-2">عنوان IP</label>
            <input
              type="text"
              name="mikrotik_host"
              bind:value={settings.mikrotik_host}
              class="w-full p-2 border rounded-lg bg-white dark:bg-gray-800"
              placeholder="192.168.1.109"
            />
          </div>

          <div>
            <label class="block text-sm font-medium mb-2">اسم المستخدم</label>
            <input
              type="text"
              name="mikrotik_user"
              bind:value={settings.mikrotik_user}
              class="w-full p-2 border rounded-lg bg-white dark:bg-gray-800"
              placeholder="admin"
            />
          </div>

          <div>
            <label class="block text-sm font-medium mb-2">كلمة المرور</label>
            <input
              type="password"
              name="mikrotik_pass"
              bind:value={settings.mikrotik_pass}
              class="w-full p-2 border rounded-lg bg-white dark:bg-gray-800"
            />
          </div>

          <div>
            <label class="block text-sm font-medium mb-2">سيرفر Hotspot</label>
            <input
              type="text"
              name="hotspot_server"
              bind:value={settings.hotspot_server}
              class="w-full p-2 border rounded-lg bg-white dark:bg-gray-800"
              placeholder="guest-hotspot"
            />
          </div>
        </div>

        <div class="pt-2">
          <form method="POST" action="?/testConnection" use:enhance class="inline">
            <Button type="submit" variant="outline">
              <span>اختبار الاتصال</span>
              <Wifi class="w-4 h-4" />
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>

    <!-- Business Settings -->
    <Card>
      <CardHeader>
        <CardTitle>إعدادات العمل</CardTitle>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium mb-2">اسم العمل</label>
            <input
              type="text"
              name="business_name"
              bind:value={settings.business_name}
              class="w-full p-2 border rounded-lg bg-white dark:bg-gray-800"
              placeholder="AboYassen WiFi"
            />
          </div>

          <div>
            <label class="block text-sm font-medium mb-2">بادئة الكروت</label>
            <input
              type="text"
              name="voucher_prefix"
              bind:value={settings.voucher_prefix}
              class="w-full p-2 border rounded-lg bg-white dark:bg-gray-800"
              placeholder="ABO"
              maxlength="5"
            />
          </div>
        </div>
      </CardContent>
    </Card>

    <div class="flex justify-end">
      <Button type="submit">
        <span>حفظ الإعدادات</span>
        <Save class="w-4 h-4" />
      </Button>
    </div>
  </form>
</div>
```

**Step 3: Run and verify**

```bash
cd apps/web && bun run dev
```
Expected: Settings page with router connection and business settings forms

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: add Settings page with router connection test"
```

---

## Task 14: Create Placeholder Pages

**Files:**
- Create: `apps/web/src/routes/users/+page.svelte`
- Create: `apps/web/src/routes/sessions/+page.svelte`
- Create: `apps/web/src/routes/wifi/+page.svelte`

**Step 1: Create Users placeholder**

File: `apps/web/src/routes/users/+page.svelte`

```svelte
<script lang="ts">
  import { Card, CardContent } from '$lib/components/ui/card';
  import { Users } from 'lucide-svelte';
</script>

<div class="space-y-8">
  <div>
    <h1 class="text-3xl font-bold">المستخدمين</h1>
    <p class="text-gray-500 mt-1">إدارة مستخدمي الواي فاي</p>
  </div>

  <Card>
    <CardContent class="py-16 text-center">
      <Users class="w-16 h-16 mx-auto text-gray-300 mb-4" />
      <p class="text-gray-500">قريباً...</p>
    </CardContent>
  </Card>
</div>
```

**Step 2: Create Sessions placeholder**

File: `apps/web/src/routes/sessions/+page.svelte`

```svelte
<script lang="ts">
  import { Card, CardContent } from '$lib/components/ui/card';
  import { Radio } from 'lucide-svelte';
</script>

<div class="space-y-8">
  <div>
    <h1 class="text-3xl font-bold">الجلسات</h1>
    <p class="text-gray-500 mt-1">الاتصالات النشطة حالياً</p>
  </div>

  <Card>
    <CardContent class="py-16 text-center">
      <Radio class="w-16 h-16 mx-auto text-gray-300 mb-4" />
      <p class="text-gray-500">قريباً...</p>
    </CardContent>
  </Card>
</div>
```

**Step 3: Create WiFi placeholder**

File: `apps/web/src/routes/wifi/+page.svelte`

```svelte
<script lang="ts">
  import { Card, CardContent } from '$lib/components/ui/card';
  import { Wifi } from 'lucide-svelte';
</script>

<div class="space-y-8">
  <div>
    <h1 class="text-3xl font-bold">الواي فاي</h1>
    <p class="text-gray-500 mt-1">إدارة شبكات الواي فاي</p>
  </div>

  <Card>
    <CardContent class="py-16 text-center">
      <Wifi class="w-16 h-16 mx-auto text-gray-300 mb-4" />
      <p class="text-gray-500">قريباً...</p>
    </CardContent>
  </Card>
</div>
```

**Step 4: Run final verification**

```bash
cd apps/web && bun run dev
```
Expected: All navigation items work, Dashboard and Vouchers fully functional

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add placeholder pages for Users, Sessions, WiFi"
```

---

## Final Verification

**Run the complete app:**

```bash
cd apps/web && bun run dev
```

**Test checklist:**
- [ ] Dashboard loads with stats cards
- [ ] Sidebar navigation works (RTL, right side)
- [ ] Arabic text displays correctly with Cairo font
- [ ] Vouchers: Generate creates vouchers in DB
- [ ] Vouchers: List displays with filtering
- [ ] Vouchers: Print page shows cards with QR codes
- [ ] Settings: Save and test connection work
- [ ] All placeholder pages accessible

**Final commit:**

```bash
git add -A
git commit -m "feat: complete MikroTik WiFi Dashboard MVP

- Dashboard with stats cards
- Voucher generation with MikroTik sync
- Voucher list with filtering and bulk delete
- Print page with QR codes (12 per A4)
- Settings page with connection test
- RTL Arabic-first UI with Cairo font
- SQLite database with Drizzle ORM"
```

---

*Plan complete. Ready for execution.*
