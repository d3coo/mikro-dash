/**
 * Server-side database layer (SQLite via Drizzle ORM).
 *
 * MIGRATION NOTE: This file previously used ConvexHttpClient.
 * All function signatures are preserved — callers need no changes.
 * IDs are now integer-based but exposed as strings for compatibility.
 */

import { getDb } from './db';
import {
	settings as settingsTable,
	packages as packagesTable,
	psStations as psStationsTable,
	psSessions as psSessionsTable,
	psMenuItems as psMenuItemsTable,
	psSessionOrders as psSessionOrdersTable,
	psSessionCharges as psSessionChargesTable,
	psSessionTransfers as psSessionTransfersTable,
	psSessionSegments as psSessionSegmentsTable,
	fnbSales as fnbSalesTable,
	expenses as expensesTable,
	unifiedDailyStats as unifiedDailyStatsTable,
	printedVouchers as printedVouchersTable,
	voucherUsage as voucherUsageTable,
} from './db/schema';
import { eq, and, isNull, isNotNull, gte, lte, asc, desc, sql } from 'drizzle-orm';
import { getBusinessDayStartMs } from './db/dateUtils';

// ============= Helpers =============

/** Parse a string ID to integer for SQLite lookups */
function toInt(id: string | number): number {
	return typeof id === 'number' ? id : parseInt(id, 10);
}

/** Convert an integer ID to string for API compatibility */
function toStr(id: number): string {
	return String(id);
}

// ============= Settings =============

export async function getSettings(): Promise<Record<string, string>> {
	const db = getDb();
	const rows = db.select().from(settingsTable).all();
	const result: Record<string, string> = {};
	for (const { key, value } of rows) {
		result[key] = value;
	}
	return result;
}

export async function getSetting(key: string): Promise<string | null> {
	const db = getDb();
	const row = db.select().from(settingsTable).where(eq(settingsTable.key, key)).get();
	return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
	const db = getDb();
	db.insert(settingsTable)
		.values({ key, value })
		.onConflictDoUpdate({ target: settingsTable.key, set: { value } })
		.run();
}

// ============= Packages =============

export type Package = {
	_id: string;
	name: string;
	nameAr: string;
	priceLE: number;
	bytesLimit: number;
	timeLimit: string;
	profile: string;
	server?: string;
	sortOrder: number;
};

function mapPackage(row: any): Package {
	return {
		_id: toStr(row.id),
		name: row.name,
		nameAr: row.nameAr,
		priceLE: row.priceLE,
		bytesLimit: row.bytesLimit,
		timeLimit: row.timeLimit,
		profile: row.profile,
		server: row.server ?? undefined,
		sortOrder: row.sortOrder,
	};
}

export async function getPackages(): Promise<Package[]> {
	const db = getDb();
	const rows = db.select().from(packagesTable).orderBy(asc(packagesTable.sortOrder)).all();
	return rows.map(mapPackage);
}

export async function createPackage(data: {
	name: string;
	nameAr: string;
	priceLE: number;
	bytesLimit: number;
	timeLimit?: string;
	profile: string;
	server?: string;
	sortOrder?: number;
}): Promise<string> {
	const db = getDb();
	const result = db.insert(packagesTable).values({
		name: data.name,
		nameAr: data.nameAr,
		priceLE: data.priceLE,
		bytesLimit: data.bytesLimit,
		timeLimit: data.timeLimit || '1d',
		profile: data.profile,
		server: data.server,
		sortOrder: data.sortOrder ?? 0,
	}).run();
	return toStr(Number(result.lastInsertRowid));
}

export async function updatePackage(
	id: string,
	data: Partial<{
		name: string;
		nameAr: string;
		priceLE: number;
		bytesLimit: number;
		timeLimit: string;
		profile: string;
		server: string | null;
		sortOrder: number;
	}>
): Promise<void> {
	const db = getDb();
	const updates: Record<string, any> = {};
	if (data.name !== undefined) updates.name = data.name;
	if (data.nameAr !== undefined) updates.nameAr = data.nameAr;
	if (data.priceLE !== undefined) updates.priceLE = data.priceLE;
	if (data.bytesLimit !== undefined) updates.bytesLimit = data.bytesLimit;
	if (data.timeLimit !== undefined) updates.timeLimit = data.timeLimit;
	if (data.profile !== undefined) updates.profile = data.profile;
	if (data.server !== undefined) updates.server = data.server;
	if (data.sortOrder !== undefined) updates.sortOrder = data.sortOrder;
	if (Object.keys(updates).length > 0) {
		db.update(packagesTable).set(updates).where(eq(packagesTable.id, toInt(id))).run();
	}
}

export async function deletePackage(id: string): Promise<void> {
	const db = getDb();
	db.delete(packagesTable).where(eq(packagesTable.id, toInt(id))).run();
}

// ============= PS Stations =============

export type PsStation = {
	_id: string;
	stationId?: string;
	name: string;
	nameAr: string;
	macAddress: string;
	hourlyRate: number;
	hourlyRateMulti?: number;
	status: string;
	monitorIp?: string;
	monitorPort: number;
	monitorType: string;
	timerEndAction: string;
	hdmiInput: number;
	sortOrder: number;
	isOnline?: boolean;
	hasInternet?: boolean;
};

function mapStation(row: any): PsStation {
	return {
		_id: toStr(row.id),
		stationId: row.stationId ?? undefined,
		name: row.name,
		nameAr: row.nameAr,
		macAddress: row.macAddress,
		hourlyRate: row.hourlyRate,
		hourlyRateMulti: row.hourlyRateMulti ?? undefined,
		status: row.status,
		monitorIp: row.monitorIp ?? undefined,
		monitorPort: row.monitorPort,
		monitorType: row.monitorType,
		timerEndAction: row.timerEndAction,
		hdmiInput: row.hdmiInput,
		sortOrder: row.sortOrder,
		isOnline: row.isOnline ?? false,
		hasInternet: row.hasInternet ?? true,
	};
}

export async function getPsStations(): Promise<PsStation[]> {
	const db = getDb();
	const rows = db.select().from(psStationsTable).orderBy(asc(psStationsTable.sortOrder)).all();
	return rows.map(mapStation);
}

export async function createPsStation(data: {
	stationId: string;
	name: string;
	nameAr: string;
	macAddress: string;
	hourlyRate: number;
	hourlyRateMulti?: number;
	monitorIp?: string;
	monitorPort?: number;
	monitorType?: string;
	timerEndAction?: string;
	hdmiInput?: number;
	sortOrder?: number;
}): Promise<string> {
	const db = getDb();
	const result = db.insert(psStationsTable).values({
		stationId: data.stationId,
		name: data.name,
		nameAr: data.nameAr,
		macAddress: data.macAddress,
		hourlyRate: data.hourlyRate,
		hourlyRateMulti: data.hourlyRateMulti,
		status: 'available',
		monitorIp: data.monitorIp,
		monitorPort: data.monitorPort ?? 8080,
		monitorType: data.monitorType ?? 'tcl',
		timerEndAction: data.timerEndAction ?? 'notify',
		hdmiInput: data.hdmiInput ?? 2,
		sortOrder: data.sortOrder ?? 0,
	}).run();
	return toStr(Number(result.lastInsertRowid));
}

