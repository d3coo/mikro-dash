import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const vouchers = sqliteTable('vouchers', {
  id: text('id').primaryKey(), // e.g., "ABO-1G5-001"
  password: text('password').notNull(),
  package: text('package').notNull(), // "1.5GB", "3GB", "5GB", "10GB"
  priceLE: integer('price_le').notNull(),
  bytesLimit: integer('bytes_limit').notNull(),
  status: text('status').notNull().default('available'), // "available", "used", "expired"
  createdAt: text('created_at').notNull(),
  usedAt: text('used_at')
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull()
});

export type Voucher = typeof vouchers.$inferSelect;
export type NewVoucher = typeof vouchers.$inferInsert;
export type Setting = typeof settings.$inferSelect;
