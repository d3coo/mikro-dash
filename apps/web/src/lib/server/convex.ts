/**
 * Server-side Convex client
 * Uses ConvexHttpClient for SSR and API routes
 */

import { ConvexHttpClient } from 'convex/browser';
import { env } from '$env/dynamic/public';
import { api } from '../../../convex/_generated/api';

// Create a new client for each request to avoid state issues
export function getConvexClient() {
	const url = env.PUBLIC_CONVEX_URL as string;
	if (!url) {
		throw new Error('PUBLIC_CONVEX_URL environment variable is not set');
	}
	return new ConvexHttpClient(url);
}

// Re-export the API for convenience
export { api };

// ============= Settings =============

export async function getSettings(): Promise<Record<string, string>> {
	const client = getConvexClient();
	const settings = await client.query(api.settings.getAll);
	const result: Record<string, string> = {};
	for (const { key, value } of settings) {
		result[key] = value;
	}
	return result;
}

export async function getSetting(key: string): Promise<string | null> {
	const client = getConvexClient();
	const setting = await client.query(api.settings.get, { key });
	return setting?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
	const client = getConvexClient();
	await client.mutation(api.settings.set, { key, value });
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

export async function getPackages(): Promise<Package[]> {
	const client = getConvexClient();
	return await client.query(api.packages.list);
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
	const client = getConvexClient();
	return await client.mutation(api.packages.create, {
		name: data.name,
		nameAr: data.nameAr,
		priceLE: data.priceLE,
		bytesLimit: data.bytesLimit,
		timeLimit: data.timeLimit || '1d',
		profile: data.profile,
		server: data.server,
		sortOrder: data.sortOrder ?? 0
	});
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
	const client = getConvexClient();
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	await client.mutation(api.packages.update, { id, ...data } as any);
}

export async function deletePackage(id: string): Promise<void> {
	const client = getConvexClient();
	await client.mutation(api.packages.remove, { id: id as any });
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
};

export async function getPsStations(): Promise<PsStation[]> {
	const client = getConvexClient();
	return await client.query(api.psStations.list);
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
	const client = getConvexClient();
	return await client.mutation(api.psStations.create, {
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
		sortOrder: data.sortOrder ?? 0
	});
}

export async function updatePsStation(
	id: string,
	data: Partial<PsStation>
): Promise<void> {
	const client = getConvexClient();
	const { _id, ...updateData } = data;
	await client.mutation(api.psStations.update, { id: id as any, ...updateData });
}

export async function deletePsStation(id: string): Promise<void> {
	const client = getConvexClient();
	await client.mutation(api.psStations.remove, { id: id as any });
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

export async function getPsMenuItems(): Promise<PsMenuItem[]> {
	const client = getConvexClient();
	return await client.query(api.psMenuItems.list);
}

export async function createPsMenuItem(data: {
	name: string;
	nameAr: string;
	category: string;
	price: number;
	isAvailable?: boolean;
	sortOrder?: number;
}): Promise<string> {
	const client = getConvexClient();
	return await client.mutation(api.psMenuItems.create, {
		name: data.name,
		nameAr: data.nameAr,
		category: data.category,
		price: data.price,
		isAvailable: data.isAvailable ?? true,
		sortOrder: data.sortOrder ?? 0
	});
}

export async function updatePsMenuItem(
	id: string,
	data: Partial<PsMenuItem>
): Promise<void> {
	const client = getConvexClient();
	const { _id, ...updateData } = data;
	await client.mutation(api.psMenuItems.update, { id: id as any, ...updateData });
}

export async function deletePsMenuItem(id: string): Promise<void> {
	const client = getConvexClient();
	await client.mutation(api.psMenuItems.remove, { id: id as any });
}

// ============= PS Station by ID =============

export async function getPsStationById(id: string): Promise<PsStation | null> {
	const client = getConvexClient();
	return await client.query(api.psStations.getById, { id: id as any });
}

// ============= PS Sessions =============

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function getStationStatuses() {
	const client = getConvexClient();
	return await client.query(api.psSessions.getStationStatuses);
}

export async function getTodayPsAnalytics() {
	const client = getConvexClient();
	return await client.query(api.psSessions.getTodayAnalytics);
}

export async function getActivePsSessions() {
	const client = getConvexClient();
	return await client.query(api.psSessions.getActive);
}

export async function getTimerAlerts() {
	const client = getConvexClient();
	return await client.query(api.psSessions.getTimerAlerts);
}

export async function getStationEarnings() {
	const client = getConvexClient();
	return await client.query(api.psSessions.getStationEarnings);
}

export async function startPsSession(
	stationId: string,
	startedBy: 'manual' | 'auto' = 'manual',
	timerMinutes?: number,
	costLimitPiasters?: number,
	customStartTime?: number
): Promise<string> {
	const client = getConvexClient();
	return await client.mutation(api.psSessions.start, {
		stationId: stationId as any,
		startedBy,
		timerMinutes,
		costLimitPiasters,
		customStartTime,
	});
}

export async function endPsSession(
	id: string,
	notes?: string,
	customTotalCost?: number
) {
	const client = getConvexClient();
	return await client.mutation(api.psSessions.end, {
		id: id as any,
		notes,
		customTotalCost,
	});
}

export async function updatePsSessionStartTime(id: string, newStartTime: number) {
	const client = getConvexClient();
	return await client.mutation(api.psSessions.updateStartTime, {
		id: id as any,
		newStartTime,
	});
}

export async function switchPsSessionMode(id: string, newMode: 'single' | 'multi') {
	const client = getConvexClient();
	return await client.mutation(api.psSessions.switchMode, {
		id: id as any,
		newMode,
	});
}

export async function pausePsSession(id: string) {
	const client = getConvexClient();
	return await client.mutation(api.psSessions.pause, { id: id as any });
}

export async function resumePsSession(id: string) {
	const client = getConvexClient();
	return await client.mutation(api.psSessions.resume, { id: id as any });
}

export async function updatePsSessionTimer(
	id: string,
	timerMinutes?: number,
	timerNotified?: boolean
) {
	const client = getConvexClient();
	return await client.mutation(api.psSessions.updateTimer, {
		id: id as any,
		timerMinutes,
		timerNotified,
	});
}

export async function updatePsSessionCostLimit(
	id: string,
	costLimitPiasters?: number,
	costLimitNotified?: boolean
) {
	const client = getConvexClient();
	return await client.mutation(api.psSessions.updateCostLimit, {
		id: id as any,
		costLimitPiasters,
		costLimitNotified,
	});
}

export async function addPsSessionOrder(
	sessionId: string,
	menuItemId: string,
	quantity: number = 1
) {
	const client = getConvexClient();
	return await client.mutation(api.psSessions.addOrder, {
		sessionId: sessionId as any,
		menuItemId: menuItemId as any,
		quantity,
	});
}

export async function removePsSessionOrder(orderId: string) {
	const client = getConvexClient();
	return await client.mutation(api.psSessions.removeOrder, {
		orderId: orderId as any,
	});
}

export async function addPsSessionCharge(
	sessionId: string,
	amount: number,
	reason?: string
) {
	const client = getConvexClient();
	return await client.mutation(api.psSessions.addCharge, {
		sessionId: sessionId as any,
		amount,
		reason,
	});
}

export async function updatePsSessionCharge(
	chargeId: string,
	amount: number,
	reason?: string
) {
	const client = getConvexClient();
	return await client.mutation(api.psSessions.updateCharge, {
		chargeId: chargeId as any,
		amount,
		reason,
	});
}

export async function deletePsSessionCharge(chargeId: string) {
	const client = getConvexClient();
	return await client.mutation(api.psSessions.deleteCharge, {
		chargeId: chargeId as any,
	});
}

export async function switchPsStation(sessionId: string, newStationId: string) {
	const client = getConvexClient();
	return await client.mutation(api.psSessions.switchStation, {
		id: sessionId as any,
		newStationId: newStationId as any,
	});
}

export async function transferPsSession(
	fromSessionId: string,
	toSessionId: string,
	includeOrders: boolean
) {
	const client = getConvexClient();
	return await client.mutation(api.psSessions.transferSession, {
		fromSessionId: fromSessionId as any,
		toSessionId: toSessionId as any,
		includeOrders,
	});
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
	const client = getConvexClient();
	return await client.query(api.psSessions.getHistory, {
		stationId: options?.stationId as any,
		startDate: options?.startDate,
		endDate: options?.endDate,
		limit: options?.limit,
	}) as any;
}

export async function getPsAnalytics(period: 'today' | 'week' | 'month'): Promise<{
	totalSessions: number;
	totalMinutes: number;
	totalRevenue: number;
	totalOrders: number;
	avgSessionMinutes: number;
	avgRevenue: number;
}> {
	const client = getConvexClient();
	return await client.query(api.psSessions.getAnalytics, { period });
}

// ============= F&B Sales =============

export async function getTodayFnbSalesWithItems() {
	const client = getConvexClient();
	return await client.query(api.fnbSales.getTodaySalesWithItems);
}

export async function recordFnbSale(menuItemId: string, quantity: number) {
	const client = getConvexClient();
	return await client.mutation(api.fnbSales.recordSale, {
		menuItemId: menuItemId as any,
		quantity,
	});
}

export async function deleteFnbSale(id: string) {
	const client = getConvexClient();
	return await client.mutation(api.fnbSales.remove, { id: id as any });
}

/* eslint-enable @typescript-eslint/no-explicit-any */
