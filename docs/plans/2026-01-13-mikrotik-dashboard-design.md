# MikroTik WiFi Dashboard - Design Document

**Date:** 13-01-2026
**Status:** Approved

---

## Overview

A full-stack SvelteKit 2 web application for managing MikroTik-based WiFi networks. Arabic RTL-first design targeting cyber cafes, small business WiFi providers, and hospitality WiFi administrators.

## Architecture

### Single SvelteKit Full-Stack App

```
apps/web/                    # SvelteKit 2 full-stack app
├── src/
│   ├── lib/
│   │   ├── components/      # UI components (shadcn-svelte)
│   │   ├── server/          # Server-only code
│   │   │   ├── db/          # Drizzle + SQLite
│   │   │   └── mikrotik/    # MikroTik REST API client
│   │   ├── stores/          # Svelte stores (settings, etc.)
│   │   └── i18n/            # Arabic/English translations
│   │
│   └── routes/
│       ├── +layout.svelte   # RTL layout, sidebar, theme
│       ├── +page.svelte     # Dashboard (الرئيسية)
│       ├── vouchers/        # Vouchers (الكروت)
│       ├── users/           # Users (المستخدمين)
│       ├── sessions/        # Sessions (الجلسات)
│       ├── wifi/            # WiFi (الواي فاي)
│       ├── settings/        # Settings (الإعدادات)
│       └── api/             # REST API endpoints
│           ├── vouchers/
│           ├── users/
│           ├── sessions/
│           └── mikrotik/
│
├── drizzle/                 # DB migrations
└── static/                  # Fonts (Cairo, Tajawal)
```

### Key Decisions

- **No separate backend package** - SvelteKit handles everything
- **SQLite via bun:sqlite** - Local database for vouchers, settings
- **MikroTik client** - Server-only module that wraps the REST API
- **RTL-first** - Arabic as primary language, sidebar on right

---

## Database Schema

### Vouchers Table

```typescript
vouchers: {
  id: text (primary key, e.g., "ABO-1G5-001")
  password: text (8 random chars)
  package: text ("1.5GB", "3GB", "5GB", "10GB")
  priceLE: integer (5, 10, 15, 30)
  bytesLimit: integer (bytes)
  status: text ("available", "used", "expired")
  createdAt: text (ISO string)
  usedAt: text (ISO string, nullable)
}
```

### Settings Table

```typescript
settings: {
  key: text (primary key)
  value: text (JSON stringified)
}
// Keys: mikrotik_host, mikrotik_user, mikrotik_pass,
//       hotspot_server, voucher_prefix, business_name, language, theme
```

---

## MikroTik Client

Server-only module wrapping MikroTik REST API:

```typescript
class MikroTikClient {
  constructor(host: string, user: string, pass: string)

  // Hotspot Users
  getUsers(): Promise<HotspotUser[]>
  createUser(username, password, profile, bytesLimit): Promise<void>
  deleteUser(username): Promise<void>

  // Active Sessions
  getSessions(): Promise<ActiveSession[]>
  kickSession(id): Promise<void>

  // WiFi Networks
  getWirelessInterfaces(): Promise<WirelessInterface[]>
  updateSSID(id, ssid): Promise<void>
  updatePassword(securityProfileId, password): Promise<void>
  toggleInterface(id, enabled): Promise<void>

  // System
  getSystemResources(): Promise<SystemResource>
}
```

**Voucher Flow:** Create in SQLite → Sync to MikroTik as hotspot user → Print card

---

## UI Design

### Stack

- **shadcn-svelte** - Pre-built components
- **TailwindCSS 4** - RTL utilities (ms-*, me-*, start, end)
- **Cairo font** - Arabic typography
- **mode-watcher** - Dark/light theme
- **svelte-sonner** - Toast notifications

### RTL Layout

```
┌─────────────────────────────────────────────────┐
│           Dashboard            │   [Sidebar]    │
│                                │                │
│        ┌────────┐ ┌────────┐   │   الرئيسية 🏠  │
│        │ متاح   │ │ نشط    │   │   الكروت 🎫   │
│        │ الكروت │ │ المستخدم│   │  المستخدمين 👥 │
│        │   48   │ │   12   │   │   الجلسات 📡  │
│        └────────┘ └────────┘   │  الواي فاي 📶  │
│                                │  الإعدادات ⚙️  │
│        ┌────────┐ ┌────────┐   │                │
│        │ الراوتر│ │ إيراد  │   │                │
│        │ الحالة │ │ اليوم  │   │                │
│        │   ✓   │ │ 150 ج  │   │                │
│        └────────┘ └────────┘   │                │
└─────────────────────────────────────────────────┘
```

### RTL Implementation

- `dir="rtl"` on `<html>` element
- TailwindCSS logical properties: `ms-4`, `pe-2`, `text-start`
- Sidebar on the **right** side
- Text aligned **right** by default
- Icons **after** text
- Cairo/Tajawal fonts

---

## Implementation Phases

### Phase 1: Project Setup
1. Remove existing Next.js app, create fresh SvelteKit 2 app
2. Configure TailwindCSS 4 with RTL support
3. Add shadcn-svelte components
4. Set up Drizzle ORM + SQLite (bun:sqlite)
5. Add Cairo font, configure RTL layout

### Phase 2: Core Infrastructure
1. Create MikroTik REST client
2. Create database schema + migrations
3. Build settings store
4. Create RTL layout with sidebar navigation

### Phase 3: Dashboard (الرئيسية)
1. API route: `/api/stats`
2. Dashboard page with stat cards
3. Router connection status indicator

### Phase 4: Vouchers (الكروت)
1. API routes: `/api/vouchers` - CRUD
2. Generate vouchers + sync to MikroTik
3. List with filtering, search, bulk delete
4. Print view: 12 cards per A4 with QR codes

### Phase 5: Settings (الإعدادات)
1. Router connection form
2. Business name, voucher prefix
3. Language toggle (AR/EN)
4. Theme toggle (light/dark)

---

## Environment Variables

```env
MIKROTIK_HOST=192.168.1.109
MIKROTIK_USER=admin
MIKROTIK_PASS=your_password
HOTSPOT_SERVER=guest-hotspot
```

---

## Package Dependencies

### Frontend
- svelte, @sveltejs/kit
- tailwindcss, @tailwindcss/vite
- bits-ui, shadcn-svelte
- lucide-svelte
- mode-watcher
- svelte-sonner
- qrcode

### Backend (Server-side)
- drizzle-orm
- better-sqlite3 or bun:sqlite

---

*Approved: 13-01-2026*
