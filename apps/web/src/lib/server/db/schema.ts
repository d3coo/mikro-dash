import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const vouchers = sqliteTable('vouchers', {
  id: text('id').primaryKey(), // e.g., "ABO-1G5-001"
  password: text('password').notNull(),
  package: text('package').notNull(), // "1.5GB", "3GB", "5GB", "10GB"
  priceLE: integer('price_le').notNull(),
  bytesLimit: integer('bytes_limit').notNull(),
  status: text('status').notNull().default('available'), // "available", "used", "expired"
  synced: integer('synced', { mode: 'boolean' }).notNull().default(false), // synced to MikroTik router
  createdAt: text('created_at').notNull(),
  usedAt: text('used_at')
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull()
});

export const voucherPackages = sqliteTable('voucher_packages', {
  id: text('id').primaryKey(), // e.g., "1.5GB", "3GB"
  name: text('name').notNull(), // "1.5 GB"
  nameAr: text('name_ar').notNull(), // Arabic name
  bytes: integer('bytes').notNull(), // Data limit in bytes
  priceLE: integer('price_le').notNull(), // Price in LE
  profile: text('profile').notNull(), // MikroTik hotspot user profile name
  server: text('server'), // MikroTik hotspot server name (restricts login to specific WiFi)
  codePrefix: text('code_prefix').notNull(), // e.g., "G1", "G3" for voucher naming
  sortOrder: integer('sort_order').notNull().default(0) // For ordering in UI
});

export type Voucher = typeof vouchers.$inferSelect;
export type NewVoucher = typeof vouchers.$inferInsert;
export type Setting = typeof settings.$inferSelect;
export type VoucherPackage = typeof voucherPackages.$inferSelect;
export type NewVoucherPackage = typeof voucherPackages.$inferInsert;
