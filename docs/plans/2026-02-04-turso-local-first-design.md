# Turso Local-First Migration Design

## Overview

Migrate mikro-dash to a local-first architecture using Turso (libsql) with real-time sync, enabling phone access during power outages via Cloudflare Pages deployment.

## Problem Statement

When power goes out, the local server (localhost:3000) becomes unreachable. The owner needs to:
- View PlayStation session times (to know how much to charge customers)
- Manage PS sessions (pause/resume/end)
- View voucher status

## Solution Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     DATA OWNERSHIP                          │
├─────────────────────────────────────────────────────────────┤
│  TURSO-FIRST (local-first)     │  ROUTER + MIRROR          │
│  ─────────────────────────     │  ──────────────           │
│  • PS sessions & segments      │  • Vouchers (hotspot      │
│  • PS orders & charges         │    users)                 │
│  • Menu items                  │  • Active sessions        │
│  • Daily stats & analytics     │  • Data usage (bytes)     │
│  • Expenses                    │  • WiFi networks          │
│  • Settings & packages         │  • Connected devices      │
│  • Revenue tracking            │                           │
└─────────────────────────────────────────────────────────────┘

┌──────────────┐    real-time    ┌──────────────┐
│ Local Server │◄───────────────►│ Turso Cloud  │
│ (libsql)     │      sync       │ (primary)    │
└──────┬───────┘                 └──────┬───────┘
       │                                │
       │ localhost:3000                 │ mikrodash.pages.dev
       ▼                                ▼
┌──────────────┐                 ┌──────────────┐
│  Desktop     │                 │  Phone       │
│  (Power ON)  │                 │  (Power OFF) │
└──────────────┘                 └──────────────┘
       │
       ▼
┌──────────────┐
│  MikroTik    │  ◄── Voucher ops go here
│  Router      │  ◄── Voucher state mirrored back to Turso
└──────────────┘
```

## Sync Strategy

### Local Server (Power ON)
1. App starts → connects to Turso with embedded replica
2. All reads: from local embedded replica (fast)
3. All writes: to Turso cloud → syncs back to local replica (real-time, every 1 second)
4. Router sync: background job mirrors voucher state to Turso every 10 seconds

### Cloudflare Pages (Power OFF / Phone)
1. Connects directly to Turso cloud (no local replica)
2. Reads/writes go straight to cloud
3. When local server comes back, it syncs automatically

### Conflict Handling
Last-write-wins with timestamps. Each write includes `updated_at`. If phone and local both write during brief overlap, newest wins.

## Schema Changes

### New Tables

```sql
-- Mirrored voucher data from router (read-only cache)
CREATE TABLE vouchers_cache (
  id TEXT PRIMARY KEY,              -- MikroTik .id
  code TEXT NOT NULL,               -- Voucher code
  status TEXT NOT NULL,             -- 'available' | 'used' | 'exhausted'
  package_id TEXT,                  -- Links to packages table
  profile TEXT,                     -- MikroTik profile name
  bytes_limit INTEGER,              -- Total allowed bytes
  bytes_used INTEGER DEFAULT 0,     -- bytes_in + bytes_out
  time_limit TEXT,                  -- e.g., '1d', '24h'
  uptime TEXT,                      -- Time used so far
  mac_address TEXT,                 -- Connected device MAC
  device_name TEXT,                 -- From DHCP
  is_online INTEGER DEFAULT 0,      -- 1 if in active sessions
  created_at TEXT,                  -- From router
  last_seen_at TEXT,                -- Last activity
  synced_at TEXT NOT NULL           -- When we last synced this row
);

