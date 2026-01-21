import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import { resolve } from 'path';

// Database path - use environment variable or default to ./data.db in current working directory
// For PM2: set DATABASE_PATH=/full/path/to/data.db in ecosystem config
const dbPath = process.env.DATABASE_PATH || resolve(process.cwd(), 'data.db');

console.log(`[DB] Using database at: ${dbPath}`);
console.log(`[DB] Current working directory: ${process.cwd()}`);
console.log(`[DB] NODE_ENV: ${process.env.NODE_ENV}`);

let sqlite: Database.Database;
try {
  sqlite = new Database(dbPath);
  console.log('[DB] Database connection established');
} catch (err) {
  console.error('[DB] Failed to open database:', err);
  throw err;
}

export const db = drizzle(sqlite, { schema });

// Default settings
const defaultSettings = [
  { key: 'mikrotik_host', value: '192.168.1.109' },
  { key: 'mikrotik_user', value: 'admin' },
  { key: 'mikrotik_pass', value: '' },
  { key: 'business_name', value: 'AboYassen WiFi' }
];

// Default packages with byte limits
// Bytes: 1GB = 1,073,741,824 bytes
const defaultPackages = [
  { id: '1.5GB', name: '1.5 GB', nameAr: '١.٥ جيجا', priceLE: 5, bytesLimit: 1610612736, codePrefix: '', profile: 'aboyassen-users', sortOrder: 1 },
  { id: '3GB', name: '3 GB', nameAr: '٣ جيجا', priceLE: 10, bytesLimit: 3221225472, codePrefix: '', profile: 'aboyassen-users', sortOrder: 2 },
  { id: '5GB', name: '5 GB', nameAr: '٥ جيجا', priceLE: 15, bytesLimit: 5368709120, codePrefix: '', profile: 'aboyassen-users', sortOrder: 3 },
  { id: '10GB', name: '10 GB', nameAr: '١٠ جيجا', priceLE: 30, bytesLimit: 10737418240, codePrefix: '', profile: 'aboyassen-users', sortOrder: 4 }
];

// Default expense (per-GB cost)
const defaultExpenses = [
  { type: 'per_gb', name: 'ISP Data Cost', nameAr: 'تكلفة البيانات', amount: 100 } // 1 EGP per GB (100 piasters)
];