export async function updatePsStation(
	id: string,
	data: Partial<PsStation>
): Promise<void> {
	const db = getDb();
	const { _id, ...rest } = data;
	const updates: Record<string, any> = {};
	if (rest.stationId !== undefined) updates.stationId = rest.stationId;
	if (rest.name !== undefined) updates.name = rest.name;
	if (rest.nameAr !== undefined) updates.nameAr = rest.nameAr;
	if (rest.macAddress !== undefined) updates.macAddress = rest.macAddress;
	if (rest.hourlyRate !== undefined) updates.hourlyRate = rest.hourlyRate;
	if (rest.hourlyRateMulti !== undefined) updates.hourlyRateMulti = rest.hourlyRateMulti;
	if (rest.status !== undefined) updates.status = rest.status;
	if (rest.monitorIp !== undefined) updates.monitorIp = rest.monitorIp;
	if (rest.monitorPort !== undefined) updates.monitorPort = rest.monitorPort;
	if (rest.monitorType !== undefined) updates.monitorType = rest.monitorType;
	if (rest.timerEndAction !== undefined) updates.timerEndAction = rest.timerEndAction;
	if (rest.hdmiInput !== undefined) updates.hdmiInput = rest.hdmiInput;
	if (rest.sortOrder !== undefined) updates.sortOrder = rest.sortOrder;
	if (rest.isOnline !== undefined) updates.isOnline = rest.isOnline;
	if (rest.hasInternet !== undefined) updates.hasInternet = rest.hasInternet;
	if (Object.keys(updates).length > 0) {
		db.update(psStationsTable).set(updates).where(eq(psStationsTable.id, toInt(id))).run();
	}
}

export async function deletePsStation(id: string): Promise<void> {
	const db = getDb();
	db.delete(psStationsTable).where(eq(psStationsTable.id, toInt(id))).run();
}

export async function updatePsStationInternet(id: string, hasInternet: boolean): Promise<void> {
	const db = getDb();
	db.update(psStationsTable).set({ hasInternet }).where(eq(psStationsTable.id, toInt(id))).run();
}

export async function bulkUpdateStationOnlineStatus(updates: Array<{ id: string; isOnline: boolean }>): Promise<void> {
	const db = getDb();
	for (const { id, isOnline } of updates) {
		db.update(psStationsTable).set({ isOnline }).where(eq(psStationsTable.id, toInt(id))).run();
	}
}

export async function getPsStationById(id: string): Promise<PsStation | null> {
	const db = getDb();
	const row = db.select().from(psStationsTable).where(eq(psStationsTable.id, toInt(id))).get();
	return row ? mapStation(row) : null;
}

// ============= PS Menu Items =============

export type PsMenuItem = {
	_id: string;
	name: string;
	nameAr: string;
	category: string;
	price: number;
	isAvailable: boolean;
	sortOrder: number;
};

function mapMenuItem(row: any): PsMenuItem {
	return {
		_id: toStr(row.id),
		name: row.name,
		nameAr: row.nameAr,
		category: row.category,
		price: row.price,
		isAvailable: !!row.isAvailable,
		sortOrder: row.sortOrder,
	};
}

export async function getPsMenuItems(): Promise<PsMenuItem[]> {
	const db = getDb();
	const rows = db.select().from(psMenuItemsTable).orderBy(asc(psMenuItemsTable.sortOrder)).all();
	return rows.map(mapMenuItem);
}

export async function createPsMenuItem(data: {
	name: string;
	nameAr: string;
	category: string;
	price: number;
	isAvailable?: boolean;
	sortOrder?: number;
}): Promise<string> {
	const db = getDb();
	const result = db.insert(psMenuItemsTable).values({
		name: data.name,
		nameAr: data.nameAr,
		category: data.category,
		price: data.price,
		isAvailable: data.isAvailable ?? true,
		sortOrder: data.sortOrder ?? 0,
	}).run();
	return toStr(Number(result.lastInsertRowid));
}

export async function updatePsMenuItem(
	id: string,
	data: Partial<PsMenuItem>
): Promise<void> {
	const db = getDb();
	const { _id, ...rest } = data;
	const updates: Record<string, any> = {};
	if (rest.name !== undefined) updates.name = rest.name;
	if (rest.nameAr !== undefined) updates.nameAr = rest.nameAr;
	if (rest.category !== undefined) updates.category = rest.category;
	if (rest.price !== undefined) updates.price = rest.price;
	if (rest.isAvailable !== undefined) updates.isAvailable = rest.isAvailable;
	if (rest.sortOrder !== undefined) updates.sortOrder = rest.sortOrder;
	if (Object.keys(updates).length > 0) {
		db.update(psMenuItemsTable).set(updates).where(eq(psMenuItemsTable.id, toInt(id))).run();
	}
}

export async function deletePsMenuItem(id: string): Promise<void> {
	const db = getDb();
	db.delete(psMenuItemsTable).where(eq(psMenuItemsTable.id, toInt(id))).run();
}

// ============= PS Sessions =============

/* eslint-disable @typescript-eslint/no-explicit-any */

function mapSession(row: any) {
	return {
		_id: toStr(row.id),
		stationId: toStr(row.stationId),
		startedAt: row.startedAt,
		endedAt: row.endedAt ?? undefined,
		hourlyRateSnapshot: row.hourlyRateSnapshot,
		totalCost: row.totalCost ?? undefined,
		ordersCost: row.ordersCost ?? 0,
		extraCharges: row.extraCharges ?? 0,
		transferredCost: row.transferredCost ?? 0,
		currentMode: row.currentMode,
		startedBy: row.startedBy,
		timerMinutes: row.timerMinutes ?? undefined,
		timerNotified: !!row.timerNotified,
		costLimitPiasters: row.costLimitPiasters ?? undefined,
		costLimitNotified: !!row.costLimitNotified,
		pausedAt: row.pausedAt ?? undefined,
		totalPausedMs: row.totalPausedMs ?? 0,
		notes: row.notes ?? undefined,
	};
}

export async function getStationStatuses() {
	const db = getDb();

	const stations = db.select().from(psStationsTable).orderBy(asc(psStationsTable.sortOrder)).all();
	const activeSessions = db.select().from(psSessionsTable).where(isNull(psSessionsTable.endedAt)).all();
	const activeSessionMap = new Map<number, any>();
	for (const s of activeSessions) {
		activeSessionMap.set(s.stationId, s);
	}

	// Recent ended sessions for last session info
	const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
	const recentEnded = db.select().from(psSessionsTable)
		.where(and(isNotNull(psSessionsTable.endedAt), gte(psSessionsTable.startedAt, thirtyDaysAgo)))
		.orderBy(desc(psSessionsTable.endedAt))
		.all();
	const lastSessionMap = new Map<number, any>();
	for (const s of recentEnded) {
		if (!lastSessionMap.has(s.stationId)) {
			lastSessionMap.set(s.stationId, s);
		}
	}

	// Bulk load related data for all active sessions
	const allOrders = db.select().from(psSessionOrdersTable).all();
	const allCharges = db.select().from(psSessionChargesTable).all();
	const allTransfers = db.select().from(psSessionTransfersTable).all();
	const allSegments = db.select().from(psSessionSegmentsTable).all();
	const menuItems = db.select().from(psMenuItemsTable).all();
	const menuItemMap = new Map(menuItems.map(m => [m.id, m]));

	const result = [];
	for (const station of stations) {
		const activeSession = activeSessionMap.get(station.id) ?? null;
		const lastSession = !activeSession ? (lastSessionMap.get(station.id) ?? null) : null;

		let orders: any[] = [];
		let charges: any[] = [];
		let transfers: any[] = [];
		let segments: any[] = [];
		let lastSessionOrders: any[] = [];
		let lastSessionCharges: any[] = [];
		let lastSessionTransfers: any[] = [];
		let lastSessionSegments: any[] = [];

		if (activeSession) {
			orders = allOrders
				.filter(o => o.sessionId === activeSession.id)
				.map(o => ({
					...o,
					_id: toStr(o.id),
					sessionId: toStr(o.sessionId),
					menuItemId: toStr(o.menuItemId),
					menuItem: menuItemMap.get(o.menuItemId) ? { ...menuItemMap.get(o.menuItemId)!, _id: toStr(menuItemMap.get(o.menuItemId)!.id) } : null,
				}));
			charges = allCharges
				.filter(c => c.sessionId === activeSession.id)
				.map(c => ({ ...c, _id: toStr(c.id), sessionId: toStr(c.sessionId) }));
			transfers = allTransfers
				.filter(t => t.toSessionId === activeSession.id)
				.map(t => ({ ...t, _id: toStr(t.id) }));
			segments = allSegments
				.filter(s => s.sessionId === activeSession.id)
				.map(s => ({ ...s, _id: toStr(s.id), sessionId: toStr(s.sessionId) }));
		} else if (lastSession) {
			lastSessionOrders = allOrders
				.filter(o => o.sessionId === lastSession.id)
				.map(o => ({
					...o,
					_id: toStr(o.id),
					sessionId: toStr(o.sessionId),
					menuItemId: toStr(o.menuItemId),
					menuItem: menuItemMap.get(o.menuItemId) ? { ...menuItemMap.get(o.menuItemId)!, _id: toStr(menuItemMap.get(o.menuItemId)!.id) } : null,
				}));
			lastSessionCharges = allCharges
				.filter(c => c.sessionId === lastSession.id)
				.map(c => ({ ...c, _id: toStr(c.id), sessionId: toStr(c.sessionId) }));
			lastSessionTransfers = allTransfers
				.filter(t => t.toSessionId === lastSession.id)
				.map(t => ({ ...t, _id: toStr(t.id) }));
			lastSessionSegments = allSegments
				.filter(s => s.sessionId === lastSession.id)
				.map(s => ({ ...s, _id: toStr(s.id), sessionId: toStr(s.sessionId) }));
		}

		result.push({
			station: mapStation(station),
			activeSession: activeSession ? mapSession(activeSession) : null,
			lastSession: lastSession ? mapSession(lastSession) : null,
			orders,
			charges,
			transfers,
			segments,
			lastSessionOrders,
			lastSessionCharges,
			lastSessionTransfers,
			lastSessionSegments,
			elapsedMinutes: 0,
			currentCost: 0,
			isPaused: !!activeSession?.pausedAt,
		});
	}

	return result;
}

