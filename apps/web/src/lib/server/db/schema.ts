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
