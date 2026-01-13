# 📋 Product Requirements Document (PRD)
# MikroTik WiFi Management Dashboard

---

## 1. Overview

### 1.1 Product Summary
A modern, Arabic-language web and desktop application for managing MikroTik-based WiFi networks. The dashboard enables creating users, managing vouchers (paid access codes), controlling speeds and limits, and managing WiFi network settings.

### 1.2 Target Users
- Cyber cafe owners
- Small business WiFi providers
- Hotel/restaurant WiFi administrators

### 1.3 Deliverables
- **Web Application** - Browser-based dashboard
- **Desktop Application** - Native Windows/macOS/Linux app

---

## 2. Tech Stack

### 2.1 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      CLIENT APPS                             │
│                                                              │
│  ┌──────────────────┐      ┌──────────────────────────────┐ │
│  │    Web App       │      │      Desktop App             │ │
│  │                  │      │                              │ │
│  │  SvelteKit 2     │      │  Tauri 2                     │ │
│  │  Svelte 5        │      │  + SvelteKit (SSG)           │ │
│  │  TailwindCSS 4   │      │  + Rust Backend              │ │
│  │  shadcn-svelte   │      │  Win/Mac/Linux               │ │
│  └──────────────────┘      └──────────────────────────────┘ │
│                                                              │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP / WebSocket
┌──────────────────────────▼──────────────────────────────────┐
│                      BACKEND API                             │
│                                                              │
│  Elysia + Bun                                                │
│  - REST API + WebSocket                                      │
│  - Eden Treaty (type-safe client)                            │
│  - SQLite + Drizzle ORM                                      │
│                                                              │
└──────────────────────────┬──────────────────────────────────┘
                           │ REST API (Basic Auth)
┌──────────────────────────▼──────────────────────────────────┐
│                   MikroTik Router                            │
│                                                              │
│  hAP ac3 - RouterOS 7.x                                      │
│  REST API: http://192.168.1.109/rest/                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| **SvelteKit** | 2.x | Full-stack framework |
| **Svelte** | 5.x | UI with Runes ($state, $derived, $effect) |
| **TypeScript** | 5.x | Type safety |
| **TailwindCSS** | 4.x | Styling |
| **shadcn-svelte** | latest | UI components (RTL ready) |
| **Superforms** | latest | Form handling |
| **bits-ui** | latest | Headless components |
| **Lucide Svelte** | latest | Icons |
| **mode-watcher** | latest | Dark/light theme |
| **svelte-sonner** | latest | Toast notifications |
| **@tanstack/svelte-query** | latest | Data fetching |
| **qrcode** | latest | QR generation |

### 2.3 Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| **Bun** | 1.x | Runtime |
| **Elysia** | 1.x | Web framework |
| **@elysiajs/eden** | latest | Type-safe API client |
| **@elysiajs/jwt** | latest | Authentication |
| **@elysiajs/cors** | latest | CORS |
| **@elysiajs/swagger** | latest | API docs |
| **Drizzle ORM** | latest | Database |
| **SQLite** | latest | Local DB |
| **TypeBox** | latest | Validation |

### 2.4 Desktop

| Technology | Version | Purpose |
|------------|---------|---------|
| **Tauri** | 2.x | Desktop framework |
| **Rust** | latest | Native backend |
| **tauri-plugin-store** | latest | Local storage |
| **tauri-plugin-autostart** | latest | Start on boot |
| **tauri-plugin-notification** | latest | Notifications |
| **tauri-plugin-updater** | latest | Auto-updates |

### 2.5 Tooling

| Technology | Purpose |
|------------|---------|
| **Turborepo** | Monorepo |
| **pnpm** | Package manager |
| **Biome** | Lint/format |
| **Vitest** | Unit tests |
| **Playwright** | E2E tests |

### 2.6 Project Structure

```
mikrotik-dashboard/
├── apps/
│   ├── web/                  # SvelteKit web app
│   │   ├── src/
│   │   │   ├── lib/
│   │   │   │   ├── components/
│   │   │   │   ├── api/
│   │   │   │   ├── utils/
│   │   │   │   └── i18n/
│   │   │   └── routes/
│   │   └── package.json
│   │
│   └── desktop/              # Tauri app
│       ├── src/
│       ├── src-tauri/
│       └── package.json
│
├── packages/
│   ├── api/                  # Elysia backend
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   ├── services/
│   │   │   └── db/
│   │   └── package.json
│   │
│   └── shared/               # Shared types
│
├── turbo.json
└── pnpm-workspace.yaml
```

---

## 3. MikroTik API Reference

### 3.1 Connection
- **URL:** `http://{ROUTER_IP}/rest/`
- **Auth:** Basic Auth (Base64)
- **Router:** hAP ac3, RouterOS 7.x

### 3.2 Endpoints

| Category | Endpoint | Methods |
|----------|----------|---------|
| **Users** | `/ip/hotspot/user` | GET, add, set, remove |
| **Profiles** | `/ip/hotspot/user/profile` | GET, add, set |
| **Sessions** | `/ip/hotspot/active` | GET, remove |
| **WiFi** | `/interface/wireless` | GET, set |
| **Security** | `/interface/wireless/security-profiles` | GET, set |
| **System** | `/system/resource` | GET |

