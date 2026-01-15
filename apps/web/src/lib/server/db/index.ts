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

// Default packages with byte limits
// Bytes: 1GB = 1,073,741,824 bytes
const defaultPackages = [
  { id: '1.5GB', name: '1.5 GB', nameAr: '١.٥ جيجا', priceLE: 5, bytesLimit: 1610612736, codePrefix: '', profile: 'aboyassen-users', sortOrder: 1 },
  { id: '3GB', name: '3 GB', nameAr: '٣ جيجا', priceLE: 10, bytesLimit: 3221225472, codePrefix: '', profile: 'aboyassen-users', sortOrder: 2 },
  { id: '5GB', name: '5 GB', nameAr: '٥ جيجا', priceLE: 15, bytesLimit: 5368709120, codePrefix: '', profile: 'aboyassen-users', sortOrder: 3 },
  { id: '10GB', name: '10 GB', nameAr: '١٠ جيجا', priceLE: 30, bytesLimit: 10737418240, codePrefix: '', profile: 'aboyassen-users', sortOrder: 4 }
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
      code_prefix TEXT NOT NULL DEFAULT '',
      profile TEXT NOT NULL,
      server TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
  `);

  // Migration: add bytes_limit column if it doesn't exist
  try {
    sqlite.exec('ALTER TABLE packages ADD COLUMN bytes_limit INTEGER NOT NULL DEFAULT 0');
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
}

// Initialize on import
initializeDb();
