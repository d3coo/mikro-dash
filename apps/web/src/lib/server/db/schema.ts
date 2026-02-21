/**
 * Drizzle ORM schema for local SQLite database.
 * Matches the 14 tables from the Convex schema.
 */

import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// ============= Settings =============

export const settings = sqliteTable('settings', {
	key: text('key').primaryKey(),
	value: text('value').notNull(),
});

// ============= Packages =============

export const packages = sqliteTable('packages', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(),
	nameAr: text('name_ar').notNull(),
	priceLE: integer('price_le').notNull(),
	bytesLimit: integer('bytes_limit').notNull(),
	timeLimit: text('time_limit').notNull().default('1d'),
	profile: text('profile').notNull(),
	server: text('server'),
	sortOrder: integer('sort_order').notNull().default(0),
});

// ============= PS Stations =============

export const psStations = sqliteTable('ps_stations', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	stationId: text('station_id'),
	name: text('name').notNull(),
	nameAr: text('name_ar').notNull(),
	macAddress: text('mac_address').notNull(),
	hourlyRate: integer('hourly_rate').notNull(),
	hourlyRateMulti: integer('hourly_rate_multi'),
	status: text('status').notNull().default('available'),
	monitorIp: text('monitor_ip'),
	monitorPort: integer('monitor_port').notNull().default(8080),
	monitorType: text('monitor_type').notNull().default('tcl'),
	timerEndAction: text('timer_end_action').notNull().default('notify'),
	hdmiInput: integer('hdmi_input').notNull().default(2),
	sortOrder: integer('sort_order').notNull().default(0),
	isOnline: integer('is_online', { mode: 'boolean' }).default(false),
	hasInternet: integer('has_internet', { mode: 'boolean' }).default(true),
});

// ============= PS Sessions =============

export const psSessions = sqliteTable('ps_sessions', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	stationId: integer('station_id').notNull().references(() => psStations.id),
	startedAt: integer('started_at').notNull(),
	endedAt: integer('ended_at'),
	hourlyRateSnapshot: integer('hourly_rate_snapshot').notNull(),
	totalCost: integer('total_cost'),
	ordersCost: integer('orders_cost').notNull().default(0),
	extraCharges: integer('extra_charges').notNull().default(0),
	transferredCost: integer('transferred_cost').notNull().default(0),
	currentMode: text('current_mode').notNull().default('single'),
	startedBy: text('started_by').notNull().default('manual'),
	timerMinutes: integer('timer_minutes'),
	timerNotified: integer('timer_notified', { mode: 'boolean' }).notNull().default(false),
	costLimitPiasters: integer('cost_limit_piasters'),
	costLimitNotified: integer('cost_limit_notified', { mode: 'boolean' }).notNull().default(false),
	pausedAt: integer('paused_at'),
	totalPausedMs: integer('total_paused_ms').notNull().default(0),
	notes: text('notes'),
});

// ============= PS Menu Items =============

export const psMenuItems = sqliteTable('ps_menu_items', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(),
	nameAr: text('name_ar').notNull(),
	category: text('category').notNull(),
	price: integer('price').notNull(),
	isAvailable: integer('is_available', { mode: 'boolean' }).notNull().default(true),
	sortOrder: integer('sort_order').notNull().default(0),
});

// ============= PS Session Orders =============

export const psSessionOrders = sqliteTable('ps_session_orders', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	sessionId: integer('session_id').notNull().references(() => psSessions.id),
	menuItemId: integer('menu_item_id').notNull().references(() => psMenuItems.id),
	quantity: integer('quantity').notNull(),
	priceSnapshot: integer('price_snapshot').notNull(),
	createdAt: integer('created_at').notNull(),
});

// ============= PS Session Charges =============

export const psSessionCharges = sqliteTable('ps_session_charges', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	sessionId: integer('session_id').notNull().references(() => psSessions.id),
	amount: integer('amount').notNull(),
	reason: text('reason'),
	createdAt: integer('created_at').notNull(),
});

// ============= PS Session Transfers =============

export const psSessionTransfers = sqliteTable('ps_session_transfers', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	fromSessionId: integer('from_session_id').notNull().references(() => psSessions.id),
	toSessionId: integer('to_session_id').notNull().references(() => psSessions.id),
	fromStationId: integer('from_station_id').notNull().references(() => psStations.id),
	gamingAmount: integer('gaming_amount').notNull(),
	ordersAmount: integer('orders_amount').notNull(),
	totalAmount: integer('total_amount').notNull(),
	createdAt: integer('created_at').notNull(),
});

// ============= PS Session Segments =============

export const psSessionSegments = sqliteTable('ps_session_segments', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	sessionId: integer('session_id').notNull().references(() => psSessions.id),
	mode: text('mode').notNull(),
	startedAt: integer('started_at').notNull(),
	endedAt: integer('ended_at'),
	hourlyRateSnapshot: integer('hourly_rate_snapshot').notNull(),
});

// ============= F&B Sales =============

export const fnbSales = sqliteTable('fnb_sales', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	menuItemId: integer('menu_item_id').notNull().references(() => psMenuItems.id),
	quantity: integer('quantity').notNull(),
	priceSnapshot: integer('price_snapshot').notNull(),
	soldAt: integer('sold_at').notNull(),
});

// ============= Expenses =============

export const expenses = sqliteTable('expenses', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	type: text('type').notNull(),
	category: text('category').notNull(),
	name: text('name').notNull(),
	nameAr: text('name_ar').notNull(),
	amount: integer('amount').notNull(),
	isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
	createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
});

// ============= Unified Daily Stats =============

export const unifiedDailyStats = sqliteTable('unified_daily_stats', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	date: text('date').notNull().unique(),
	wifiRevenue: integer('wifi_revenue').notNull().default(0),
	wifiVouchersSold: integer('wifi_vouchers_sold').notNull().default(0),
	wifiDataSold: integer('wifi_data_sold').notNull().default(0),
	wifiDataUsed: integer('wifi_data_used').notNull().default(0),
	psGamingRevenue: integer('ps_gaming_revenue').notNull().default(0),
	psSessions: integer('ps_sessions').notNull().default(0),
	psMinutes: integer('ps_minutes').notNull().default(0),
	psOrdersRevenue: integer('ps_orders_revenue').notNull().default(0),
	fnbRevenue: integer('fnb_revenue').notNull().default(0),
	fnbItemsSold: integer('fnb_items_sold').notNull().default(0),
});

// ============= Printed Vouchers =============

export const printedVouchers = sqliteTable('printed_vouchers', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	voucherCode: text('voucher_code').notNull().unique(),
	printedAt: integer('printed_at').notNull(),
});

// ============= Voucher Usage =============

export const voucherUsage = sqliteTable('voucher_usage', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	voucherCode: text('voucher_code').notNull(),
	macAddress: text('mac_address').notNull(),
	deviceName: text('device_name'),
	ipAddress: text('ip_address'),
	firstConnectedAt: integer('first_connected_at').notNull(),
	lastConnectedAt: integer('last_connected_at').notNull(),
	totalBytes: integer('total_bytes').notNull().default(0),
});
