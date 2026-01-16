# mikro-dash

MikroTik WiFi Management Dashboard - A web application for managing public WiFi networks (cyber cafes, hotels, restaurants).

## Router Access

- **Host**: 192.168.1.109
- **Username**: admin
- **Password**: need4speed
- **API**: REST API at `http://192.168.1.109/rest`

## Tech Stack

- **Framework**: SvelteKit 2.x with Svelte 5 (runes: `$state`, `$derived`, `$effect`, `$props`)
- **Styling**: TailwindCSS 4.x with RTL support (Arabic)
- **UI Components**: bits-ui, shadcn-svelte, lucide-svelte
- **Database**: SQLite with Drizzle ORM (metadata only)
- **Build**: Vite, Turborepo monorepo
- **Package Manager**: Bun

## Architecture

### Data Sources
- **MikroTik Router** (source of truth): Vouchers, sessions, profiles, hotspot config, data limits (bytes)
- **SQLite Database** (local metadata): Settings, package metadata (prices, Arabic names, code prefixes)

### Key Principle
The router is the source of truth for all operational data. SQLite only stores local metadata that can't be stored in MikroTik (prices, Arabic names, UI preferences). Vouchers are NOT stored locally - they are queried from the router in real-time.

### Project Structure
```
apps/web/
├── data.db                # SQLite database (auto-created)
├── src/
│   ├── lib/
│   │   ├── server/
│   │   │   ├── db/        # SQLite + Drizzle ORM setup
│   │   │   │   ├── index.ts    # Database connection + initialization
│   │   │   │   └── schema.ts   # Tables: settings, packages
│   │   │   ├── config/    # Config service (reads from SQLite)
│   │   │   ├── mikrotik/  # MikroTik REST API client
│   │   │   │   ├── client.ts   # Full API wrapper class
│   │   │   │   └── types.ts    # TypeScript interfaces
│   │   │   └── services/  # Business logic
│   │   │       ├── mikrotik.ts  # Client initialization
│   │   │       ├── vouchers.ts  # Voucher CRUD (router-only)
│   │   │       ├── sessions.ts  # Active sessions
│   │   │       ├── users.ts     # User page data
│   │   │       ├── wifi.ts      # WiFi management
│   │   │       └── dashboard.ts # Dashboard aggregation
│   │   └── components/    # Svelte components
│   └── routes/            # SvelteKit pages
│       ├── /              # Dashboard
│       ├── /vouchers      # Voucher management
│       ├── /vouchers/print # Printable voucher cards
│       ├── /users         # Active users
│       ├── /sessions      # Session details
│       ├── /wifi          # WiFi management
│       ├── /settings      # Router config & packages
│       └── /portal        # Hotspot portal files
└── static/                # Static assets
```

## Database Schema

SQLite stores only local metadata:

```sql
-- App settings (key-value store)
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Package metadata (links to MikroTik profiles)
CREATE TABLE packages (
  id TEXT PRIMARY KEY,           -- e.g., "3GB"
  name TEXT NOT NULL,            -- English name
  name_ar TEXT NOT NULL,         -- Arabic name
  price_le INTEGER NOT NULL,     -- Price in EGP
  bytes_limit INTEGER NOT NULL,  -- Data limit in bytes (0 = unlimited)
  code_prefix TEXT NOT NULL,     -- Voucher prefix (deprecated, kept for compatibility)
  profile TEXT NOT NULL,         -- MikroTik profile name
  server TEXT,                   -- Optional hotspot server
  sort_order INTEGER NOT NULL
);
```

### Default Packages
| ID | Name | Arabic | Price | Data Limit |
|----|------|--------|-------|------------|
| 1.5GB | 1.5 GB | ١.٥ جيجا | 5 LE | 1.61 GB |
| 3GB | 3 GB | ٣ جيجا | 10 LE | 3.22 GB |
| 5GB | 5 GB | ٥ جيجا | 15 LE | 5.37 GB |
| 10GB | 10 GB | ١٠ جيجا | 30 LE | 10.74 GB |

## Development

```bash
# Install dependencies
bun install

# Run development server
bun run dev

# Type check
bun run check

# Build for production
bun run build
```

## Services

Business logic is in `src/lib/server/services/`:
- `mikrotik.ts` - MikroTik client initialization, connection testing
- `vouchers.ts` - Voucher CRUD, generation (creates users on router)
- `sessions.ts` - Active sessions, user management, kick/delete users
- `users.ts` - Combines sessions + wireless clients, time remaining calculation
- `wifi.ts` - Access points, security profiles, MAC blocking
- `dashboard.ts` - Dashboard data aggregation, revenue tracking

## Config Service

`src/lib/server/config/index.ts` provides:
- `getSettings()` / `updateSettings()` - Router credentials, business name
- `getPackages()` / `createPackage()` / `updatePackage()` / `deletePackage()` - Package metadata
- `getPackageByCodePrefix()` - Match voucher name to package

## MikroTik Integration

Uses MikroTik REST API (RouterOS 7.x) with credentials from Router Access section above.

### API Details
- Base URL: `http://192.168.1.109/rest`
- Auth: HTTP Basic (admin:need4speed)
- Key Endpoints:
  - `/ip/hotspot/user` - Voucher users (CRUD)
  - `/ip/hotspot/active` - Active sessions
  - `/ip/hotspot/user-profile` - Profiles with byte/rate limits
  - `/interface/wireless` - WiFi networks
  - `/interface/wireless/registration-table` - Connected devices

### Voucher System
- Code generation: Random 6-char alphanumeric (same as username AND password)
- Comment format: `pkg:PACKAGE_ID|Display Text` (links to local package metadata)
- Status flow: `available` → `used` → `exhausted` (based on byte usage)

### Data Flow
1. **Voucher Creation**: Create hotspot user on router with profile (profile contains byte limit)
2. **Voucher Lookup**: Query router + match with local package metadata for pricing/Arabic names
3. **Sessions**: Query active sessions directly from router
4. **Profiles**: Manage directly on router (rate limits, session timeout, byte limits)

## Notes

- RTL layout (Arabic) - use `start`/`end` instead of `left`/`right`
- Router is the source of truth for vouchers, sessions, and data limits
- Package metadata (prices, Arabic names) stored locally in SQLite
- Profiles on router define the actual byte limits and rate limits
- Page.server.ts files are thin controllers - business logic lives in services
