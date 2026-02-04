import { createClient, type Client } from '@libsql/client';
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';
import * as schema from './schema';

// Environment configuration
const TURSO_DATABASE_URL = process.env.TURSO_DATABASE_URL;
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;
const DATABASE_MODE = process.env.DATABASE_MODE || 'local';

// Edge runtime detection (Cloudflare Workers, etc.)
const isEdgeRuntime = typeof globalThis.caches !== 'undefined' && typeof process.cwd !== 'function';

console.log(`[DB] Database mode: ${DATABASE_MODE}`);
console.log(`[DB] Edge runtime: ${isEdgeRuntime}`);

// Create libsql client based on mode
let client: Client;

if (DATABASE_MODE === 'remote' || isEdgeRuntime) {
  // Remote mode: Direct connection to Turso cloud (for Cloudflare Pages)
  if (!TURSO_DATABASE_URL || !TURSO_AUTH_TOKEN) {
    throw new Error('[DB] TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are required in remote mode');
  }
  console.log('[DB] Connecting directly to Turso cloud...');
  client = createClient({
    url: TURSO_DATABASE_URL,
    authToken: TURSO_AUTH_TOKEN,
  });
} else {
  // Local-first mode: All reads/writes go to local SQLite (instant)
  // Import Node.js modules only in local mode
  const { resolve } = await import('path');
  const { existsSync } = await import('fs');

  const dbPath = process.env.DATABASE_PATH || resolve(process.cwd(), 'data.db');
  console.log(`[DB] Local database path: ${dbPath}`);

  // Check for Turso sync compatibility
  function canUseTursoSync(): boolean {
    if (!TURSO_DATABASE_URL || !TURSO_AUTH_TOKEN) return false;

    const dbExists = existsSync(dbPath);
    if (!dbExists) return true; // Fresh start, sync will work

    // Check for Turso metadata files (created when sync is initialized)
    const metadataFiles = [
      `${dbPath}-client_wal`,
      `${dbPath}.turso`,
    ];
    const hasMetadata = metadataFiles.some(f => existsSync(f));

    if (dbExists && !hasMetadata) {
      console.warn('[DB] Local database exists without Turso sync metadata.');
      console.warn('[DB] To enable sync: delete data.db and let it sync from cloud, or continue with local-only mode.');
      return false;
    }

    return true;
  }

  if (canUseTursoSync()) {
    console.log('[DB] Creating embedded replica with Turso sync...');
    client = createClient({
      url: `file:${dbPath}`,
      authToken: TURSO_AUTH_TOKEN,
      syncUrl: TURSO_DATABASE_URL,
      // No automatic sync interval - we sync manually after writes for instant updates
    });
  } else {
    console.log('[DB] Creating local-only database (no cloud sync)...');
    client = createClient({
      url: `file:${dbPath}`,
    });
  }
}

export const db: LibSQLDatabase<typeof schema> = drizzle(client, { schema });

// Export client for manual sync operations
export { client };

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

