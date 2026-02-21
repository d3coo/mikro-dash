/**
 * SQLite database connection using better-sqlite3 + Drizzle ORM.
 * Synchronous operations — no network latency.
 */

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import { resolve } from 'path';

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _sqlite: Database.Database | null = null;

function getDbPath(): string {
	// In packaged Electron, use persistent user data directory
	// so the database survives app updates/reinstalls
	const appDataPath = process.env.MIKRODASH_DATA_DIR;
	if (appDataPath) {
		return resolve(appDataPath, 'data.db');
	}
	// Fallback: use cwd (development mode)
	return resolve(process.cwd(), 'data.db');
}

/**
 * Get or create the Drizzle database instance.
 * Safe to call multiple times — returns cached singleton.
 */
export function getDb() {
	if (_db) return _db;

	const dbPath = getDbPath();
	_sqlite = new Database(dbPath);

	// Enable WAL mode for better concurrent read performance
	_sqlite.pragma('journal_mode = WAL');
	_sqlite.pragma('foreign_keys = ON');

	_db = drizzle(_sqlite, { schema });
	return _db;
}

/**
 * Get the raw better-sqlite3 instance for direct SQL execution.
 */
export function getSqlite(): Database.Database {
	if (!_sqlite) getDb(); // Ensure initialized
	return _sqlite!;
}

/**
 * Initialize database — creates all tables if they don't exist.
 * Must be called once on server startup.
 */
