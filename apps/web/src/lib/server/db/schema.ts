import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// Settings table - key/value store for app configuration
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull()
});

// Package metadata - local info that can't be stored in MikroTik
// Links to MikroTik profiles by profile name
export const packages = sqliteTable('packages', {
  id: text('id').primaryKey(),           // e.g., "3GB"
  name: text('name').notNull(),           // English name: "3 GB"
  nameAr: text('name_ar').notNull(),      // Arabic name: "٣ جيجا"
  priceLE: integer('price_le').notNull(), // Price in Egyptian Pounds
  bytesLimit: integer('bytes_limit').notNull().default(0), // Data limit in bytes (0 = unlimited)
  timeLimit: text('time_limit').default('1d'), // Total uptime limit e.g., "1d", "12h" (MikroTik format)
  codePrefix: text('code_prefix').notNull(), // Voucher code prefix: "G3" (deprecated)
  profile: text('profile').notNull(),     // MikroTik profile name (links to router)
  server: text('server'),                 // Optional: restrict to specific hotspot server
  sortOrder: integer('sort_order').notNull().default(0)
});

// Voucher usage history - tracks which device used which voucher
export const voucherUsage = sqliteTable('voucher_usage', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  voucherCode: text('voucher_code').notNull(),        // The voucher code (e.g., "TBJ26N")
  macAddress: text('mac_address').notNull(),          // Device MAC address
  deviceName: text('device_name'),                    // Device name from DHCP (e.g., "Redmi Note 8 Pro")
  ipAddress: text('ip_address'),                      // Last known IP
  firstConnectedAt: integer('first_connected_at').notNull(), // Timestamp of first connection
  lastConnectedAt: integer('last_connected_at').notNull(),   // Timestamp of last seen
  totalBytes: integer('total_bytes').default(0),      // Total bytes used
});

// Expenses - tracks costs for profit calculation
export const expenses = sqliteTable('expenses', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  type: text('type').notNull(),                       // 'per_gb' | 'fixed_monthly'
  category: text('category').notNull().default('general'), // 'wifi' | 'playstation' | 'fnb' | 'general'
  name: text('name').notNull(),                       // English name: "ISP Data Cost"
  nameAr: text('name_ar').notNull(),                  // Arabic name: "تكلفة البيانات"
  amount: integer('amount').notNull(),                // Amount in piasters (1/100 EGP) for precision
  isActive: integer('is_active').notNull().default(1), // 1 = active, 0 = inactive
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
});

// Printed vouchers - tracks which vouchers have been printed
export const printedVouchers = sqliteTable('printed_vouchers', {
  voucherCode: text('voucher_code').primaryKey(),    // The voucher code (e.g., "TBJ26N")
  printedAt: integer('printed_at').notNull(),        // Timestamp when printed
});

// Daily stats - pre-aggregated statistics for performance
export const dailyStats = sqliteTable('daily_stats', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  date: text('date').notNull().unique(),              // YYYY-MM-DD format
  vouchersSold: integer('vouchers_sold').notNull().default(0),
  revenue: integer('revenue').notNull().default(0),   // In piasters (1/100 EGP)
  dataSold: integer('data_sold').notNull().default(0),     // Total bytes from packages sold
  dataUsed: integer('data_used').notNull().default(0),     // Actual bytes consumed
  salesByPackage: text('sales_by_package').notNull().default('{}'), // JSON: { "3GB": 5, "5GB": 3 }
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
});

// PlayStation stations
export const psStations = sqliteTable('ps_stations', {
  id: text('id').primaryKey(),                    // e.g., "PS-01"
  name: text('name').notNull(),                   // "Station 1"
  nameAr: text('name_ar').notNull(),              // "جهاز ١"
  macAddress: text('mac_address').notNull(),      // PlayStation MAC
  hourlyRate: integer('hourly_rate').notNull(),   // Piasters (2000 = 20 EGP/hr) - single player rate
  hourlyRateMulti: integer('hourly_rate_multi'),  // Piasters - multi player rate (null = same as single)
  status: text('status').notNull().default('available'), // available|occupied|maintenance
  monitorIp: text('monitor_ip'),                  // Android monitor IP (e.g., "10.10.10.188")
  monitorPort: integer('monitor_port').default(8080), // FreeKiosk API port (default 8080)
  monitorType: text('monitor_type').default('tcl'), // 'tcl' | 'skyworth' - affects ADB commands
  timerEndAction: text('timer_end_action').default('notify'), // 'notify' | 'screen_off'
  hdmiInput: integer('hdmi_input').default(2),    // HDMI input number (1-4)
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
});