export function initializeDb() {
  // Create tables
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS packages (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      name_ar TEXT NOT NULL,
      price_le INTEGER NOT NULL,
      bytes_limit INTEGER NOT NULL DEFAULT 0,
      time_limit TEXT DEFAULT '1d',
      code_prefix TEXT NOT NULL DEFAULT '',
      profile TEXT NOT NULL,
      server TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS voucher_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      voucher_code TEXT NOT NULL,
      mac_address TEXT NOT NULL,
      device_name TEXT,
      ip_address TEXT,
      first_connected_at INTEGER NOT NULL,
      last_connected_at INTEGER NOT NULL,
      total_bytes INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      name_ar TEXT NOT NULL,
      amount INTEGER NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS daily_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      vouchers_sold INTEGER NOT NULL DEFAULT 0,
      revenue INTEGER NOT NULL DEFAULT 0,
      data_sold INTEGER NOT NULL DEFAULT 0,
      data_used INTEGER NOT NULL DEFAULT 0,
      sales_by_package TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS printed_vouchers (
      voucher_code TEXT PRIMARY KEY,
      printed_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ps_stations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      name_ar TEXT NOT NULL,
      mac_address TEXT NOT NULL,
      hourly_rate INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'available',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ps_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      station_id TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      hourly_rate_snapshot INTEGER NOT NULL,
      total_cost INTEGER,
      orders_cost INTEGER DEFAULT 0,
      started_by TEXT NOT NULL DEFAULT 'manual',
      timer_minutes INTEGER,
      timer_notified INTEGER DEFAULT 0,
      notes TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ps_daily_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      total_sessions INTEGER NOT NULL DEFAULT 0,
      total_minutes INTEGER NOT NULL DEFAULT 0,
      total_revenue INTEGER NOT NULL DEFAULT 0,
      sessions_by_station TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ps_menu_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      name_ar TEXT NOT NULL,
      category TEXT NOT NULL,
      price INTEGER NOT NULL,
      is_available INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ps_session_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      menu_item_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      price_snapshot INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS fnb_sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      menu_item_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      price_snapshot INTEGER NOT NULL,
      sold_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS unified_daily_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      wifi_revenue INTEGER NOT NULL DEFAULT 0,
      wifi_vouchers_sold INTEGER NOT NULL DEFAULT 0,
      wifi_data_sold INTEGER NOT NULL DEFAULT 0,
      wifi_data_used INTEGER NOT NULL DEFAULT 0,
      ps_gaming_revenue INTEGER NOT NULL DEFAULT 0,
      ps_sessions INTEGER NOT NULL DEFAULT 0,
      ps_minutes INTEGER NOT NULL DEFAULT 0,
      ps_orders_revenue INTEGER NOT NULL DEFAULT 0,
      fnb_revenue INTEGER NOT NULL DEFAULT 0,
      fnb_items_sold INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  // Migration: add bytes_limit column if it doesn't exist
  try {
    sqlite.exec('ALTER TABLE packages ADD COLUMN bytes_limit INTEGER NOT NULL DEFAULT 0');
  } catch {
    // Column already exists
  }

  // Migration: add time_limit column if it doesn't exist
  try {
    sqlite.exec("ALTER TABLE packages ADD COLUMN time_limit TEXT DEFAULT '1d'");
    console.log('[DB] Added time_limit column to packages table');
  } catch {
    // Column already exists
  }

  // Migration: add orders_cost column to ps_sessions if it doesn't exist
  try {
    sqlite.exec('ALTER TABLE ps_sessions ADD COLUMN orders_cost INTEGER DEFAULT 0');
    console.log('[DB] Added orders_cost column to ps_sessions table');
  } catch {
    // Column already exists
  }

  // Migration: add timer_minutes column to ps_sessions if it doesn't exist
  try {
    sqlite.exec('ALTER TABLE ps_sessions ADD COLUMN timer_minutes INTEGER');
    console.log('[DB] Added timer_minutes column to ps_sessions table');
  } catch {
    // Column already exists
  }

  // Migration: add timer_notified column to ps_sessions if it doesn't exist
  try {
    sqlite.exec('ALTER TABLE ps_sessions ADD COLUMN timer_notified INTEGER DEFAULT 0');
    console.log('[DB] Added timer_notified column to ps_sessions table');
  } catch {
    // Column already exists
  }

  // Migration: add category column to expenses if it doesn't exist
  try {
    sqlite.exec("ALTER TABLE expenses ADD COLUMN category TEXT NOT NULL DEFAULT 'general'");
    console.log('[DB] Added category column to expenses table');
    // Migrate existing per_gb expenses to wifi category
    sqlite.exec("UPDATE expenses SET category = 'wifi' WHERE type = 'per_gb'");
    console.log('[DB] Migrated per_gb expenses to wifi category');
  } catch {
    // Column already exists
  }

  // Migration: add monitor_ip column to ps_stations if it doesn't exist
  try {
    sqlite.exec('ALTER TABLE ps_stations ADD COLUMN monitor_ip TEXT');
    console.log('[DB] Added monitor_ip column to ps_stations table');
  } catch {
    // Column already exists
  }

  // Migration: add monitor_port column to ps_stations if it doesn't exist
  try {
    sqlite.exec('ALTER TABLE ps_stations ADD COLUMN monitor_port INTEGER DEFAULT 8080');
    console.log('[DB] Added monitor_port column to ps_stations table');
  } catch {
    // Column already exists
  }

  // Insert default settings if not exist
  const insertSetting = sqlite.prepare(
    'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)'
  );
  for (const setting of defaultSettings) {
    insertSetting.run(setting.key, setting.value);
  }

  // Insert default packages if not exist
  const insertPackage = sqlite.prepare(
    'INSERT OR IGNORE INTO packages (id, name, name_ar, price_le, bytes_limit, code_prefix, profile, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  for (const pkg of defaultPackages) {
    insertPackage.run(pkg.id, pkg.name, pkg.nameAr, pkg.priceLE, pkg.bytesLimit, pkg.codePrefix, pkg.profile, pkg.sortOrder);
  }

  // Update existing packages with byte limits if they have 0
  const updatePackageLimits = sqlite.prepare(
    'UPDATE packages SET bytes_limit = ? WHERE id = ? AND bytes_limit = 0'
  );
  for (const pkg of defaultPackages) {
    updatePackageLimits.run(pkg.bytesLimit, pkg.id);
  }

  // Insert default expenses if table is empty
  const expenseCount = sqlite.prepare('SELECT COUNT(*) as count FROM expenses').get() as { count: number };
  if (expenseCount.count === 0) {
    const now = Date.now();
    const insertExpense = sqlite.prepare(
      'INSERT INTO expenses (type, name, name_ar, amount, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)'
    );
    for (const expense of defaultExpenses) {
      insertExpense.run(expense.type, expense.name, expense.nameAr, expense.amount, now, now);
    }
  }
}

// Initialize on import
try {
  initializeDb();
  console.log('[DB] Database initialized successfully');
} catch (err) {
  console.error('[DB] Database initialization failed:', err);
  throw err;
}
