# Convex Migration Design

**Date**: 2026-02-05
**Status**: Approved
**Goal**: Replace SQLite/Drizzle with Convex for real-time sync across devices

## Motivation

- Real-time sync needed for PlayStation stations, WiFi vouchers, and dashboard stats
- Variable number of devices (1-5+) running simultaneously
- Internet sometimes flaky — need offline support for PS sessions

## Architecture Overview

### Data Ownership

| Layer | Owns | Real-time? |
|-------|------|-----------|
| **MikroTik Router** | Voucher auth, WiFi sessions, profiles | No (poll every 30s) |
| **Convex Cloud** | PS sessions, F&B, menu items, packages, settings, daily stats | Yes |
| **SQLite Local** | MikroTik cache + offline write queue | No (local only) |

### Key Decisions

1. **MikroTik stays as source of truth for vouchers** — Router handles authentication, Convex handles metadata (prices, Arabic names)
2. **Convex cached queries** — Provides stale-while-offline reads
3. **Offline writes queue to SQLite** — PS sessions, orders, F&B sales can be created offline and synced when back online
4. **MikroTik is local network** — Voucher operations work even when internet is down

## Offline Strategy

### When Internet is DOWN

| Operation | Status | How |
|-----------|--------|-----|
| Create/delete vouchers | Works | MikroTik on local network |
| View voucher status | Works | MikroTik on local network |
| View PS sessions, menu, stats | Works (stale) | Convex cached queries |
| Start/end PS sessions | Works | Write to SQLite pending queue |
| Add PS orders | Works | Write to SQLite pending queue |
| F&B standalone sales | Works | Write to SQLite pending queue |
| Edit packages/settings | Wait | Admin tasks, not urgent |

### When Internet RETURNS

1. Detect connectivity change
2. Flush SQLite pending queue to Convex (in order)
3. Handle conflicts (e.g., session ended both locally and remotely)
4. Clear pending queue
5. Convex subscriptions resume with fresh data

## Convex Schema

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  // Settings (key-value store)
  settings: defineTable({
    key: v.string(),
    value: v.string(),
  }).index("by_key", ["key"]),

  // WiFi packages (metadata for MikroTik profiles)
  packages: defineTable({
    name: v.string(),
    nameAr: v.string(),
    priceLE: v.number(),
    bytesLimit: v.number(),
    timeLimit: v.string(),
    profile: v.string(),
    server: v.optional(v.string()),
    sortOrder: v.number(),
  }),

  // PlayStation stations
  psStations: defineTable({
    name: v.string(),
    nameAr: v.string(),
    macAddress: v.string(),
    hourlyRate: v.number(),
    hourlyRateMulti: v.optional(v.number()),
    status: v.string(),
    monitorIp: v.optional(v.string()),
    monitorPort: v.number(),
    monitorType: v.string(),
    timerEndAction: v.string(),
    hdmiInput: v.number(),
    sortOrder: v.number(),
  }),

  // PlayStation sessions
  psSessions: defineTable({
    stationId: v.id("psStations"),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
    hourlyRateSnapshot: v.number(),
    totalCost: v.optional(v.number()),
    ordersCost: v.number(),
    extraCharges: v.number(),
    transferredCost: v.number(),
    currentMode: v.string(),
    timerMinutes: v.optional(v.number()),
    timerNotified: v.boolean(),
    costLimitPiasters: v.optional(v.number()),
    costLimitNotified: v.boolean(),
    pausedAt: v.optional(v.number()),
    totalPausedMs: v.number(),
    notes: v.optional(v.string()),
  }).index("by_station", ["stationId"])
    .index("by_active", ["endedAt"]),

  // Menu items (food/drinks)
  psMenuItems: defineTable({
    name: v.string(),
    nameAr: v.string(),
    category: v.string(),
    price: v.number(),
    isAvailable: v.boolean(),
    sortOrder: v.number(),
  }),

  // Session orders
  psSessionOrders: defineTable({
    sessionId: v.id("psSessions"),
    menuItemId: v.id("psMenuItems"),
    quantity: v.number(),
    priceSnapshot: v.number(),
    createdAt: v.number(),
  }).index("by_session", ["sessionId"]),

  // Session extra charges
  psSessionCharges: defineTable({
    sessionId: v.id("psSessions"),
    amount: v.number(),
    reason: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_session", ["sessionId"]),

  // Session transfers
  psSessionTransfers: defineTable({
    fromSessionId: v.id("psSessions"),
    toSessionId: v.id("psSessions"),
    fromStationId: v.id("psStations"),
    gamingAmount: v.number(),
    ordersAmount: v.number(),
    totalAmount: v.number(),
    createdAt: v.number(),
  }).index("by_from", ["fromSessionId"])
    .index("by_to", ["toSessionId"]),

  // Session segments (single/multi mode tracking)
  psSessionSegments: defineTable({
    sessionId: v.id("psSessions"),
    mode: v.string(),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
    hourlyRateSnapshot: v.number(),
  }).index("by_session", ["sessionId"]),

  // Standalone F&B sales
  fnbSales: defineTable({
    menuItemId: v.id("psMenuItems"),
    quantity: v.number(),
    priceSnapshot: v.number(),
    soldAt: v.number(),
  }).index("by_date", ["soldAt"]),

  // Expenses
  expenses: defineTable({
    type: v.string(),
    category: v.string(),
    name: v.string(),
    nameAr: v.string(),
    amount: v.number(),
    isActive: v.boolean(),
  }),

  // Unified daily stats
  unifiedDailyStats: defineTable({
    date: v.string(),
    wifiRevenue: v.number(),
    wifiVouchersSold: v.number(),
    wifiDataSold: v.number(),
    wifiDataUsed: v.number(),
    psGamingRevenue: v.number(),
    psSessions: v.number(),
    psMinutes: v.number(),
    psOrdersRevenue: v.number(),
    fnbRevenue: v.number(),
    fnbItemsSold: v.number(),
  }).index("by_date", ["date"]),

  // Printed vouchers
  printedVouchers: defineTable({
    voucherCode: v.string(),
    printedAt: v.number(),
  }).index("by_code", ["voucherCode"]),

  // Voucher usage history
  voucherUsage: defineTable({
    voucherCode: v.string(),
    macAddress: v.string(),
    deviceName: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    firstConnectedAt: v.number(),
    lastConnectedAt: v.number(),
    totalBytes: v.number(),
  }).index("by_voucher", ["voucherCode"]),
});
```

## SQLite (Kept Tables)

```sql
-- MikroTik cache (unchanged)
vouchers_cache
sessions_cache