### 3.3 Data Limits (Bytes)

| Size | Bytes |
|------|-------|
| 500 MB | 524288000 |
| 1 GB | 1073741824 |
| 1.5 GB | 1610612736 |
| 3 GB | 3221225472 |
| 5 GB | 5368709120 |
| 10 GB | 10737418240 |

### 3.4 Rate Limit Format
`{download}/{upload}` — e.g., `5M/5M` for 5 Mbps both ways

---

## 4. Features

### 4.1 Dashboard (الرئيسية)
- Active users count
- Available vouchers count
- Today's revenue
- Network status
- Quick actions

### 4.2 Vouchers (الكروت)
- **Generate:** Single or bulk (1-100)
- **Packages:** 1.5GB/5LE, 3GB/10LE, 5GB/15LE, 10GB/30LE
- **Format:** `ABO-{PKG}-{NUM}` (e.g., ABO-1G5-001)
- **Password:** 8 random characters
- **QR Code:** Auto-login URL
- **Print:** 12 cards per A4 (3×4 grid)
- **List:** Filter, search, bulk delete

### 4.3 Users (المستخدمين)
- Create custom users (staff, VIP)
- Manage profiles (speed, limits)
- Set data/time limits

### 4.4 Sessions (الجلسات)
- Real-time active connections (WebSocket)
- Show: user, IP, MAC, uptime, usage
- Kick users
- Auto-refresh

### 4.5 WiFi (الواي فاي)
- List networks (SSID, band, status)
- Change SSID
- Change password
- Enable/disable networks

### 4.6 Settings (الإعدادات)
- Router connection (IP, credentials)
- Voucher prefix
- Business name
- Language (AR/EN)
- Theme (light/dark)

---

## 5. UI Requirements

### 5.1 Design
- **RTL First:** Full Arabic support
- **Modern:** Clean, minimal
- **Responsive:** Works on tablets
- **Themes:** Light/dark mode

### 5.2 Typography
```css
font-family: 'Cairo', 'Tajawal', sans-serif;
```

### 5.3 Colors
```css
--primary: #2563eb;    /* Blue */
--success: #22c55e;    /* Green */
--warning: #f59e0b;    /* Orange */
--danger: #ef4444;     /* Red */
```

---

## 6. Voucher Card Design

### 6.1 Layout
- **Per page:** 12 cards (3 cols × 4 rows)
- **QR size:** 100×100px minimum

### 6.2 Card Content
```
┌─────────────────────────┐
│   🌐 AboYassen WiFi     │
│        1.5 GB           │
│         5 LE            │
│                         │
│      ┌─────────┐        │
│      │   QR    │        │
│      └─────────┘        │
│                         │
│  User: ABO-1G5-001      │
│  Pass: xK7mQ9p2         │
│                         │
│  Connect → Scan QR      │
└─────────────────────────┘
```

### 6.3 QR Content
```
http://10.10.10.1/login?dst=http://google.com&username={USER}&password={PASS}
```

---

## 7. Network Setup

### 7.1 Architecture
```
ISP Router (192.168.1.1)
      │
      ▼
MikroTik hAP ac3 (192.168.1.109)
├── Main Bridge (192.168.1.0/24)
│   └── "New" WiFi (WPA2)
│
└── Guest Bridge (10.10.10.0/24)
    ├── "Guest-WiFi" (Free, 1Mbps)
    └── "AboYassen" (Paid, 5Mbps)

Hotspot: guest-hotspot
Portal: 10.10.10.1
```

### 7.2 Profiles

| Profile | Speed | Shared Users | Purpose |
|---------|-------|--------------|---------|
| guest-users | 1M/1M | 100 | Free WiFi |
| aboyassen-users | 5M/5M | 1 | Paid vouchers |

### 7.3 Required Router Settings
- Disable Fast Path (IP & Bridge)
- Disable fasttrack firewall rule
- Enable `install-hotspot-queue`
- Enable `http-pap` login method

---

## 8. Environment Variables

```env
# Router
MIKROTIK_HOST=192.168.1.109
MIKROTIK_USER=admin
MIKROTIK_PASS=your_password
HOTSPOT_SERVER=guest-hotspot

# Dashboard
JWT_SECRET=your_jwt_secret
DASHBOARD_USER=admin
DASHBOARD_PASS=secure_password
```

---

## 9. Deployment

### 9.1 Web App
- Run Elysia API server
- Deploy SvelteKit (Node adapter or static)

### 9.2 Desktop App
- Build with Tauri for Win/Mac/Linux
- Bundle API server or connect to remote

### 9.3 Options
- Local PC at cafe
- Raspberry Pi (always-on)
- VPS with VPN to cafe

---

## 10. Future Enhancements

- [ ] SMS voucher delivery
- [ ] Payment integration (Fawry, Vodafone Cash)
- [ ] Customer self-service portal
- [ ] Revenue analytics
- [ ] Multi-router support
- [ ] Mobile app (React Native)

---

*Version: 1.0 | January 2026*
*Router: MikroTik hAP ac3, RouterOS 7.x*
