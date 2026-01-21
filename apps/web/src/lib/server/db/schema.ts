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
  hourlyRate: integer('hourly_rate').notNull(),   // Piasters (2000 = 20 EGP/hr)
  status: text('status').notNull().default('available'), // available|occupied|maintenance
  monitorIp: text('monitor_ip'),                  // FreeKiosk monitor IP (e.g., "192.168.1.50")
  monitorPort: integer('monitor_port').default(8080), // FreeKiosk API port (default 8080)
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
  hourlyRateSnapshot: integer('hourly_rate_snapshot').notNull(), // Rate at start
  totalCost: integer('total_cost'),               // Calculated on end (piasters)
  ordersCost: integer('orders_cost').default(0),  // Total food/drinks cost (piasters)
  startedBy: text('started_by').notNull().default('manual'), // manual|auto
  timerMinutes: integer('timer_minutes'),         // Optional timer (30, 60, etc.) - NULL = no timer
  timerNotified: integer('timer_notified').default(0), // 1 = notification sent
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