export async function getTodayPsAnalytics() {
	const db = getDb();
	const todayMs = getBusinessDayStartMs();
	const sessions = db.select().from(psSessionsTable)
		.where(gte(psSessionsTable.startedAt, todayMs))
		.all();

	let totalRevenue = 0;
	let totalMinutes = 0;
	const totalSessions = sessions.length;
	const now = Date.now();

	for (const session of sessions) {
		const endTime = session.endedAt ?? now;
		const durationMs = endTime - session.startedAt - (session.totalPausedMs || 0);
		totalMinutes += Math.floor(durationMs / (1000 * 60));

		if (session.endedAt) {
			totalRevenue += (session.totalCost || 0) + (session.ordersCost || 0) + (session.extraCharges || 0);
		} else {
			const minutes = Math.ceil(durationMs / (1000 * 60));
			const gamingCost = Math.round((session.hourlyRateSnapshot * minutes) / 60);
			totalRevenue += gamingCost + (session.ordersCost || 0) + (session.extraCharges || 0);
		}
	}

	return { totalSessions, totalMinutes, totalRevenue };
}

export async function getActivePsSessions() {
	const db = getDb();
	const rows = db.select().from(psSessionsTable).where(isNull(psSessionsTable.endedAt)).all();
	return rows.map(mapSession);
}

export async function getTimerAlerts() {
	const db = getDb();
	const activeSessions = db.select().from(psSessionsTable).where(isNull(psSessionsTable.endedAt)).all();
	const now = Date.now();
	const alerts = [];

	for (const session of activeSessions) {
		if (session.timerMinutes && !session.timerNotified) {
			const totalPausedMs = session.totalPausedMs || 0;
			const currentlyPausedMs = session.pausedAt ? (now - session.pausedAt) : 0;
			const elapsedMs = now - session.startedAt - totalPausedMs - currentlyPausedMs;
			const elapsedMinutes = Math.floor(elapsedMs / (1000 * 60));

			if (elapsedMinutes >= session.timerMinutes) {
				const station = db.select().from(psStationsTable)
					.where(eq(psStationsTable.id, session.stationId)).get();
				alerts.push({
					sessionId: toStr(session.id),
					stationId: toStr(session.stationId),
					stationName: station?.nameAr || 'Unknown',
					timerMinutes: session.timerMinutes,
					elapsedMinutes,
					isExpired: true,
				});
			}
		}
	}

	return alerts;
}

export async function getStationEarnings() {
	const db = getDb();
	const stations = db.select().from(psStationsTable).orderBy(asc(psStationsTable.sortOrder)).all();
	const todayMs = getBusinessDayStartMs();
	const now = Date.now();
	const todaySessions = db.select().from(psSessionsTable)
		.where(gte(psSessionsTable.startedAt, todayMs))
		.all();

	const sessionsByStation = new Map<number, any[]>();
	for (const session of todaySessions) {
		const existing = sessionsByStation.get(session.stationId) || [];
		existing.push(session);
		sessionsByStation.set(session.stationId, existing);
	}

	const earnings = [];
	for (const station of stations) {
		const sessions = sessionsByStation.get(station.id) || [];
		let todayEarnings = 0;
		let totalMinutes = 0;

		for (const session of sessions) {
			if (session.endedAt) {
				todayEarnings += (session.totalCost || 0) + (session.ordersCost || 0);
				totalMinutes += Math.floor((session.endedAt - session.startedAt) / (1000 * 60));
			} else {
				const durationMs = now - session.startedAt - (session.totalPausedMs || 0);
				const minutes = Math.ceil(durationMs / (1000 * 60));
				todayEarnings += Math.round((session.hourlyRateSnapshot * minutes) / 60) + (session.ordersCost || 0);
				totalMinutes += Math.floor(durationMs / (1000 * 60));
			}
		}

		earnings.push({
			stationId: toStr(station.id),
			stationName: station.nameAr,
			todayEarnings,
			totalSessions: sessions.length,
			totalMinutes,
		});
	}

	return earnings;
}

// ============= Session Mutations =============

export async function startPsSession(
	stationId: string,
	startedBy: 'manual' | 'auto' = 'manual',
	timerMinutes?: number,
	costLimitPiasters?: number,
	customStartTime?: number
): Promise<string> {
	const db = getDb();
	const now = Date.now();
	const startTime = customStartTime ?? now;
	const mode = 'single';
	const intStationId = toInt(stationId);

	const station = db.select().from(psStationsTable).where(eq(psStationsTable.id, intStationId)).get();
	if (!station) throw new Error('Station not found');

	const hourlyRate = station.hourlyRate;

	// Check for existing active session
	const existing = db.select().from(psSessionsTable)
		.where(and(eq(psSessionsTable.stationId, intStationId), isNull(psSessionsTable.endedAt)))
		.get();
	if (existing) throw new Error('Station already has an active session');

	const sessionResult = db.insert(psSessionsTable).values({
		stationId: intStationId,
		startedAt: startTime,
		endedAt: null,
		hourlyRateSnapshot: hourlyRate,
		totalCost: null,
		ordersCost: 0,
		extraCharges: 0,
		transferredCost: 0,
		currentMode: mode,
		startedBy,
		timerMinutes: timerMinutes ?? null,
		timerNotified: false,
		costLimitPiasters: costLimitPiasters ?? null,
		costLimitNotified: false,
		pausedAt: null,
		totalPausedMs: 0,
		notes: null,
	}).run();

	const sessionId = Number(sessionResult.lastInsertRowid);

	// Update station status
	db.update(psStationsTable).set({ status: 'occupied' }).where(eq(psStationsTable.id, intStationId)).run();

	// Create initial segment
	db.insert(psSessionSegmentsTable).values({
		sessionId,
		mode,
		startedAt: startTime,
		endedAt: null,
		hourlyRateSnapshot: hourlyRate,
	}).run();

	return toStr(sessionId);
}