export function ensureDbInitialized(): void {
	const sqlite = getSqlite();

	sqlite.exec(`
		CREATE TABLE IF NOT EXISTS settings (
			key TEXT PRIMARY KEY,
			value TEXT NOT NULL
		);

		CREATE TABLE IF NOT EXISTS packages (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			name_ar TEXT NOT NULL,
			price_le INTEGER NOT NULL,
			bytes_limit INTEGER NOT NULL,
			time_limit TEXT NOT NULL DEFAULT '1d',
			profile TEXT NOT NULL,
			server TEXT,
			sort_order INTEGER NOT NULL DEFAULT 0
		);

		CREATE TABLE IF NOT EXISTS ps_stations (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			station_id TEXT,
			name TEXT NOT NULL,
			name_ar TEXT NOT NULL,
			mac_address TEXT NOT NULL,
			hourly_rate INTEGER NOT NULL,
			hourly_rate_multi INTEGER,
			status TEXT NOT NULL DEFAULT 'available',
			monitor_ip TEXT,
			monitor_port INTEGER NOT NULL DEFAULT 8080,
			monitor_type TEXT NOT NULL DEFAULT 'tcl',
			timer_end_action TEXT NOT NULL DEFAULT 'notify',
			hdmi_input INTEGER NOT NULL DEFAULT 2,
			sort_order INTEGER NOT NULL DEFAULT 0,
			is_online INTEGER DEFAULT 0,
			has_internet INTEGER DEFAULT 1
		);

		CREATE TABLE IF NOT EXISTS ps_sessions (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			station_id INTEGER NOT NULL REFERENCES ps_stations(id),
			started_at INTEGER NOT NULL,
			ended_at INTEGER,
			hourly_rate_snapshot INTEGER NOT NULL,
			total_cost INTEGER,
			orders_cost INTEGER NOT NULL DEFAULT 0,
			extra_charges INTEGER NOT NULL DEFAULT 0,
			transferred_cost INTEGER NOT NULL DEFAULT 0,
			current_mode TEXT NOT NULL DEFAULT 'single',
			started_by TEXT NOT NULL DEFAULT 'manual',
			timer_minutes INTEGER,
			timer_notified INTEGER NOT NULL DEFAULT 0,
			cost_limit_piasters INTEGER,
			cost_limit_notified INTEGER NOT NULL DEFAULT 0,
			paused_at INTEGER,
			total_paused_ms INTEGER NOT NULL DEFAULT 0,
			notes TEXT
		);

		CREATE TABLE IF NOT EXISTS ps_menu_items (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			name_ar TEXT NOT NULL,
			category TEXT NOT NULL,
			price INTEGER NOT NULL,
			is_available INTEGER NOT NULL DEFAULT 1,
			sort_order INTEGER NOT NULL DEFAULT 0
		);

		CREATE TABLE IF NOT EXISTS ps_session_orders (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			session_id INTEGER NOT NULL REFERENCES ps_sessions(id),
			menu_item_id INTEGER NOT NULL REFERENCES ps_menu_items(id),
			quantity INTEGER NOT NULL,
			price_snapshot INTEGER NOT NULL,
			created_at INTEGER NOT NULL
		);

		CREATE TABLE IF NOT EXISTS ps_session_charges (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			session_id INTEGER NOT NULL REFERENCES ps_sessions(id),
			amount INTEGER NOT NULL,
			reason TEXT,
			created_at INTEGER NOT NULL
		);

		CREATE TABLE IF NOT EXISTS ps_session_transfers (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			from_session_id INTEGER NOT NULL REFERENCES ps_sessions(id),
			to_session_id INTEGER NOT NULL REFERENCES ps_sessions(id),
			from_station_id INTEGER NOT NULL REFERENCES ps_stations(id),
			gaming_amount INTEGER NOT NULL,
			orders_amount INTEGER NOT NULL,
			total_amount INTEGER NOT NULL,
			created_at INTEGER NOT NULL
		);

		CREATE TABLE IF NOT EXISTS ps_session_segments (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			session_id INTEGER NOT NULL REFERENCES ps_sessions(id),
			mode TEXT NOT NULL,
			started_at INTEGER NOT NULL,
			ended_at INTEGER,
			hourly_rate_snapshot INTEGER NOT NULL
		);

		CREATE TABLE IF NOT EXISTS fnb_sales (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			menu_item_id INTEGER NOT NULL REFERENCES ps_menu_items(id),
			quantity INTEGER NOT NULL,
			price_snapshot INTEGER NOT NULL,
			sold_at INTEGER NOT NULL
		);

		CREATE TABLE IF NOT EXISTS expenses (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			type TEXT NOT NULL,
			category TEXT NOT NULL,
			name TEXT NOT NULL,
			name_ar TEXT NOT NULL,
			amount INTEGER NOT NULL,
			is_active INTEGER NOT NULL DEFAULT 1,
			created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
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
			fnb_items_sold INTEGER NOT NULL DEFAULT 0
		);

		CREATE TABLE IF NOT EXISTS printed_vouchers (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			voucher_code TEXT NOT NULL UNIQUE,
			printed_at INTEGER NOT NULL
		);

		CREATE TABLE IF NOT EXISTS voucher_usage (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			voucher_code TEXT NOT NULL,
			mac_address TEXT NOT NULL,
			device_name TEXT,
			ip_address TEXT,
			first_connected_at INTEGER NOT NULL,
			last_connected_at INTEGER NOT NULL,
			total_bytes INTEGER NOT NULL DEFAULT 0
		);

		-- Indexes for common queries
		CREATE INDEX IF NOT EXISTS idx_ps_sessions_station ON ps_sessions(station_id);
		CREATE INDEX IF NOT EXISTS idx_ps_sessions_active ON ps_sessions(ended_at);
		CREATE INDEX IF NOT EXISTS idx_ps_session_orders_session ON ps_session_orders(session_id);
		CREATE INDEX IF NOT EXISTS idx_ps_session_charges_session ON ps_session_charges(session_id);
		CREATE INDEX IF NOT EXISTS idx_ps_session_segments_session ON ps_session_segments(session_id);
		CREATE INDEX IF NOT EXISTS idx_ps_session_transfers_from ON ps_session_transfers(from_session_id);
		CREATE INDEX IF NOT EXISTS idx_ps_session_transfers_to ON ps_session_transfers(to_session_id);
		CREATE INDEX IF NOT EXISTS idx_fnb_sales_date ON fnb_sales(sold_at);
		CREATE INDEX IF NOT EXISTS idx_unified_daily_stats_date ON unified_daily_stats(date);
		CREATE INDEX IF NOT EXISTS idx_voucher_usage_code ON voucher_usage(voucher_code);
		CREATE INDEX IF NOT EXISTS idx_printed_vouchers_code ON printed_vouchers(voucher_code);
	`);

	console.log('[DB] SQLite database initialized at', getDbPath());
}

// Convenience re-export
export { schema };
export type DbInstance = ReturnType<typeof getDb>;
