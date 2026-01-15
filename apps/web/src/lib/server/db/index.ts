import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';

const sqlite = new Database('data.db');
export const db = drizzle(sqlite, { schema });

// Default settings
const defaultSettings = [
  { key: 'mikrotik_host', value: '192.168.1.109' },
  { key: 'mikrotik_user', value: 'admin' },
  { key: 'mikrotik_pass', value: '' },
  { key: 'business_name', value: 'AboYassen WiFi' }
];

// Default packages (metadata only - bytes come from MikroTik profiles)
const defaultPackages = [
  { id: '1.5GB', name: '1.5 GB', nameAr: '١.٥ جيجا', priceLE: 5, codePrefix: 'G1', profile: 'aboyassen-users', sortOrder: 1 },
  { id: '3GB', name: '3 GB', nameAr: '٣ جيجا', priceLE: 10, codePrefix: 'G3', profile: 'aboyassen-users', sortOrder: 2 },
  { id: '5GB', name: '5 GB', nameAr: '٥ جيجا', priceLE: 15, codePrefix: 'G5', profile: 'aboyassen-users', sortOrder: 3 },
  { id: '10GB', name: '10 GB', nameAr: '١٠ جيجا', priceLE: 30, codePrefix: 'G10', profile: 'aboyassen-users', sortOrder: 4 }
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
      code_prefix TEXT NOT NULL,
      profile TEXT NOT NULL,
      server TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
  `);

  // Insert default settings if not exist
  const insertSetting = sqlite.prepare(
    'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)'
  );
  for (const setting of defaultSettings) {
    insertSetting.run(setting.key, setting.value);
  }

  // Insert default packages if not exist
  const insertPackage = sqlite.prepare(
    'INSERT OR IGNORE INTO packages (id, name, name_ar, price_le, code_prefix, profile, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  for (const pkg of defaultPackages) {
    insertPackage.run(pkg.id, pkg.name, pkg.nameAr, pkg.priceLE, pkg.codePrefix, pkg.profile, pkg.sortOrder);
  }
}

// Initialize on import
initializeDb();