export async function endPsSession(
	id: string,
	notes?: string,
	customTotalCost?: number
) {
	const db = getDb();
	const now = Date.now();
	const intId = toInt(id);

	const session = db.select().from(psSessionsTable).where(eq(psSessionsTable.id, intId)).get();
	if (!session) throw new Error('Session not found');
	if (session.endedAt) throw new Error('Session already ended');

	// End current segment
	const segments = db.select().from(psSessionSegmentsTable)
		.where(eq(psSessionSegmentsTable.sessionId, intId)).all();
	const activeSegment = segments.find(s => s.endedAt === null);
	if (activeSegment) {
		db.update(psSessionSegmentsTable).set({ endedAt: now })
			.where(eq(psSessionSegmentsTable.id, activeSegment.id)).run();
	}

	// Calculate gaming cost from segments
	let calculatedGamingCost = 0;
	const allSegments = segments.map(s =>
		s.id === activeSegment?.id ? { ...s, endedAt: now } : s
	);
	for (const seg of allSegments) {
		const segEnd = seg.endedAt ?? now;
		const segMs = segEnd - seg.startedAt;
		const segMinutes = Math.ceil(segMs / (1000 * 60));
		calculatedGamingCost += Math.round((seg.hourlyRateSnapshot * segMinutes) / 60);
	}

	const ordersCost = session.ordersCost || 0;
	const extraCharges = session.extraCharges || 0;
	const transferredCost = session.transferredCost || 0;

	let gamingCostToStore: number;
	if (customTotalCost !== undefined) {
		gamingCostToStore = Math.max(0, customTotalCost - ordersCost - extraCharges - transferredCost);
	} else {
		gamingCostToStore = calculatedGamingCost;
	}

	db.update(psSessionsTable).set({
		endedAt: now,
		totalCost: gamingCostToStore,
		pausedAt: null,
		notes: notes || session.notes,
	}).where(eq(psSessionsTable.id, intId)).run();

	db.update(psStationsTable).set({ status: 'available' })
		.where(eq(psStationsTable.id, session.stationId)).run();

	return {
		_id: id,
		stationId: toStr(session.stationId),
		totalCost: gamingCostToStore,
		ordersCost,
		extraCharges,
		transferredCost,
	};
}

export async function updatePsSessionStartTime(id: string, newStartTime: number) {
	const db = getDb();
	const intId = toInt(id);
	const session = db.select().from(psSessionsTable).where(eq(psSessionsTable.id, intId)).get();
	if (!session) throw new Error('Session not found');

	db.update(psSessionsTable).set({ startedAt: newStartTime }).where(eq(psSessionsTable.id, intId)).run();

	// Update first segment's start time
	const segments = db.select().from(psSessionSegmentsTable)
		.where(eq(psSessionSegmentsTable.sessionId, intId))
		.orderBy(asc(psSessionSegmentsTable.startedAt)).all();
	if (segments.length > 0) {
		db.update(psSessionSegmentsTable).set({ startedAt: newStartTime })
			.where(eq(psSessionSegmentsTable.id, segments[0].id)).run();
	}

	return { success: true };
}

export async function switchPsSessionMode(id: string, newMode: 'single' | 'multi') {
	const db = getDb();
	const now = Date.now();
	const intId = toInt(id);

	const session = db.select().from(psSessionsTable).where(eq(psSessionsTable.id, intId)).get();
	if (!session) throw new Error('Session not found');
	if (session.endedAt) throw new Error('Cannot switch mode on ended session');
	if (session.currentMode === newMode) return { success: true, message: 'Already in this mode' };

	const station = db.select().from(psStationsTable).where(eq(psStationsTable.id, session.stationId)).get();
	if (!station) throw new Error('Station not found');

	const newHourlyRate = newMode === 'multi' && station.hourlyRateMulti
		? station.hourlyRateMulti
		: station.hourlyRate;

	// End current segment
	const segments = db.select().from(psSessionSegmentsTable)
		.where(eq(psSessionSegmentsTable.sessionId, intId)).all();
	const activeSegment = segments.find(s => s.endedAt === null);
	if (activeSegment) {
		db.update(psSessionSegmentsTable).set({ endedAt: now })
			.where(eq(psSessionSegmentsTable.id, activeSegment.id)).run();
	}

	// Create new segment
	db.insert(psSessionSegmentsTable).values({
		sessionId: intId,
		mode: newMode,
		startedAt: now,
		endedAt: null,
		hourlyRateSnapshot: newHourlyRate,
	}).run();

	// Update session
	db.update(psSessionsTable).set({
		currentMode: newMode,
		hourlyRateSnapshot: newHourlyRate,
	}).where(eq(psSessionsTable.id, intId)).run();

	return { success: true };
}

export async function pausePsSession(id: string, source: string = 'server') {
	const db = getDb();
	const now = Date.now();
	const intId = toInt(id);

	if (!source) {
		console.error(`[PAUSE BLOCKED] REJECTED pause for session ${id} — NO SOURCE.`);
		return { success: false, message: 'source parameter required' };
	}

	const session = db.select().from(psSessionsTable).where(eq(psSessionsTable.id, intId)).get();
	if (!session) throw new Error('Session not found');
	if (session.endedAt) throw new Error('Cannot pause ended session');
	if (session.pausedAt) {
		console.log(`[PAUSE DEBUG] Session ${id} already paused, skipping (source: ${source})`);
		return { success: true, message: 'Session already paused' };
	}

	console.log(`[PAUSE] Pausing session ${id} SOURCE: ${source}`);
	db.update(psSessionsTable).set({ pausedAt: now }).where(eq(psSessionsTable.id, intId)).run();
	return { success: true };
}

export async function resumePsSession(id: string) {
	const db = getDb();
	const now = Date.now();
	const intId = toInt(id);

	const session = db.select().from(psSessionsTable).where(eq(psSessionsTable.id, intId)).get();
	if (!session) throw new Error('Session not found');
	if (session.endedAt) throw new Error('Cannot resume ended session');
	if (!session.pausedAt) return { success: true, message: 'Session not paused' };

	const pausedDuration = now - session.pausedAt;
	const newTotalPausedMs = session.totalPausedMs + pausedDuration;

	db.update(psSessionsTable).set({
		pausedAt: null,
		totalPausedMs: newTotalPausedMs,
	}).where(eq(psSessionsTable.id, intId)).run();

	return { success: true, pausedDuration };
}

export async function updatePsSessionTimer(
	id: string,
	timerMinutes?: number,
	timerNotified?: boolean
) {
	const db = getDb();
	const intId = toInt(id);
	const session = db.select().from(psSessionsTable).where(eq(psSessionsTable.id, intId)).get();
	if (!session) throw new Error('Session not found');

	const updates: Record<string, any> = {};
	if (timerMinutes !== undefined) updates.timerMinutes = timerMinutes;
	if (timerNotified !== undefined) updates.timerNotified = timerNotified;
	if (Object.keys(updates).length > 0) {
		db.update(psSessionsTable).set(updates).where(eq(psSessionsTable.id, intId)).run();
	}
	return { success: true };
}

export async function updatePsSessionCostLimit(
	id: string,
	costLimitPiasters?: number,
	costLimitNotified?: boolean
) {
	const db = getDb();
	const intId = toInt(id);
	const session = db.select().from(psSessionsTable).where(eq(psSessionsTable.id, intId)).get();
	if (!session) throw new Error('Session not found');

	const updates: Record<string, any> = {};
	if (costLimitPiasters !== undefined) updates.costLimitPiasters = costLimitPiasters;
	if (costLimitNotified !== undefined) updates.costLimitNotified = costLimitNotified;
	if (Object.keys(updates).length > 0) {
		db.update(psSessionsTable).set(updates).where(eq(psSessionsTable.id, intId)).run();
	}
	return { success: true };
}

// ============= Session Orders =============

