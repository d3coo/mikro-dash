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
  codePrefix: text('code_prefix').notNull(), // Voucher code prefix: "G3"
  profile: text('profile').notNull(),     // MikroTik profile name (links to router)
  server: text('server'),                 // Optional: restrict to specific hotspot server
  sortOrder: integer('sort_order').notNull().default(0)
});

// Type exports
export type Setting = typeof settings.$inferSelect;
export type NewSetting = typeof settings.$inferInsert;
export type Package = typeof packages.$inferSelect;
export type NewPackage = typeof packages.$inferInsert;
