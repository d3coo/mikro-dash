# mikro-dash

MikroTik WiFi Management Dashboard - A web application for managing public WiFi networks (cyber cafes, hotels, restaurants).

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
│   │   │   └── services/  # Business logic
│   │   │       ├── mikrotik.ts  # Client initialization
│   │   │       ├── vouchers.ts  # Voucher CRUD (router-only)
│   │   │       ├── sessions.ts  # Active sessions
│   │   │       └── dashboard.ts # Dashboard aggregation
│   │   └── components/    # Svelte components
│   └── routes/            # SvelteKit pages (thin controllers)
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
  code_prefix TEXT NOT NULL,     -- Voucher prefix e.g., "G3"
  profile TEXT NOT NULL,         -- MikroTik profile name
  server TEXT,                   -- Optional hotspot server
  sort_order INTEGER NOT NULL
);
```

Note: Data limits (bytes) come from MikroTik profiles at runtime, not stored locally.

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
- `sessions.ts` - Active sessions, user management
- `dashboard.ts` - Dashboard data aggregation

## Config Service

`src/lib/server/config/index.ts` provides:
- `getSettings()` / `updateSettings()` - Router credentials, business name
- `getPackages()` / `createPackage()` / `updatePackage()` / `deletePackage()` - Package metadata
- `getPackageByCodePrefix()` - Match voucher name to package

## MikroTik Integration

Uses MikroTik REST API (RouterOS 7.x):
- Base URL: `http://{host}/rest`
- Auth: HTTP Basic
- Endpoints: `/ip/hotspot/user`, `/ip/hotspot/active`, `/ip/hotspot/user-profile`, etc.

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