// PlayStation time-based sessions
export const psSessions = sqliteTable('ps_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  stationId: text('station_id').notNull(),
  startedAt: integer('started_at').notNull(),
  endedAt: integer('ended_at'),                   // NULL = active
  hourlyRateSnapshot: integer('hourly_rate_snapshot').notNull(), // Rate at start (single player)
  totalCost: integer('total_cost'),               // Calculated on end (piasters) - gaming cost only
  ordersCost: integer('orders_cost').default(0),  // Total food/drinks cost (piasters)
  extraCharges: integer('extra_charges').default(0), // Additional charges (piasters)
  transferredCost: integer('transferred_cost').default(0), // Cost transferred from other sessions (piasters)
  currentMode: text('current_mode').default('single'), // 'single' | 'multi' - current player mode
  startedBy: text('started_by').notNull().default('manual'), // manual|auto
  timerMinutes: integer('timer_minutes'),         // Optional timer (30, 60, etc.) - NULL = no timer
  timerNotified: integer('timer_notified').default(0), // 1 = notification sent
  costLimitPiasters: integer('cost_limit_piasters'), // Optional cost limit (1000 = 10 EGP) - NULL = no limit
  costLimitNotified: integer('cost_limit_notified').default(0), // 1 = notification sent when limit reached
  pausedAt: integer('paused_at'),                 // Timestamp when PS went offline (NULL = not paused)
  totalPausedMs: integer('total_paused_ms').default(0), // Total milliseconds session was paused
  notes: text('notes'),
  createdAt: integer('created_at').notNull()
});

// PlayStation daily stats
export const psDailyStats = sqliteTable('ps_daily_stats', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  date: text('date').notNull().unique(),          // YYYY-MM-DD
  totalSessions: integer('total_sessions').notNull().default(0),
  totalMinutes: integer('total_minutes').notNull().default(0),
  totalRevenue: integer('total_revenue').notNull().default(0),
  sessionsByStation: text('sessions_by_station').notNull().default('{}'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
});

// PlayStation menu items (food/drinks)
export const psMenuItems = sqliteTable('ps_menu_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),                   // "Pepsi"
  nameAr: text('name_ar').notNull(),              // "بيبسي"
  category: text('category').notNull(),           // "drinks" | "food" | "snacks"
  price: integer('price').notNull(),              // Price in piasters (500 = 5 EGP)
  isAvailable: integer('is_available').notNull().default(1),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
});

// PlayStation session orders (items ordered during a session)
export const psSessionOrders = sqliteTable('ps_session_orders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: integer('session_id').notNull(),     // Links to ps_sessions
  menuItemId: integer('menu_item_id').notNull(),  // Links to ps_menu_items
  quantity: integer('quantity').notNull().default(1),
  priceSnapshot: integer('price_snapshot').notNull(), // Price at time of order (piasters)
  createdAt: integer('created_at').notNull()
});

// Standalone F&B sales (not tied to PlayStation sessions)
export const fnbSales = sqliteTable('fnb_sales', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  menuItemId: integer('menu_item_id').notNull(),  // Links to ps_menu_items
  quantity: integer('quantity').notNull().default(1),
  priceSnapshot: integer('price_snapshot').notNull(), // Price at time of sale (piasters)
  soldAt: integer('sold_at').notNull(),           // Timestamp when sold
  createdAt: integer('created_at').notNull()
});

// PlayStation session extra charges (free-form charges)
export const psSessionCharges = sqliteTable('ps_session_charges', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: integer('session_id').notNull(),
  amount: integer('amount').notNull(),           // Amount in piasters
  reason: text('reason'),                        // Optional reason
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
});

// PlayStation session transfers (cost transferred from another session)
export const psSessionTransfers = sqliteTable('ps_session_transfers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  fromSessionId: integer('from_session_id').notNull(),
  toSessionId: integer('to_session_id').notNull(),
  fromStationId: text('from_station_id').notNull(), // For display purposes
  gamingAmount: integer('gaming_amount').notNull(),  // Gaming cost in piasters
  ordersAmount: integer('orders_amount').notNull(),  // Orders cost in piasters (0 if not included)
  totalAmount: integer('total_amount').notNull(),    // Gaming + orders
  createdAt: integer('created_at').notNull()
});

// PlayStation session segments (for single/multi player mode tracking)
export const psSessionSegments = sqliteTable('ps_session_segments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: integer('session_id').notNull(),
  mode: text('mode').notNull(),                  // 'single' | 'multi'
  startedAt: integer('started_at').notNull(),
  endedAt: integer('ended_at'),                  // NULL = current segment
  hourlyRateSnapshot: integer('hourly_rate_snapshot').notNull(),
  createdAt: integer('created_at').notNull()
});

