import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';

const sqlite = new Database('data.db');
export const db = drizzle(sqlite, { schema });

// Initialize default settings
const defaultSettings = [
  { key: 'mikrotik_host', value: '192.168.1.109' },
  { key: 'mikrotik_user', value: 'admin' },
  { key: 'mikrotik_pass', value: '' },
  { key: 'hotspot_server', value: 'guest-hotspot' },
  { key: 'voucher_prefix', value: 'ABO' },
  { key: 'business_name', value: 'AboYassen WiFi' },
  { key: 'language', value: 'ar' },
  { key: 'theme', value: 'light' }
];

export function initializeDb() {
  // Create tables if not exist
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS vouchers (
      id TEXT PRIMARY KEY,
      password TEXT NOT NULL,
      package TEXT NOT NULL,
      price_le INTEGER NOT NULL,
      bytes_limit INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'available',
      synced INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      used_at TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Add synced column if it doesn't exist (migration for existing databases)
  try {
    sqlite.exec(`ALTER TABLE vouchers ADD COLUMN synced INTEGER NOT NULL DEFAULT 0`);
  } catch {
    // Column already exists, ignore error
  }

  // Insert default settings if not exist
  const insertSetting = sqlite.prepare(
    'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)'
  );
  for (const setting of defaultSettings) {
    insertSetting.run(setting.key, setting.value);
  }
}

// Initialize on import
initializeDb();
