/**
 * Import Convex export data into local SQLite database.
 *
 * Prerequisites:
 *   1. Run `npx convex export --path ./convex-export.zip` to get the data
 *   2. Unzip into ./convex-export/
 *
 * Run: bun run scripts/import-convex-to-sqlite.ts
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import Database from 'better-sqlite3';

const EXPORT_DIR = resolve(process.cwd(), 'convex-export');
const DB_PATH = resolve(process.cwd(), 'data.db');

// ========== Helpers ==========

function readJsonl<T = any>(table: string): T[] {
	const filePath = resolve(EXPORT_DIR, table, 'documents.jsonl');
	if (!existsSync(filePath)) {
		console.warn(`  ⚠ No data file for ${table}`);
		return [];
	}
	const content = readFileSync(filePath, 'utf-8').trim();
	if (!content) return [];
	return content.split('\n').map((line) => JSON.parse(line));
}

// ========== Main ==========

function main() {
	if (!existsSync(EXPORT_DIR)) {
		console.error('❌ convex-export/ directory not found. Unzip the export first.');
		process.exit(1);
	}

	console.log(`[Import] Database path: ${DB_PATH}`);

	const sqlite = new Database(DB_PATH);
	sqlite.pragma('journal_mode = WAL');
	sqlite.pragma('foreign_keys = OFF'); // Disable during import for order flexibility

	// Drop existing tables and recreate
	console.log('[Import] Dropping existing tables...');
	const existingTables = sqlite.prepare(
		"SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
	).all() as { name: string }[];
	for (const { name } of existingTables) {
		sqlite.exec(`DROP TABLE IF EXISTS "${name}"`);
	}

	console.log('[Import] Creating tables...');
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

		-- Indexes
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

	// ID mapping: Convex string _id → SQLite integer id
	const idMap: Record<string, Record<string, number>> = {
		psStations: {},
		psSessions: {},
		psMenuItems: {},
	};

	// ============ Phase 1: Independent tables ============
	console.log('\n=== Phase 1: Independent tables ===\n');

	// Settings (key-value, no auto-increment ID)
	const settingsData = readJsonl('settings');
	if (settingsData.length) {
		const stmt = sqlite.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
		const insertMany = sqlite.transaction((items: any[]) => {
			for (const item of items) {
				stmt.run(item.key, item.value);
			}
		});
		insertMany(settingsData);
		console.log(`  ✓ settings: ${settingsData.length} rows`);
	}

	// Packages
	const packagesData = readJsonl('packages');
	if (packagesData.length) {
		const stmt = sqlite.prepare(
			'INSERT INTO packages (name, name_ar, price_le, bytes_limit, time_limit, profile, server, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
		);
		const insertMany = sqlite.transaction((items: any[]) => {
			for (const item of items) {
				stmt.run(
					item.name,
					item.nameAr,
					Math.round(item.priceLE),
					Math.round(item.bytesLimit),
					item.timeLimit || '1d',
					item.profile,
					item.server || null,
					Math.round(item.sortOrder || 0)
				);
			}
		});
		insertMany(packagesData);
		console.log(`  ✓ packages: ${packagesData.length} rows`);
	}

	// PS Stations
	const stationsData = readJsonl('psStations');
	if (stationsData.length) {
		const stmt = sqlite.prepare(
			`INSERT INTO ps_stations (station_id, name, name_ar, mac_address, hourly_rate, hourly_rate_multi,
			 status, monitor_ip, monitor_port, monitor_type, timer_end_action, hdmi_input, sort_order, is_online, has_internet)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		);
		const insertMany = sqlite.transaction((items: any[]) => {
			for (const item of items) {
				const info = stmt.run(
					item.stationId || item.name,
					item.name,
					item.nameAr,
					item.macAddress,
					Math.round(item.hourlyRate),
					item.hourlyRateMulti ? Math.round(item.hourlyRateMulti) : null,
					'available', // Reset status on import (sessions will update it)
					item.monitorIp || null,
					Math.round(item.monitorPort || 8080),
					item.monitorType || 'tcl',
					item.timerEndAction || 'notify',
					Math.round(item.hdmiInput || 2),
					Math.round(item.sortOrder || 0),
					0, // isOnline reset
					item.hasInternet ? 1 : 0
				);
				idMap.psStations[item._id] = info.lastInsertRowid as number;
			}
		});
		insertMany(stationsData);
		console.log(`  ✓ ps_stations: ${stationsData.length} rows`);
	}

	// PS Menu Items
	const menuItemsData = readJsonl('psMenuItems');
	if (menuItemsData.length) {
		const stmt = sqlite.prepare(
			'INSERT INTO ps_menu_items (name, name_ar, category, price, is_available, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
		);
		const insertMany = sqlite.transaction((items: any[]) => {
			for (const item of items) {
				const info = stmt.run(
					item.name,
					item.nameAr,
					item.category,
					Math.round(item.price),
					item.isAvailable ? 1 : 0,
					Math.round(item.sortOrder || 0)
				);
				idMap.psMenuItems[item._id] = info.lastInsertRowid as number;
			}
		});
		insertMany(menuItemsData);
		console.log(`  ✓ ps_menu_items: ${menuItemsData.length} rows`);
	}

	// Expenses
	const expensesData = readJsonl('expenses');
	if (expensesData.length) {
		const stmt = sqlite.prepare(
			'INSERT INTO expenses (type, category, name, name_ar, amount, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
		);
		const insertMany = sqlite.transaction((items: any[]) => {
			for (const item of items) {
				stmt.run(
					item.type,
					item.category,
					item.name,
					item.nameAr,
					Math.round(item.amount),
					item.isActive ? 1 : 0,
					Math.round(item._creationTime)
				);
			}
		});
		insertMany(expensesData);
		console.log(`  ✓ expenses: ${expensesData.length} rows`);
	}

	// Printed Vouchers
	const printedData = readJsonl('printedVouchers');
	if (printedData.length) {
		const stmt = sqlite.prepare(
			'INSERT OR IGNORE INTO printed_vouchers (voucher_code, printed_at) VALUES (?, ?)'
		);
		const insertMany = sqlite.transaction((items: any[]) => {
			for (const item of items) {
				stmt.run(item.voucherCode, Math.round(item.printedAt));
			}
		});
		insertMany(printedData);
		console.log(`  ✓ printed_vouchers: ${printedData.length} rows`);
	}

	// Voucher Usage
	const usageData = readJsonl('voucherUsage');
	if (usageData.length) {
		const stmt = sqlite.prepare(
			`INSERT INTO voucher_usage (voucher_code, mac_address, device_name, ip_address,
			 first_connected_at, last_connected_at, total_bytes) VALUES (?, ?, ?, ?, ?, ?, ?)`
		);
		const insertMany = sqlite.transaction((items: any[]) => {
			for (const item of items) {
				stmt.run(
					item.voucherCode,
					item.macAddress,
					item.deviceName || null,
					item.ipAddress || null,
					Math.round(item.firstConnectedAt),
					Math.round(item.lastConnectedAt),
					Math.round(item.totalBytes || 0)
				);
			}
		});
		insertMany(usageData);
		console.log(`  ✓ voucher_usage: ${usageData.length} rows`);
	}

	// Unified Daily Stats
	const statsData = readJsonl('unifiedDailyStats');
	if (statsData.length) {
		const stmt = sqlite.prepare(
			`INSERT OR REPLACE INTO unified_daily_stats (date, wifi_revenue, wifi_vouchers_sold, wifi_data_sold,
			 wifi_data_used, ps_gaming_revenue, ps_sessions, ps_minutes, ps_orders_revenue, fnb_revenue, fnb_items_sold)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		);
		const insertMany = sqlite.transaction((items: any[]) => {
			for (const item of items) {
				stmt.run(
					item.date,
					Math.round(item.wifiRevenue || 0),
					Math.round(item.wifiVouchersSold || 0),
					Math.round(item.wifiDataSold || 0),
					Math.round(item.wifiDataUsed || 0),
					Math.round(item.psGamingRevenue || 0),
					Math.round(item.psSessions || 0),
					Math.round(item.psMinutes || 0),
					Math.round(item.psOrdersRevenue || 0),
					Math.round(item.fnbRevenue || 0),
					Math.round(item.fnbItemsSold || 0)
				);
			}
		});
		insertMany(statsData);
		console.log(`  ✓ unified_daily_stats: ${statsData.length} rows`);
	}

	// ============ Phase 2: Dependent tables ============
	console.log('\n=== Phase 2: Dependent tables (foreign keys) ===\n');

	// PS Sessions (depends on stations)
	const sessionsData = readJsonl('psSessions');
	let sessionsInserted = 0;
	let sessionsSkipped = 0;
	if (sessionsData.length) {
		const stmt = sqlite.prepare(
			`INSERT INTO ps_sessions (station_id, started_at, ended_at, hourly_rate_snapshot, total_cost,
			 orders_cost, extra_charges, transferred_cost, current_mode, started_by,
			 timer_minutes, timer_notified, cost_limit_piasters, cost_limit_notified,
			 paused_at, total_paused_ms, notes)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		);
		const insertMany = sqlite.transaction((items: any[]) => {
			for (const item of items) {
				const stationSqliteId = idMap.psStations[item.stationId];
				if (!stationSqliteId) {
					sessionsSkipped++;
					continue;
				}
				const info = stmt.run(
					stationSqliteId,
					Math.round(item.startedAt),
					item.endedAt ? Math.round(item.endedAt) : null,
					Math.round(item.hourlyRateSnapshot),
					item.totalCost != null ? Math.round(item.totalCost) : null,
					Math.round(item.ordersCost || 0),
					Math.round(item.extraCharges || 0),
					Math.round(item.transferredCost || 0),
					item.currentMode || 'single',
					item.startedBy || 'manual',
					item.timerMinutes != null ? Math.round(item.timerMinutes) : null,
					item.timerNotified ? 1 : 0,
					item.costLimitPiasters != null ? Math.round(item.costLimitPiasters) : null,
					item.costLimitNotified ? 1 : 0,
					item.pausedAt ? Math.round(item.pausedAt) : null,
					Math.round(item.totalPausedMs || 0),
					item.notes || null
				);
				idMap.psSessions[item._id] = info.lastInsertRowid as number;
				sessionsInserted++;
			}
		});
		insertMany(sessionsData);
		console.log(`  ✓ ps_sessions: ${sessionsInserted} rows (${sessionsSkipped} skipped)`);
	}

	// PS Session Orders (depends on sessions + menu items)
	const ordersData = readJsonl('psSessionOrders');
	let ordersInserted = 0;
	let ordersSkipped = 0;
	if (ordersData.length) {
		const stmt = sqlite.prepare(
			'INSERT INTO ps_session_orders (session_id, menu_item_id, quantity, price_snapshot, created_at) VALUES (?, ?, ?, ?, ?)'
		);
		const insertMany = sqlite.transaction((items: any[]) => {
			for (const item of items) {
				const sessionSqliteId = idMap.psSessions[item.sessionId];
				const menuItemSqliteId = idMap.psMenuItems[item.menuItemId];
				if (!sessionSqliteId || !menuItemSqliteId) {
					ordersSkipped++;
					continue;
				}
				stmt.run(
					sessionSqliteId,
					menuItemSqliteId,
					Math.round(item.quantity),
					Math.round(item.priceSnapshot),
					Math.round(item.createdAt)
				);
				ordersInserted++;
			}
		});
		insertMany(ordersData);
		console.log(`  ✓ ps_session_orders: ${ordersInserted} rows (${ordersSkipped} skipped)`);
	}

	// PS Session Charges (depends on sessions)
	const chargesData = readJsonl('psSessionCharges');
	let chargesInserted = 0;
	let chargesSkipped = 0;
	if (chargesData.length) {
		const stmt = sqlite.prepare(
			'INSERT INTO ps_session_charges (session_id, amount, reason, created_at) VALUES (?, ?, ?, ?)'
		);
		const insertMany = sqlite.transaction((items: any[]) => {
			for (const item of items) {
				const sessionSqliteId = idMap.psSessions[item.sessionId];
				if (!sessionSqliteId) {
					chargesSkipped++;
					continue;
				}
				stmt.run(
					sessionSqliteId,
					Math.round(item.amount),
					item.reason || null,
					Math.round(item.createdAt)
				);
				chargesInserted++;
			}
		});
		insertMany(chargesData);
		console.log(`  ✓ ps_session_charges: ${chargesInserted} rows (${chargesSkipped} skipped)`);
	}

	// PS Session Segments (depends on sessions)
	const segmentsData = readJsonl('psSessionSegments');
	let segmentsInserted = 0;
	let segmentsSkipped = 0;
	if (segmentsData.length) {
		const stmt = sqlite.prepare(
			'INSERT INTO ps_session_segments (session_id, mode, started_at, ended_at, hourly_rate_snapshot) VALUES (?, ?, ?, ?, ?)'
		);
		const insertMany = sqlite.transaction((items: any[]) => {
			for (const item of items) {
				const sessionSqliteId = idMap.psSessions[item.sessionId];
				if (!sessionSqliteId) {
					segmentsSkipped++;
					continue;
				}
				stmt.run(
					sessionSqliteId,
					item.mode,
					Math.round(item.startedAt),
					item.endedAt ? Math.round(item.endedAt) : null,
					Math.round(item.hourlyRateSnapshot)
				);
				segmentsInserted++;
			}
		});
		insertMany(segmentsData);
		console.log(`  ✓ ps_session_segments: ${segmentsInserted} rows (${segmentsSkipped} skipped)`);
	}

	// PS Session Transfers (depends on sessions + stations)
	const transfersData = readJsonl('psSessionTransfers');
	let transfersInserted = 0;
	let transfersSkipped = 0;
	if (transfersData.length) {
		const stmt = sqlite.prepare(
			`INSERT INTO ps_session_transfers (from_session_id, to_session_id, from_station_id,
			 gaming_amount, orders_amount, total_amount, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
		);
		const insertMany = sqlite.transaction((items: any[]) => {
			for (const item of items) {
				const fromSessionId = idMap.psSessions[item.fromSessionId];
				const toSessionId = idMap.psSessions[item.toSessionId];
				const fromStationId = idMap.psStations[item.fromStationId];
				if (!fromSessionId || !toSessionId || !fromStationId) {
					transfersSkipped++;
					continue;
				}
				stmt.run(
					fromSessionId,
					toSessionId,
					fromStationId,
					Math.round(item.gamingAmount),
					Math.round(item.ordersAmount),
					Math.round(item.totalAmount),
					Math.round(item.createdAt)
				);
				transfersInserted++;
			}
		});
		insertMany(transfersData);
		console.log(`  ✓ ps_session_transfers: ${transfersInserted} rows (${transfersSkipped} skipped)`);
	}

	// F&B Sales (depends on menu items)
	const fnbData = readJsonl('fnbSales');
	let fnbInserted = 0;
	let fnbSkipped = 0;
	if (fnbData.length) {
		const stmt = sqlite.prepare(
			'INSERT INTO fnb_sales (menu_item_id, quantity, price_snapshot, sold_at) VALUES (?, ?, ?, ?)'
		);
		const insertMany = sqlite.transaction((items: any[]) => {
			for (const item of items) {
				const menuItemSqliteId = idMap.psMenuItems[item.menuItemId];
				if (!menuItemSqliteId) {
					fnbSkipped++;
					continue;
				}
				stmt.run(
					menuItemSqliteId,
					Math.round(item.quantity),
					Math.round(item.priceSnapshot),
					Math.round(item.soldAt)
				);
				fnbInserted++;
			}
		});
		insertMany(fnbData);
		console.log(`  ✓ fnb_sales: ${fnbInserted} rows (${fnbSkipped} skipped)`);
	}

	// ============ Verify ============
	console.log('\n=== Verification ===\n');

	const tables = [
		'settings', 'packages', 'ps_stations', 'ps_sessions', 'ps_menu_items',
		'ps_session_orders', 'ps_session_charges', 'ps_session_segments',
		'ps_session_transfers', 'fnb_sales', 'expenses', 'unified_daily_stats',
		'printed_vouchers', 'voucher_usage',
	];

	for (const table of tables) {
		const row = sqlite.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as any;
		console.log(`  ${table}: ${row.count} rows`);
	}

	// Re-enable foreign keys
	sqlite.pragma('foreign_keys = ON');
	sqlite.close();

	console.log('\n✅ Migration complete! Database saved to:', DB_PATH);
}

main();