export async function initializeDb() {
  console.log('[DB] Initializing database...');

  // Create tables
  await client.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  await client.execute(`
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
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS voucher_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      voucher_code TEXT NOT NULL,
      mac_address TEXT NOT NULL,
      device_name TEXT,
      ip_address TEXT,
      first_connected_at INTEGER NOT NULL,
      last_connected_at INTEGER NOT NULL,
      total_bytes INTEGER DEFAULT 0
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      name_ar TEXT NOT NULL,
      amount INTEGER NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      category TEXT NOT NULL DEFAULT 'general',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  await client.execute(`
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
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS printed_vouchers (
      voucher_code TEXT PRIMARY KEY,
      printed_at INTEGER NOT NULL
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS ps_stations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      name_ar TEXT NOT NULL,
      mac_address TEXT NOT NULL,
      hourly_rate INTEGER NOT NULL,
      hourly_rate_multi INTEGER,
      status TEXT NOT NULL DEFAULT 'available',
      monitor_ip TEXT,
      monitor_port INTEGER DEFAULT 8080,
      monitor_type TEXT DEFAULT 'tcl',
      timer_end_action TEXT DEFAULT 'notify',
      hdmi_input INTEGER DEFAULT 2,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS ps_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      station_id TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      hourly_rate_snapshot INTEGER NOT NULL,
      total_cost INTEGER,
      orders_cost INTEGER DEFAULT 0,
      extra_charges INTEGER DEFAULT 0,
      transferred_cost INTEGER DEFAULT 0,
      current_mode TEXT DEFAULT 'single',
      started_by TEXT NOT NULL DEFAULT 'manual',
      timer_minutes INTEGER,
      timer_notified INTEGER DEFAULT 0,
      cost_limit_piasters INTEGER,
      cost_limit_notified INTEGER DEFAULT 0,
      paused_at INTEGER,
      total_paused_ms INTEGER DEFAULT 0,
      notes TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS ps_daily_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      total_sessions INTEGER NOT NULL DEFAULT 0,
      total_minutes INTEGER NOT NULL DEFAULT 0,
      total_revenue INTEGER NOT NULL DEFAULT 0,
      sessions_by_station TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  await client.execute(`
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
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS ps_session_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      menu_item_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      price_snapshot INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS fnb_sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      menu_item_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      price_snapshot INTEGER NOT NULL,
      sold_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS ps_session_charges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      reason TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS ps_session_transfers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_session_id INTEGER NOT NULL,
      to_session_id INTEGER NOT NULL,
      from_station_id TEXT NOT NULL,
      gaming_amount INTEGER NOT NULL,
      orders_amount INTEGER NOT NULL,
      total_amount INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS ps_session_segments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      mode TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      hourly_rate_snapshot INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);

  await client.execute(`
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
    )
  `);

  // New tables for voucher caching (router mirror)
  await client.execute(`
    CREATE TABLE IF NOT EXISTS vouchers_cache (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      status TEXT NOT NULL,
      package_id TEXT,
      profile TEXT,
      bytes_limit INTEGER,
      bytes_used INTEGER DEFAULT 0,
      time_limit TEXT,
      uptime TEXT,
      mac_address TEXT,
      device_name TEXT,
      is_online INTEGER DEFAULT 0,
      created_at TEXT,
      last_seen_at TEXT,
      synced_at TEXT NOT NULL
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS sessions_cache (
      id TEXT PRIMARY KEY,
      voucher_code TEXT NOT NULL,
      mac_address TEXT,
      ip_address TEXT,
      bytes_in INTEGER DEFAULT 0,
      bytes_out INTEGER DEFAULT 0,
      uptime TEXT,
      started_at TEXT,
      synced_at TEXT NOT NULL
    )
  `);

  // Run migrations for existing tables (add columns if they don't exist)
  const migrations = [
    { table: 'packages', column: 'bytes_limit', sql: 'ALTER TABLE packages ADD COLUMN bytes_limit INTEGER NOT NULL DEFAULT 0' },
    { table: 'packages', column: 'time_limit', sql: "ALTER TABLE packages ADD COLUMN time_limit TEXT DEFAULT '1d'" },
    { table: 'ps_sessions', column: 'orders_cost', sql: 'ALTER TABLE ps_sessions ADD COLUMN orders_cost INTEGER DEFAULT 0' },
    { table: 'ps_sessions', column: 'timer_minutes', sql: 'ALTER TABLE ps_sessions ADD COLUMN timer_minutes INTEGER' },
    { table: 'ps_sessions', column: 'timer_notified', sql: 'ALTER TABLE ps_sessions ADD COLUMN timer_notified INTEGER DEFAULT 0' },
    { table: 'expenses', column: 'category', sql: "ALTER TABLE expenses ADD COLUMN category TEXT NOT NULL DEFAULT 'general'" },
    { table: 'ps_stations', column: 'monitor_ip', sql: 'ALTER TABLE ps_stations ADD COLUMN monitor_ip TEXT' },
    { table: 'ps_stations', column: 'monitor_port', sql: 'ALTER TABLE ps_stations ADD COLUMN monitor_port INTEGER DEFAULT 8080' },
    { table: 'ps_stations', column: 'monitor_type', sql: "ALTER TABLE ps_stations ADD COLUMN monitor_type TEXT DEFAULT 'tcl'" },
    { table: 'ps_stations', column: 'timer_end_action', sql: "ALTER TABLE ps_stations ADD COLUMN timer_end_action TEXT DEFAULT 'notify'" },
    { table: 'ps_stations', column: 'hdmi_input', sql: 'ALTER TABLE ps_stations ADD COLUMN hdmi_input INTEGER DEFAULT 2' },
    { table: 'ps_sessions', column: 'cost_limit_piasters', sql: 'ALTER TABLE ps_sessions ADD COLUMN cost_limit_piasters INTEGER' },
    { table: 'ps_sessions', column: 'cost_limit_notified', sql: 'ALTER TABLE ps_sessions ADD COLUMN cost_limit_notified INTEGER DEFAULT 0' },
    { table: 'ps_sessions', column: 'paused_at', sql: 'ALTER TABLE ps_sessions ADD COLUMN paused_at INTEGER' },
    { table: 'ps_sessions', column: 'total_paused_ms', sql: 'ALTER TABLE ps_sessions ADD COLUMN total_paused_ms INTEGER DEFAULT 0' },
    { table: 'ps_sessions', column: 'extra_charges', sql: 'ALTER TABLE ps_sessions ADD COLUMN extra_charges INTEGER DEFAULT 0' },
    { table: 'ps_sessions', column: 'transferred_cost', sql: 'ALTER TABLE ps_sessions ADD COLUMN transferred_cost INTEGER DEFAULT 0' },
    { table: 'ps_sessions', column: 'current_mode', sql: "ALTER TABLE ps_sessions ADD COLUMN current_mode TEXT DEFAULT 'single'" },
    { table: 'ps_stations', column: 'hourly_rate_multi', sql: 'ALTER TABLE ps_stations ADD COLUMN hourly_rate_multi INTEGER' },
    { table: 'ps_sessions', column: 'updated_at', sql: 'ALTER TABLE ps_sessions ADD COLUMN updated_at INTEGER' },
  ];

  for (const migration of migrations) {
    try {
      await client.execute(migration.sql);
      console.log(`[DB] Migration: Added ${migration.column} to ${migration.table}`);
    } catch {
      // Column already exists, ignore
    }
  }

  // Insert default settings if not exist
  for (const setting of defaultSettings) {
    await client.execute({
      sql: 'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)',
      args: [setting.key, setting.value]
    });
  }

  // Insert default packages if not exist
  for (const pkg of defaultPackages) {
    await client.execute({
      sql: 'INSERT OR IGNORE INTO packages (id, name, name_ar, price_le, bytes_limit, code_prefix, profile, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      args: [pkg.id, pkg.name, pkg.nameAr, pkg.priceLE, pkg.bytesLimit, pkg.codePrefix, pkg.profile, pkg.sortOrder]
    });
  }

  // Update existing packages with byte limits if they have 0
  for (const pkg of defaultPackages) {
    await client.execute({
      sql: 'UPDATE packages SET bytes_limit = ? WHERE id = ? AND bytes_limit = 0',
      args: [pkg.bytesLimit, pkg.id]
    });
  }

  // Insert default expenses if table is empty
  const expenseCount = await client.execute('SELECT COUNT(*) as count FROM expenses');
  if (expenseCount.rows[0] && Number(expenseCount.rows[0].count) === 0) {
    const now = Date.now();
    for (const expense of defaultExpenses) {
      await client.execute({
        sql: 'INSERT INTO expenses (type, name, name_ar, amount, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)',
        args: [expense.type, expense.name, expense.nameAr, expense.amount, now, now]
      });
    }
  }

  console.log('[DB] Database initialized successfully');
}

// Check if sync is available
const canSync = DATABASE_MODE === 'local' && TURSO_DATABASE_URL && TURSO_AUTH_TOKEN && !isEdgeRuntime;

// Manual sync function (for forcing immediate sync)
export async function syncDatabase() {
  if (canSync) {
    try {
      await client.sync();
      console.log('[DB] Manual sync completed');
    } catch (err) {
      console.error('[DB] Manual sync failed:', err);
      throw err;
    }
  }
}

// Instant sync after writes (non-blocking, fire and forget)
// Call this after any write operation to sync changes to cloud immediately
export function syncAfterWrite() {
  if (canSync) {
    client.sync().catch(err => {
      console.error('[DB] Background sync failed:', err);
    });
  }
}

// Initialize on import (async)
let dbInitialized = false;
let initPromise: Promise<void> | null = null;

export async function ensureDbInitialized() {
  if (dbInitialized) return;
  if (initPromise) return initPromise;

  initPromise = initializeDb().then(() => {
    dbInitialized = true;
  }).catch(err => {
    console.error('[DB] Database initialization failed:', err);
    throw err;
  });

  return initPromise;
}

// Auto-initialize (fire and forget, errors logged)
ensureDbInitialized().catch(err => {
  console.error('[DB] Auto-initialization failed:', err);
});