export async function addPsSessionOrder(
	sessionId: string,
	menuItemId: string,
	quantity: number = 1
) {
	const db = getDb();
	const now = Date.now();
	const intSessionId = toInt(sessionId);
	const intMenuItemId = toInt(menuItemId);

	const session = db.select().from(psSessionsTable).where(eq(psSessionsTable.id, intSessionId)).get();
	if (!session) throw new Error('Session not found');
	if (session.endedAt) throw new Error('Cannot add order to ended session');

	const menuItem = db.select().from(psMenuItemsTable).where(eq(psMenuItemsTable.id, intMenuItemId)).get();
	if (!menuItem) throw new Error('Menu item not found');
	if (!menuItem.isAvailable) throw new Error('Menu item is not available');

	const orderCost = menuItem.price * quantity;

	// Check for existing order of same item
	const existingOrders = db.select().from(psSessionOrdersTable)
		.where(eq(psSessionOrdersTable.sessionId, intSessionId)).all();
	const existing = existingOrders.find(o => o.menuItemId === intMenuItemId);

	if (existing) {
		db.update(psSessionOrdersTable).set({ quantity: existing.quantity + quantity })
			.where(eq(psSessionOrdersTable.id, existing.id)).run();
	} else {
		db.insert(psSessionOrdersTable).values({
			sessionId: intSessionId,
			menuItemId: intMenuItemId,
			quantity,
			priceSnapshot: menuItem.price,
			createdAt: now,
		}).run();
	}

	db.update(psSessionsTable).set({
		ordersCost: session.ordersCost + orderCost,
	}).where(eq(psSessionsTable.id, intSessionId)).run();

	return { success: true };
}

export async function removePsSessionOrder(orderId: string) {
	const db = getDb();
	const intOrderId = toInt(orderId);

	const order = db.select().from(psSessionOrdersTable).where(eq(psSessionOrdersTable.id, intOrderId)).get();
	if (!order) throw new Error('Order not found');

	const session = db.select().from(psSessionsTable).where(eq(psSessionsTable.id, order.sessionId)).get();
	if (!session) throw new Error('Session not found');
	if (session.endedAt) throw new Error('Cannot remove order from ended session');

	const orderCost = order.priceSnapshot * order.quantity;
	db.delete(psSessionOrdersTable).where(eq(psSessionOrdersTable.id, intOrderId)).run();
	db.update(psSessionsTable).set({
		ordersCost: Math.max(0, session.ordersCost - orderCost),
	}).where(eq(psSessionsTable.id, order.sessionId)).run();

	return { success: true };
}

// ============= Session Charges =============

export async function addPsSessionCharge(
	sessionId: string,
	amount: number,
	reason?: string
) {
	const db = getDb();
	const now = Date.now();
	const intSessionId = toInt(sessionId);

	const session = db.select().from(psSessionsTable).where(eq(psSessionsTable.id, intSessionId)).get();
	if (!session) throw new Error('Session not found');
	if (session.endedAt) throw new Error('Cannot add charge to ended session');

	db.insert(psSessionChargesTable).values({
		sessionId: intSessionId,
		amount,
		reason,
		createdAt: now,
	}).run();

	db.update(psSessionsTable).set({
		extraCharges: session.extraCharges + amount,
	}).where(eq(psSessionsTable.id, intSessionId)).run();

	return { success: true };
}

export async function updatePsSessionCharge(
	chargeId: string,
	amount: number,
	reason?: string
) {
	const db = getDb();
	const intChargeId = toInt(chargeId);

	const charge = db.select().from(psSessionChargesTable).where(eq(psSessionChargesTable.id, intChargeId)).get();
	if (!charge) throw new Error('Charge not found');

	const session = db.select().from(psSessionsTable).where(eq(psSessionsTable.id, charge.sessionId)).get();
	if (!session) throw new Error('Session not found');
	if (session.endedAt) throw new Error('Cannot update charge on ended session');

	const amountDiff = amount - charge.amount;
	db.update(psSessionChargesTable).set({ amount, reason })
		.where(eq(psSessionChargesTable.id, intChargeId)).run();
	db.update(psSessionsTable).set({
		extraCharges: session.extraCharges + amountDiff,
	}).where(eq(psSessionsTable.id, charge.sessionId)).run();

	return { success: true };
}

export async function deletePsSessionCharge(chargeId: string) {
	const db = getDb();
	const intChargeId = toInt(chargeId);

	const charge = db.select().from(psSessionChargesTable).where(eq(psSessionChargesTable.id, intChargeId)).get();
	if (!charge) throw new Error('Charge not found');

	const session = db.select().from(psSessionsTable).where(eq(psSessionsTable.id, charge.sessionId)).get();
	if (!session) throw new Error('Session not found');
	if (session.endedAt) throw new Error('Cannot delete charge from ended session');

	db.delete(psSessionChargesTable).where(eq(psSessionChargesTable.id, intChargeId)).run();
	db.update(psSessionsTable).set({
		extraCharges: Math.max(0, session.extraCharges - charge.amount),
	}).where(eq(psSessionsTable.id, charge.sessionId)).run();

	return { success: true };
}

// ============= Switch Station =============