// Voucher cache - mirrored from MikroTik router for offline viewing
export const vouchersCache = sqliteTable('vouchers_cache', {
  id: text('id').primaryKey(),                    // MikroTik .id
  code: text('code').notNull(),                   // Voucher code
  status: text('status').notNull(),               // 'available' | 'used' | 'exhausted'
  packageId: text('package_id'),                  // Links to packages table
  profile: text('profile'),                       // MikroTik profile name
  bytesLimit: integer('bytes_limit'),             // Total allowed bytes
  bytesUsed: integer('bytes_used').default(0),    // bytes_in + bytes_out
  timeLimit: text('time_limit'),                  // e.g., '1d', '24h'
  uptime: text('uptime'),                         // Time used so far
  macAddress: text('mac_address'),                // Connected device MAC
  deviceName: text('device_name'),                // From DHCP
  isOnline: integer('is_online').default(0),      // 1 if in active sessions
  createdAt: text('created_at'),                  // From router
  lastSeenAt: text('last_seen_at'),               // Last activity
  syncedAt: text('synced_at').notNull()           // When we last synced this row
});

// Sessions cache - mirrored from MikroTik router for offline viewing
export const sessionsCache = sqliteTable('sessions_cache', {
  id: text('id').primaryKey(),                    // MikroTik .id
  voucherCode: text('voucher_code').notNull(),    // Links to vouchers_cache
  macAddress: text('mac_address'),
  ipAddress: text('ip_address'),
  bytesIn: integer('bytes_in').default(0),
  bytesOut: integer('bytes_out').default(0),
  uptime: text('uptime'),
  startedAt: text('started_at'),
  syncedAt: text('synced_at').notNull()
});

// Unified daily stats - aggregated statistics across all business segments
export const unifiedDailyStats = sqliteTable('unified_daily_stats', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  date: text('date').notNull().unique(),          // YYYY-MM-DD format
  // WiFi segment
  wifiRevenue: integer('wifi_revenue').notNull().default(0),       // Piasters
  wifiVouchersSold: integer('wifi_vouchers_sold').notNull().default(0),
  wifiDataSold: integer('wifi_data_sold').notNull().default(0),    // Bytes
  wifiDataUsed: integer('wifi_data_used').notNull().default(0),    // Bytes
  // PlayStation segment (gaming only, excludes orders)
  psGamingRevenue: integer('ps_gaming_revenue').notNull().default(0), // Piasters
  psSessions: integer('ps_sessions').notNull().default(0),
  psMinutes: integer('ps_minutes').notNull().default(0),
  psOrdersRevenue: integer('ps_orders_revenue').notNull().default(0), // Piasters - F&B during PS sessions
  // Standalone F&B
  fnbRevenue: integer('fnb_revenue').notNull().default(0),         // Piasters
  fnbItemsSold: integer('fnb_items_sold').notNull().default(0),
  // Timestamps
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
});

// Type exports
export type Setting = typeof settings.$inferSelect;
export type NewSetting = typeof settings.$inferInsert;
export type Package = typeof packages.$inferSelect;
export type NewPackage = typeof packages.$inferInsert;
export type VoucherUsage = typeof voucherUsage.$inferSelect;
export type NewVoucherUsage = typeof voucherUsage.$inferInsert;
export type Expense = typeof expenses.$inferSelect;
export type NewExpense = typeof expenses.$inferInsert;
export type DailyStat = typeof dailyStats.$inferSelect;
export type NewDailyStat = typeof dailyStats.$inferInsert;
export type PrintedVoucher = typeof printedVouchers.$inferSelect;
export type NewPrintedVoucher = typeof printedVouchers.$inferInsert;
export type PsStation = typeof psStations.$inferSelect;
export type NewPsStation = typeof psStations.$inferInsert;
export type PsSession = typeof psSessions.$inferSelect;
export type NewPsSession = typeof psSessions.$inferInsert;
export type PsDailyStat = typeof psDailyStats.$inferSelect;
export type NewPsDailyStat = typeof psDailyStats.$inferInsert;
export type PsMenuItem = typeof psMenuItems.$inferSelect;
export type NewPsMenuItem = typeof psMenuItems.$inferInsert;
export type PsSessionOrder = typeof psSessionOrders.$inferSelect;
export type NewPsSessionOrder = typeof psSessionOrders.$inferInsert;
export type FnbSale = typeof fnbSales.$inferSelect;
export type NewFnbSale = typeof fnbSales.$inferInsert;
export type UnifiedDailyStat = typeof unifiedDailyStats.$inferSelect;
export type NewUnifiedDailyStat = typeof unifiedDailyStats.$inferInsert;
export type PsSessionCharge = typeof psSessionCharges.$inferSelect;
export type NewPsSessionCharge = typeof psSessionCharges.$inferInsert;
export type PsSessionTransfer = typeof psSessionTransfers.$inferSelect;
export type NewPsSessionTransfer = typeof psSessionTransfers.$inferInsert;
export type PsSessionSegment = typeof psSessionSegments.$inferSelect;
export type NewPsSessionSegment = typeof psSessionSegments.$inferInsert;
export type VoucherCache = typeof vouchersCache.$inferSelect;
export type NewVoucherCache = typeof vouchersCache.$inferInsert;
export type SessionCache = typeof sessionsCache.$inferSelect;
export type NewSessionCache = typeof sessionsCache.$inferInsert;
