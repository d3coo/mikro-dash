import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  // Settings (key-value store)
  settings: defineTable({
    key: v.string(),
    value: v.string(),
  }).index('by_key', ['key']),

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
    stationId: v.optional(v.string()), // e.g., "PS-01" - user-facing identifier (optional for backfill)
    name: v.string(),
    nameAr: v.string(),
    macAddress: v.string(),
    hourlyRate: v.number(),
    hourlyRateMulti: v.optional(v.number()),
    status: v.string(), // available|occupied|maintenance
    monitorIp: v.optional(v.string()),
    monitorPort: v.number(),
    monitorType: v.string(),
    timerEndAction: v.string(),
    hdmiInput: v.number(),
    sortOrder: v.number(),
    isOnline: v.optional(v.boolean()),
    hasInternet: v.optional(v.boolean()),
  }),

  // PlayStation sessions
  psSessions: defineTable({
    stationId: v.id('psStations'),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
    hourlyRateSnapshot: v.number(),
    totalCost: v.optional(v.number()),
    ordersCost: v.number(),
    extraCharges: v.number(),
    transferredCost: v.number(),
    currentMode: v.string(), // single|multi
    startedBy: v.string(), // manual|auto
    timerMinutes: v.optional(v.number()),
    timerNotified: v.boolean(),
    costLimitPiasters: v.optional(v.number()),
    costLimitNotified: v.boolean(),
    pausedAt: v.optional(v.number()),
    totalPausedMs: v.number(),
    notes: v.optional(v.string()),
  })
    .index('by_station', ['stationId'])
    .index('by_active', ['endedAt']),

  // Menu items (food/drinks)
  psMenuItems: defineTable({
    name: v.string(),
    nameAr: v.string(),
    category: v.string(), // drinks|food|snacks
    price: v.number(), // piasters
    isAvailable: v.boolean(),
    sortOrder: v.number(),
  }),

  // Session orders
  psSessionOrders: defineTable({
    sessionId: v.id('psSessions'),
    menuItemId: v.id('psMenuItems'),
    quantity: v.number(),
    priceSnapshot: v.number(),
    createdAt: v.number(),
  }).index('by_session', ['sessionId']),

  // Session extra charges
  psSessionCharges: defineTable({
    sessionId: v.id('psSessions'),
    amount: v.number(),
    reason: v.optional(v.string()),
    createdAt: v.number(),
  }).index('by_session', ['sessionId']),

  // Session transfers
  psSessionTransfers: defineTable({
    fromSessionId: v.id('psSessions'),
    toSessionId: v.id('psSessions'),
    fromStationId: v.id('psStations'),
    gamingAmount: v.number(),
    ordersAmount: v.number(),
    totalAmount: v.number(),
    createdAt: v.number(),
  })
    .index('by_from', ['fromSessionId'])
    .index('by_to', ['toSessionId']),

  // Session segments (single/multi mode tracking)
  psSessionSegments: defineTable({
    sessionId: v.id('psSessions'),
    mode: v.string(), // single|multi
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
    hourlyRateSnapshot: v.number(),
  }).index('by_session', ['sessionId']),

  // Standalone F&B sales
  fnbSales: defineTable({
    menuItemId: v.id('psMenuItems'),
    quantity: v.number(),
    priceSnapshot: v.number(),
    soldAt: v.number(),
  }).index('by_date', ['soldAt']),

  // Expenses
  expenses: defineTable({
    type: v.string(), // per_gb|fixed_monthly
    category: v.string(), // wifi|playstation|fnb|general
    name: v.string(),
    nameAr: v.string(),
    amount: v.number(), // piasters
    isActive: v.boolean(),
  }),

  // Unified daily stats
  unifiedDailyStats: defineTable({
    date: v.string(), // YYYY-MM-DD
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
  }).index('by_date', ['date']),

  // Printed vouchers
  printedVouchers: defineTable({
    voucherCode: v.string(),
    printedAt: v.number(),
  }).index('by_code', ['voucherCode']),

  // Voucher usage history
  voucherUsage: defineTable({
    voucherCode: v.string(),
    macAddress: v.string(),
    deviceName: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    firstConnectedAt: v.number(),
    lastConnectedAt: v.number(),
    totalBytes: v.number(),
  }).index('by_voucher', ['voucherCode']),
});