export async function switchPsStation(sessionId: string, newStationId: string) {
	const db = getDb();
	const intSessionId = toInt(sessionId);
	const intNewStationId = toInt(newStationId);

	const session = db.select().from(psSessionsTable).where(eq(psSessionsTable.id, intSessionId)).get();
	if (!session) throw new Error('Session not found');
	if (session.endedAt) throw new Error('Session already ended');

	const oldStationId = session.stationId;
	if (oldStationId === intNewStationId) throw new Error('Session already on this station');

	const newStation = db.select().from(psStationsTable).where(eq(psStationsTable.id, intNewStationId)).get();
	if (!newStation) throw new Error('New station not found');
	if (newStation.status === 'occupied') throw new Error('Target station is already occupied');
	if (newStation.status === 'maintenance') throw new Error('Target station is in maintenance');

	const existingActive = db.select().from(psSessionsTable)
		.where(and(eq(psSessionsTable.stationId, intNewStationId), isNull(psSessionsTable.endedAt)))
		.get();
	if (existingActive) throw new Error('Target station already has an active session');

	const now = Date.now();
	const switchNote = `Switched from station at ${new Date(now).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
	const newNotes = session.notes ? `${session.notes}\n${switchNote}` : switchNote;

	db.update(psSessionsTable).set({ stationId: intNewStationId, notes: newNotes })
		.where(eq(psSessionsTable.id, intSessionId)).run();
	db.update(psStationsTable).set({ status: 'available' })
		.where(eq(psStationsTable.id, oldStationId)).run();
	db.update(psStationsTable).set({ status: 'occupied' })
		.where(eq(psStationsTable.id, intNewStationId)).run();

	return { success: true };
}

// ============= Transfer Session =============

export async function transferPsSession(
	fromSessionId: string,
	toSessionId: string,
	includeOrders: boolean
) {
	const db = getDb();
	const intFromId = toInt(fromSessionId);
	const intToId = toInt(toSessionId);

	if (intFromId === intToId) throw new Error('Cannot transfer to same session');

	const fromSession = db.select().from(psSessionsTable).where(eq(psSessionsTable.id, intFromId)).get();
	if (!fromSession) throw new Error('Source session not found');
	if (fromSession.endedAt) throw new Error('Source session already ended');

	const toSession = db.select().from(psSessionsTable).where(eq(psSessionsTable.id, intToId)).get();
	if (!toSession) throw new Error('Target session not found');
	if (toSession.endedAt) throw new Error('Target session already ended');

	const now = Date.now();
	const segments = db.select().from(psSessionSegmentsTable)
		.where(eq(psSessionSegmentsTable.sessionId, intFromId)).all();

	let gamingAmount = 0;
	for (const seg of segments) {
		const segEnd = seg.endedAt ?? now;
		const segMs = segEnd - seg.startedAt;
		const segMinutes = Math.ceil(segMs / (1000 * 60));
		gamingAmount += Math.round((seg.hourlyRateSnapshot * segMinutes) / 60);
	}

	const ordersAmount = includeOrders ? (fromSession.ordersCost || 0) : 0;
	const totalAmount = gamingAmount + ordersAmount + (fromSession.extraCharges || 0);

	const transferResult = db.insert(psSessionTransfersTable).values({
		fromSessionId: intFromId,
		toSessionId: intToId,
		fromStationId: fromSession.stationId,
		gamingAmount,
		ordersAmount,
		totalAmount,
		createdAt: now,
	}).run();
	const transferId = toStr(Number(transferResult.lastInsertRowid));

	db.update(psSessionsTable).set({
		transferredCost: (toSession.transferredCost || 0) + totalAmount,
	}).where(eq(psSessionsTable.id, intToId)).run();

	// End active segment on source
	const activeSegment = segments.find(s => s.endedAt === null);
	if (activeSegment) {
		db.update(psSessionSegmentsTable).set({ endedAt: now })
			.where(eq(psSessionSegmentsTable.id, activeSegment.id)).run();
	}

	db.update(psSessionsTable).set({
		endedAt: now,
		totalCost: 0,
		pausedAt: null,
		notes: `Transferred to target${includeOrders ? ' (with orders)' : ''}`,
	}).where(eq(psSessionsTable.id, intFromId)).run();

	db.update(psStationsTable).set({ status: 'available' })
		.where(eq(psStationsTable.id, fromSession.stationId)).run();

	return { transferId, gamingAmount, ordersAmount, totalAmount };
}

// ============= PS Session History =============

export type PsSessionHistoryItem = {
	_id: string;
	stationId: string;
	stationName: string;
	startedAt: number;
	endedAt?: number;
	totalCost?: number;
	ordersCost?: number;
	extraCharges?: number;
	mode: string;
	startedBy: string;
	notes?: string;
	timerMinutes?: number;
	totalPausedMs?: number;
	orders: Array<{
		_id: string;
		menuItemId: string;
		quantity: number;
		priceSnapshot: number;
		menuItem: { nameAr: string } | null;
	}>;
	charges: Array<{
		_id: string;
		amount: number;
		reason?: string;
	}>;
	segments: Array<{
		_id: string;
		mode: string;
		startedAt: number;
		endedAt?: number;
	}>;
};

export async function getPsSessionHistory(options?: {
	stationId?: string;
	startDate?: number;
	endDate?: number;
	limit?: number;
}): Promise<PsSessionHistoryItem[]> {
	const db = getDb();
	let sessions = db.select().from(psSessionsTable)
		.where(isNotNull(psSessionsTable.endedAt))
		.orderBy(desc(psSessionsTable.endedAt))
		.all();

	if (options?.stationId) {
		const intStationId = toInt(options.stationId);
		sessions = sessions.filter(s => s.stationId === intStationId);
	}
	if (options?.startDate) {
		sessions = sessions.filter(s => s.startedAt >= options.startDate!);
	}
	if (options?.endDate) {
		sessions = sessions.filter(s => s.startedAt <= options.endDate!);
	}
	sessions = sessions.slice(0, options?.limit ?? 100);

	const stations = db.select().from(psStationsTable).all();
	const stationMap = new Map(stations.map(s => [s.id, s]));
	const allOrders = db.select().from(psSessionOrdersTable).all();
	const allCharges = db.select().from(psSessionChargesTable).all();
	const allSegments = db.select().from(psSessionSegmentsTable).all();
	const menuItems = db.select().from(psMenuItemsTable).all();
	const menuItemMap = new Map(menuItems.map(m => [m.id, m]));

	return sessions.map(session => {
		const station = stationMap.get(session.stationId);
		const orders = allOrders
			.filter(o => o.sessionId === session.id)
			.map(o => ({
				_id: toStr(o.id),
				menuItemId: toStr(o.menuItemId),
				quantity: o.quantity,
				priceSnapshot: o.priceSnapshot,
				menuItem: menuItemMap.get(o.menuItemId) ? { nameAr: menuItemMap.get(o.menuItemId)!.nameAr } : null,
			}));
		const charges = allCharges
			.filter(c => c.sessionId === session.id)
			.map(c => ({ _id: toStr(c.id), amount: c.amount, reason: c.reason ?? undefined }));
		const segments = allSegments
			.filter(s => s.sessionId === session.id)
			.map(s => ({ _id: toStr(s.id), mode: s.mode, startedAt: s.startedAt, endedAt: s.endedAt ?? undefined }));

		const durationMs = (session.endedAt ?? 0) - session.startedAt - (session.totalPausedMs || 0);
		const totalCostAll = (session.totalCost || 0) + (session.ordersCost || 0) + (session.extraCharges || 0) + (session.transferredCost || 0);

		return {
			_id: toStr(session.id),
			stationId: toStr(session.stationId),
			stationName: station?.nameAr || 'Unknown',
			startedAt: session.startedAt,
			endedAt: session.endedAt ?? undefined,
			totalCost: session.totalCost ?? undefined,
			ordersCost: session.ordersCost,
			extraCharges: session.extraCharges,
			mode: session.currentMode,
			startedBy: session.startedBy,
			notes: session.notes ?? undefined,
			timerMinutes: session.timerMinutes ?? undefined,
			totalPausedMs: session.totalPausedMs,
			orders,
			charges,
			segments,
			// Extra fields used by some callers
			station: station ? mapStation(station) : null,
			durationMinutes: Math.floor(durationMs / (1000 * 60)),
			totalCostAll,
			transferredCost: session.transferredCost,
			hourlyRateSnapshot: session.hourlyRateSnapshot,
			currentMode: session.currentMode,
			pausedAt: session.pausedAt ?? undefined,
		} as any;
	});
}

export async function getPsAnalytics(period: 'today' | 'week' | 'month'): Promise<{
	totalSessions: number;
	totalMinutes: number;
	totalRevenue: number;
	totalOrders: number;
	avgSessionMinutes: number;
	avgRevenue: number;
}> {
	const db = getDb();
	const now = Date.now();
	let startDate: number;

	if (period === 'today') {
		startDate = getBusinessDayStartMs();
	} else if (period === 'week') {
		startDate = now - 7 * 24 * 60 * 60 * 1000;
	} else {
		startDate = now - 30 * 24 * 60 * 60 * 1000;
	}

	const sessions = db.select().from(psSessionsTable)
		.where(and(isNotNull(psSessionsTable.endedAt), gte(psSessionsTable.startedAt, startDate)))
		.all();

	let totalRevenue = 0;
	let totalMinutes = 0;
	let totalOrders = 0;

	for (const session of sessions) {
		totalRevenue += (session.totalCost || 0) + (session.ordersCost || 0) + (session.extraCharges || 0);
		totalOrders += session.ordersCost || 0;
		const durationMs = (session.endedAt ?? 0) - session.startedAt - (session.totalPausedMs || 0);
		totalMinutes += Math.floor(durationMs / (1000 * 60));
	}

	return {
		totalSessions: sessions.length,
		totalMinutes,
		totalRevenue,
		totalOrders,
		avgSessionMinutes: sessions.length > 0 ? Math.round(totalMinutes / sessions.length) : 0,
		avgRevenue: sessions.length > 0 ? Math.round(totalRevenue / sessions.length) : 0,
	};
}

// ============= F&B Sales =============

export async function getTodayFnbSalesWithItems() {
	const db = getDb();
	const todayMs = getBusinessDayStartMs();
	const sales = db.select().from(fnbSalesTable)
		.where(gte(fnbSalesTable.soldAt, todayMs))
		.all();
	const menuItems = db.select().from(psMenuItemsTable).all();
	const menuItemMap = new Map(menuItems.map(m => [m.id, m]));

	return sales.map(sale => ({
		...sale,
		_id: toStr(sale.id),
		menuItemId: toStr(sale.menuItemId),
		menuItem: menuItemMap.get(sale.menuItemId) ? { ...menuItemMap.get(sale.menuItemId)!, _id: toStr(menuItemMap.get(sale.menuItemId)!.id) } : null,
	}));
}

export async function recordFnbSale(menuItemId: string, quantity: number) {
	const db = getDb();
	const intMenuItemId = toInt(menuItemId);
	const menuItem = db.select().from(psMenuItemsTable).where(eq(psMenuItemsTable.id, intMenuItemId)).get();
	if (!menuItem) throw new Error('Menu item not found');
	if (!menuItem.isAvailable) throw new Error('Menu item is not available');

	const result = db.insert(fnbSalesTable).values({
		menuItemId: intMenuItemId,
		quantity,
		priceSnapshot: menuItem.price,
		soldAt: Date.now(),
	}).run();
	return toStr(Number(result.lastInsertRowid));
}

export async function deleteFnbSale(id: string) {
	const db = getDb();
	db.delete(fnbSalesTable).where(eq(fnbSalesTable.id, toInt(id))).run();
}

export async function getFnbSales(options?: { startDate?: number; endDate?: number; limit?: number }) {
	const db = getDb();
	let sales = db.select().from(fnbSalesTable).orderBy(desc(fnbSalesTable.soldAt)).all();
	if (options?.startDate) sales = sales.filter(s => s.soldAt >= options.startDate!);
	if (options?.endDate) sales = sales.filter(s => s.soldAt <= options.endDate!);
	if (options?.limit) sales = sales.slice(0, options.limit);

	const menuItems = db.select().from(psMenuItemsTable).all();
	const menuItemMap = new Map(menuItems.map(m => [m.id, m]));

	return sales.map(sale => ({
		...sale,
		_id: toStr(sale.id),
		menuItemId: toStr(sale.menuItemId),
		menuItem: menuItemMap.get(sale.menuItemId) ? { ...menuItemMap.get(sale.menuItemId)!, _id: toStr(menuItemMap.get(sale.menuItemId)!.id) } : null,
	}));
}

export async function getFnbSalesSummary(startDate: number, endDate: number) {
	const db = getDb();
	const sales = db.select().from(fnbSalesTable)
		.where(and(gte(fnbSalesTable.soldAt, startDate), lte(fnbSalesTable.soldAt, endDate)))
		.all();

	let totalRevenue = 0;
	let totalItemsSold = 0;
	const salesByCategory: Record<string, { count: number; revenue: number }> = {};

	const menuItems = db.select().from(psMenuItemsTable).all();
	const menuItemMap = new Map(menuItems.map(m => [m.id, m]));

	for (const sale of sales) {
		const saleTotal = sale.priceSnapshot * sale.quantity;
		totalRevenue += saleTotal;
		totalItemsSold += sale.quantity;
		const menuItem = menuItemMap.get(sale.menuItemId);
		const category = menuItem?.category || 'unknown';
		if (!salesByCategory[category]) salesByCategory[category] = { count: 0, revenue: 0 };
		salesByCategory[category].count += sale.quantity;
		salesByCategory[category].revenue += saleTotal;
	}

	return { totalRevenue, totalItemsSold, salesByCategory };
}

export async function getFnbSaleById(id: string) {
	const db = getDb();
	const sale = db.select().from(fnbSalesTable).where(eq(fnbSalesTable.id, toInt(id))).get();
	if (!sale) return null;
	return { ...sale, _id: toStr(sale.id), menuItemId: toStr(sale.menuItemId) };
}

// ============= Print Tracking =============

export async function markVouchersAsPrinted(voucherCodes: string[]): Promise<void> {
	if (voucherCodes.length === 0) return;
	const db = getDb();
	const now = Date.now();
	for (const code of voucherCodes) {
		db.insert(printedVouchersTable)
			.values({ voucherCode: code, printedAt: now })
			.onConflictDoUpdate({ target: printedVouchersTable.voucherCode, set: { printedAt: now } })
			.run();
	}
}

export async function isVoucherPrinted(voucherCode: string): Promise<boolean> {
	const db = getDb();
	const row = db.select().from(printedVouchersTable)
		.where(eq(printedVouchersTable.voucherCode, voucherCode)).get();
	return !!row;
}

export async function getVouchersPrintStatus(voucherCodes: string[]): Promise<Map<string, number | undefined>> {
	const result = new Map<string, number | undefined>();
	if (voucherCodes.length === 0) return result;
	const db = getDb();
	const rows = db.select().from(printedVouchersTable).all();
	const codeSet = new Set(voucherCodes);
	for (const row of rows) {
		if (codeSet.has(row.voucherCode)) {
			result.set(row.voucherCode, row.printedAt);
		}
	}
	return result;
}

export async function getAllPrintedVoucherCodes(): Promise<Set<string>> {
	const db = getDb();
	const rows = db.select({ voucherCode: printedVouchersTable.voucherCode }).from(printedVouchersTable).all();
	return new Set(rows.map(r => r.voucherCode));
}

export async function removePrintTracking(voucherCodes: string[]): Promise<void> {
	if (voucherCodes.length === 0) return;
	const db = getDb();
	for (const code of voucherCodes) {
		db.delete(printedVouchersTable).where(eq(printedVouchersTable.voucherCode, code)).run();
	}
}

export async function getPrintedCounts(allVoucherCodes: string[]): Promise<{ printed: number; unprinted: number }> {
	const printedCodes = await getAllPrintedVoucherCodes();
	const printed = allVoucherCodes.filter(c => printedCodes.has(c)).length;
	return { printed, unprinted: allVoucherCodes.length - printed };
}

// ============= Voucher Usage =============

export async function recordVoucherUsage(
	voucherCode: string,
	macAddress: string,
	deviceName?: string,
	ipAddress?: string,
	totalBytes?: number
): Promise<void> {
	const db = getDb();
	const now = Date.now();

	// Check if record exists for this voucher+mac combo
	const existing = db.select().from(voucherUsageTable)
		.where(and(eq(voucherUsageTable.voucherCode, voucherCode), eq(voucherUsageTable.macAddress, macAddress)))
		.get();

	if (existing) {
		const updates: Record<string, any> = { lastConnectedAt: now };
		if (deviceName !== undefined) updates.deviceName = deviceName;
		if (ipAddress !== undefined) updates.ipAddress = ipAddress;
		if (totalBytes !== undefined) updates.totalBytes = totalBytes;
		db.update(voucherUsageTable).set(updates).where(eq(voucherUsageTable.id, existing.id)).run();
	} else {
		db.insert(voucherUsageTable).values({
			voucherCode,
			macAddress,
			deviceName: deviceName ?? null,
			ipAddress: ipAddress ?? null,
			firstConnectedAt: now,
			lastConnectedAt: now,
			totalBytes: totalBytes ?? 0,
		}).run();
	}
}

export async function getVoucherUsageHistory(voucherCode: string) {
	const db = getDb();
	return db.select().from(voucherUsageTable)
		.where(eq(voucherUsageTable.voucherCode, voucherCode))
		.all()
		.map(r => ({ ...r, _id: toStr(r.id) }));
}

export async function deleteVoucherUsageHistory(voucherCode: string): Promise<void> {
	const db = getDb();
	db.delete(voucherUsageTable).where(eq(voucherUsageTable.voucherCode, voucherCode)).run();
}

export async function getLastDeviceForVoucher(voucherCode: string) {
	const db = getDb();
	const row = db.select().from(voucherUsageTable)
		.where(eq(voucherUsageTable.voucherCode, voucherCode))
		.orderBy(desc(voucherUsageTable.lastConnectedAt))
		.limit(1)
		.get();
	return row ? { ...row, _id: toStr(row.id) } : null;
}

export async function getAllVoucherUsage() {
	const db = getDb();
	return db.select().from(voucherUsageTable).all()
		.map(r => ({ ...r, _id: toStr(r.id) }));
}

export async function getVoucherDeviceMap() {
	const db = getDb();
	// Get the most recent entry per voucher code
	const rows = db.select().from(voucherUsageTable)
		.orderBy(desc(voucherUsageTable.lastConnectedAt))
		.all();

	// Deduplicate: keep only first (most recent) per voucher
	const seen = new Set<string>();
	const result = [];
	for (const row of rows) {
		if (!seen.has(row.voucherCode)) {
			seen.add(row.voucherCode);
			result.push({
				voucherCode: row.voucherCode,
				macAddress: row.macAddress,
				deviceName: row.deviceName ?? null,
			});
		}
	}
	return result;
}

// ============= Expenses =============

export type ConvexExpense = {
	_id: string;
	_creationTime: number;
	type: string;
	category: string;
	name: string;
	nameAr: string;
	amount: number;
	isActive: boolean;
};

function mapExpense(row: any): ConvexExpense {
	return {
		_id: toStr(row.id),
		_creationTime: row.createdAt,
		type: row.type,
		category: row.category,
		name: row.name,
		nameAr: row.nameAr,
		amount: row.amount,
		isActive: !!row.isActive,
	};
}

export async function getExpenses(): Promise<ConvexExpense[]> {
	const db = getDb();
	return db.select().from(expensesTable).all().map(mapExpense);
}

export async function getActiveExpenses(): Promise<ConvexExpense[]> {
	const db = getDb();
	return db.select().from(expensesTable)
		.where(eq(expensesTable.isActive, true))
		.all()
		.map(mapExpense);
}

export async function createExpense(data: {
	type: string;
	category: string;
	name: string;
	nameAr: string;
	amount: number;
	isActive: boolean;
}): Promise<string> {
	const db = getDb();
	const result = db.insert(expensesTable).values({
		type: data.type,
		category: data.category,
		name: data.name,
		nameAr: data.nameAr,
		amount: data.amount,
		isActive: data.isActive,
		createdAt: Date.now(),
	}).run();
	return toStr(Number(result.lastInsertRowid));
}

export async function updateExpense(
	id: string,
	data: Partial<{
		type: string;
		category: string;
		name: string;
		nameAr: string;
		amount: number;
		isActive: boolean;
	}>
): Promise<string> {
	const db = getDb();
	const updates: Record<string, any> = {};
	if (data.type !== undefined) updates.type = data.type;
	if (data.category !== undefined) updates.category = data.category;
	if (data.name !== undefined) updates.name = data.name;
	if (data.nameAr !== undefined) updates.nameAr = data.nameAr;
	if (data.amount !== undefined) updates.amount = data.amount;
	if (data.isActive !== undefined) updates.isActive = data.isActive;
	if (Object.keys(updates).length > 0) {
		db.update(expensesTable).set(updates).where(eq(expensesTable.id, toInt(id))).run();
	}
	return id;
}

export async function deleteExpense(id: string): Promise<void> {
	const db = getDb();
	db.delete(expensesTable).where(eq(expensesTable.id, toInt(id))).run();
}

// ============= Unified Daily Stats =============

export type ConvexUnifiedDailyStat = {
	_id: string;
	_creationTime: number;
	date: string;
	wifiRevenue: number;
	wifiVouchersSold: number;
	wifiDataSold: number;
	wifiDataUsed: number;
	psGamingRevenue: number;
	psSessions: number;
	psMinutes: number;
	psOrdersRevenue: number;
	fnbRevenue: number;
	fnbItemsSold: number;
};

function mapDailyStat(row: any): ConvexUnifiedDailyStat {
	return {
		_id: toStr(row.id),
		_creationTime: 0,
		date: row.date,
		wifiRevenue: row.wifiRevenue,
		wifiVouchersSold: row.wifiVouchersSold,
		wifiDataSold: row.wifiDataSold,
		wifiDataUsed: row.wifiDataUsed,
		psGamingRevenue: row.psGamingRevenue,
		psSessions: row.psSessions,
		psMinutes: row.psMinutes,
		psOrdersRevenue: row.psOrdersRevenue,
		fnbRevenue: row.fnbRevenue,
		fnbItemsSold: row.fnbItemsSold,
	};
}

export async function getUnifiedDailyStatsByDate(date: string): Promise<ConvexUnifiedDailyStat | null> {
	const db = getDb();
	const row = db.select().from(unifiedDailyStatsTable)
		.where(eq(unifiedDailyStatsTable.date, date)).get();
	return row ? mapDailyStat(row) : null;
}

export async function getUnifiedDailyStatsRange(
	startDate: string,
	endDate: string
): Promise<ConvexUnifiedDailyStat[]> {
	const db = getDb();
	const rows = db.select().from(unifiedDailyStatsTable)
		.where(and(gte(unifiedDailyStatsTable.date, startDate), lte(unifiedDailyStatsTable.date, endDate)))
		.all();
	return rows.map(mapDailyStat);
}

export async function upsertUnifiedDailyStats(data: {
	date: string;
	wifiRevenue?: number;
	wifiVouchersSold?: number;
	wifiDataSold?: number;
	wifiDataUsed?: number;
	psGamingRevenue?: number;
	psSessions?: number;
	psMinutes?: number;
	psOrdersRevenue?: number;
	fnbRevenue?: number;
	fnbItemsSold?: number;
}): Promise<string> {
	const db = getDb();
	const existing = db.select().from(unifiedDailyStatsTable)
		.where(eq(unifiedDailyStatsTable.date, data.date)).get();

	if (existing) {
		const updates: Record<string, any> = {};
		if (data.wifiRevenue !== undefined) updates.wifiRevenue = data.wifiRevenue;
		if (data.wifiVouchersSold !== undefined) updates.wifiVouchersSold = data.wifiVouchersSold;
		if (data.wifiDataSold !== undefined) updates.wifiDataSold = data.wifiDataSold;
		if (data.wifiDataUsed !== undefined) updates.wifiDataUsed = data.wifiDataUsed;
		if (data.psGamingRevenue !== undefined) updates.psGamingRevenue = data.psGamingRevenue;
		if (data.psSessions !== undefined) updates.psSessions = data.psSessions;
		if (data.psMinutes !== undefined) updates.psMinutes = data.psMinutes;
		if (data.psOrdersRevenue !== undefined) updates.psOrdersRevenue = data.psOrdersRevenue;
		if (data.fnbRevenue !== undefined) updates.fnbRevenue = data.fnbRevenue;
		if (data.fnbItemsSold !== undefined) updates.fnbItemsSold = data.fnbItemsSold;
		if (Object.keys(updates).length > 0) {
			db.update(unifiedDailyStatsTable).set(updates)
				.where(eq(unifiedDailyStatsTable.id, existing.id)).run();
		}
		return toStr(existing.id);
	} else {
		const result = db.insert(unifiedDailyStatsTable).values({
			date: data.date,
			wifiRevenue: data.wifiRevenue ?? 0,
			wifiVouchersSold: data.wifiVouchersSold ?? 0,
			wifiDataSold: data.wifiDataSold ?? 0,
			wifiDataUsed: data.wifiDataUsed ?? 0,
			psGamingRevenue: data.psGamingRevenue ?? 0,
			psSessions: data.psSessions ?? 0,
			psMinutes: data.psMinutes ?? 0,
			psOrdersRevenue: data.psOrdersRevenue ?? 0,
			fnbRevenue: data.fnbRevenue ?? 0,
			fnbItemsSold: data.fnbItemsSold ?? 0,
		}).run();
		return toStr(Number(result.lastInsertRowid));
	}
}

/* eslint-enable @typescript-eslint/no-explicit-any */