-- Active sessions cache (for phone viewing)
CREATE TABLE sessions_cache (
  id TEXT PRIMARY KEY,              -- MikroTik .id
  voucher_code TEXT NOT NULL,       -- Links to vouchers_cache
  mac_address TEXT,
  ip_address TEXT,
  bytes_in INTEGER DEFAULT 0,
  bytes_out INTEGER DEFAULT 0,
  uptime TEXT,
  started_at TEXT,
  synced_at TEXT NOT NULL
);
```

### Modifications to Existing Tables

Add sync metadata columns to all Turso-first tables:
- `updated_at TEXT` - When the row was last modified
- `synced_at TEXT` - When the row was last synced (for debugging)

Tables affected: `ps_sessions`, `ps_session_orders`, `ps_session_charges`, `ps_session_transfers`, `ps_session_segments`

## Tech Stack Changes

### Dependencies

```diff
# Remove
- better-sqlite3        # Native SQLite driver

# Add
+ @libsql/client        # Turso client (works in Node, Edge, browser)
```

Drizzle ORM stays - supports libsql driver natively.

### Environment Variables

```env
# Local server (.env)
TURSO_DATABASE_URL=libsql://mikrodash-[org].turso.io
TURSO_AUTH_TOKEN=eyJ...
DATABASE_MODE=local    # Uses embedded replica

# Cloudflare Pages (environment settings)
TURSO_DATABASE_URL=libsql://mikrodash-[org].turso.io
TURSO_AUTH_TOKEN=eyJ...
DATABASE_MODE=remote   # Direct cloud connection
```

### Database Connection

```typescript
// src/lib/server/db/index.ts
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';

const client = createClient({
  url: DATABASE_MODE === 'local'
    ? 'file:./data.db'           // Local embedded replica
    : TURSO_DATABASE_URL,        // Direct to cloud (Cloudflare)
  authToken: TURSO_AUTH_TOKEN,
  syncUrl: TURSO_DATABASE_URL,   // Sync target (local mode only)
  syncInterval: 1000,            // Real-time: sync every 1 second
});

export const db = drizzle(client);
```

## Cloudflare Pages Deployment

### Adapter Change

```diff
- @sveltejs/adapter-auto
+ @sveltejs/adapter-cloudflare
```

### Feature Availability

| Feature | Cloudflare Pages | Local Server |
|---------|------------------|--------------|
| PS session management | ✅ Full | ✅ Full |
| View vouchers | ✅ Cached | ✅ Live |
| Create vouchers | ❌ No | ✅ Yes |
| Router API calls | ❌ No | ✅ Yes |
| Real-time router data | ❌ Cached | ✅ Live |

### UI Handling

Pages that need the router will show "Router unavailable - showing cached data" banner when accessed from Cloudflare deployment.

## Implementation Phases

### Phase 1: Turso Setup
1. Create Turso database (`turso db create mikrodash`)
2. Get connection URL and auth token
3. Replace `better-sqlite3` with `@libsql/client`
4. Update Drizzle config for libsql driver
5. Run schema migrations on Turso

### Phase 2: Local Server Migration
1. Update `src/lib/server/db/index.ts` for embedded replica mode
2. Add `DATABASE_MODE` environment variable handling
3. Add sync metadata columns to PS tables
4. Test existing functionality still works

### Phase 3: Voucher Caching
1. Create `vouchers_cache` and `sessions_cache` tables
2. Build background sync job (router → Turso every 10 seconds)
3. Update voucher display to read from cache when router unavailable
4. Add "cached data" indicators to UI

### Phase 4: Cloudflare Pages Deployment
1. Add `@sveltejs/adapter-cloudflare`
2. Create conditional logic for router-dependent features
3. Add "router unavailable" UI states
4. Deploy to Cloudflare Pages
5. Configure environment variables in Cloudflare dashboard

### Phase 5: Testing & Polish
1. Test local → cloud sync
2. Test phone access during simulated outage
3. Test PS session management from phone
4. Test sync recovery when power returns

## Success Criteria

- [ ] Local server works with Turso embedded replica
- [ ] Real-time sync between local and cloud (< 2 second delay)
- [ ] Cloudflare Pages deployment accessible from phone
- [ ] PS sessions can be managed from phone during power outage
- [ ] Voucher status viewable from phone (cached data)
- [ ] Data syncs correctly when power returns