-- NEW: Offline write queue
pending_writes (
  id INTEGER PRIMARY KEY,
  mutation TEXT NOT NULL,
  args TEXT NOT NULL,        -- JSON
  local_id TEXT,
  created_at INTEGER NOT NULL,
  status TEXT DEFAULT 'pending',
  error TEXT,
  retry_count INTEGER DEFAULT 0
)
```

## Implementation Plan

### Phase 1: Setup Convex Project
1. Initialize Convex (`npx convex dev`)
2. Create `convex/schema.ts`
3. Add environment variables
4. Install dependencies (`convex`, `svelte-convex`)

### Phase 2: Data Migration
1. Create `scripts/export-sqlite.ts` — exports SQLite to JSON
2. Create `convex/migrations/importFromSqlite.ts` — import mutations
3. Create `scripts/run-migration.ts` — orchestrates migration
4. Run migration, verify in Convex dashboard

### Phase 3: Convex Queries & Mutations
Create files for each domain:
- `convex/packages.ts`
- `convex/settings.ts`
- `convex/psStations.ts`
- `convex/psSessions.ts`
- `convex/psMenuItems.ts`
- `convex/psSessionOrders.ts`
- `convex/psSessionCharges.ts`
- `convex/psSessionTransfers.ts`
- `convex/psSessionSegments.ts`
- `convex/fnbSales.ts`
- `convex/expenses.ts`
- `convex/unifiedDailyStats.ts`
- `convex/voucherTracking.ts`

### Phase 4: Offline Infrastructure
1. Add `pending_writes` to SQLite schema
2. Create `/api/offline/queue` endpoints
3. Create `/api/health` endpoint
4. Implement `$lib/offline.ts`
5. Implement `$lib/sync.ts`
6. Implement `$lib/optimistic.ts`
7. Implement `$lib/stores/connection.ts`

### Phase 5: SvelteKit Integration
1. Create `$lib/convex.ts`
2. Add `ConvexProvider` to root layout
3. Initialize connection monitor
4. Add connection status banner

### Phase 6: Migrate Pages
Order by complexity (simplest first):
1. Settings page
2. Packages page
3. Menu Items page
4. PS Stations page
5. PS Sessions page (most complex - full offline)
6. F&B Sales page
7. Dashboard
8. Expenses page
9. Vouchers page (MikroTik stays, just UI)

### Phase 7: Testing & Cleanup
1. Test offline scenarios
2. Test conflict resolution
3. Remove old Drizzle queries
4. Update CLAUDE.md

## File Changes Summary

| Action | Files |
|--------|-------|
| Create | `convex/schema.ts` |
| Create | `convex/*.ts` (13 query/mutation files) |
| Create | `convex/migrations/importFromSqlite.ts` |
| Create | `scripts/export-sqlite.ts`, `scripts/run-migration.ts` |
| Create | `src/lib/convex.ts`, `offline.ts`, `sync.ts`, `optimistic.ts` |
| Create | `src/lib/stores/connection.ts` |
| Create | `src/routes/api/offline/queue/+server.ts` |
| Create | `src/routes/api/health/+server.ts` |
| Modify | `src/lib/server/db/schema.ts` (add `pending_writes`) |
| Modify | `src/routes/+layout.svelte` (add provider) |
| Modify | All page files (migrate to Convex) |
| Keep | MikroTik client, voucher services |

## Dependencies

```json
{
  "convex": "^1.x",
  "svelte-convex": "^0.x"
}
```

## Environment Variables

```bash
# .env
PUBLIC_CONVEX_URL=https://your-project.convex.cloud
CONVEX_DEPLOY_KEY=prod:xxx  # For CI/CD
```
