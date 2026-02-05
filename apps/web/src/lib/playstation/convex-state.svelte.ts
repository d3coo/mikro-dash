/**
 * PlayStation Convex State Management (Persistent Singleton)
 *
 * Subscriptions persist across page navigations - no re-fetching.
 * Uses ConvexClient.onUpdate() directly instead of useQuery()
 * which gets destroyed on component unmount.
 */

import { browser } from '$app/environment';
import { toast } from 'svelte-sonner';
import { getContext } from 'svelte';
import { ConvexClient } from 'convex/browser';
import { api } from '../../../convex/_generated/api';

// Types
export interface StationStatus {
	station: {
		id: string;
		_id?: string;
		stationId?: string;
		name: string;
		nameAr: string;
		macAddress: string;
		hourlyRate: number;
		hourlyRateMulti?: number | null;
		status: string;
		monitorIp?: string | null;
		monitorPort: number;
		monitorType: string;
		timerEndAction: string;
		hdmiInput: number;
		sortOrder: number;
	};
	activeSession: {
		id: string | number;
		_id?: string;
		stationId: string;
		startedAt: number;
		endedAt?: number | null;
		hourlyRateSnapshot: number;
		totalCost?: number | null;
		ordersCost: number;
		extraCharges: number;
		transferredCost: number;
		currentMode: string;
		startedBy: string;
		timerMinutes?: number | null;
		timerNotified: boolean;
		costLimitPiasters?: number | null;
		costLimitNotified: boolean;
		pausedAt?: number | null;
		totalPausedMs: number;
		notes?: string | null;
	} | null;
	lastSession: any | null;
	orders: any[];
	charges: any[];
	segments: any[];
	transfers: any[];
	elapsedMinutes: number;
	currentCost: number;
	isPaused: boolean;
	isOnline: boolean;
	isOfflineWithSession: boolean;
	costBreakdown: { total: number; breakdown: Array<{ mode: string; minutes: number; cost: number }> } | null;
	lastSessionOrders: any[];
	lastSessionCharges: any[];
	lastSessionTransfers: any[];
	lastSessionSegments: any[];
}

export interface MenuItem {
	id: string | number;
	_id?: string;
	name: string;
	nameAr: string;
	category: string;
	price: number;
	isAvailable: boolean;
	sortOrder: number;
}

export interface AnalyticsSummary {
	totalSessions: number;
	totalMinutes: number;
	totalRevenue: number;
}

// ============= Mapping helpers =============

function mapId<T extends { _id: string }>(obj: T): T & { id: string } {
	return { ...obj, id: obj._id };
}

function mapStation<T extends { _id: string; stationId?: string }>(obj: T): T & { id: string } {
	return { ...obj, id: obj.stationId || obj._id };
}

function mapStationStatus(status: any): StationStatus {
	const station = mapStation(status.station);
	const activeSession = status.activeSession ? mapId(status.activeSession) : null;
	const lastSession = status.lastSession ? mapId(status.lastSession) : null;
	const orders = (status.orders || []).map((o: any) => ({
		...mapId(o),
		menuItem: o.menuItem ? mapId(o.menuItem) : null,
	}));
	const charges = (status.charges || []).map((c: any) => mapId(c));
	const segments = (status.segments || []).map((s: any) => mapId(s));

	let costBreakdown: StationStatus['costBreakdown'] = null;
	if (activeSession && segments.length > 0) {
		const breakdown = segments.map((seg: any) => ({
			mode: seg.mode || 'single',
			minutes: Math.ceil((seg.endedAt ?? Date.now()) - seg.startedAt) / (1000 * 60),
			cost: Math.round((seg.hourlyRateSnapshot * Math.ceil(((seg.endedAt ?? Date.now()) - seg.startedAt) / (1000 * 60))) / 60),
		}));
		costBreakdown = {
			total: breakdown.reduce((sum: number, b: any) => sum + b.cost, 0),
			breakdown,
		};
	} else if (activeSession) {
		const cost = status.currentCost;
		costBreakdown = {
			total: cost,
			breakdown: [{ mode: activeSession.currentMode || 'single', minutes: status.elapsedMinutes, cost }],
		};
	}

	return {
		station,
		activeSession,
		lastSession,
		orders,
		charges,
		segments,
		transfers: [],
		elapsedMinutes: status.elapsedMinutes || 0,
		currentCost: status.currentCost || 0,
		isPaused: status.isPaused || false,
		isOnline: true,
		isOfflineWithSession: false,
		costBreakdown,
		lastSessionOrders: [],
		lastSessionCharges: [],
		lastSessionTransfers: [],
		lastSessionSegments: [],
	};
}

function mapMenuItems(items: any[]): MenuItem[] {
	return items.map(item => mapId(item));
}

// Extract number from station name for sorting (e.g., "ps-01" -> 1, "جهاز ٣" -> 3)
const arabicDigits: Record<string, string> = { '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9' };
function extractStationNumber(name: string): number {
	// Try Western digits first
	const western = name.match(/\d+/);
	if (western) return parseInt(western[0], 10);
	// Try Arabic/Eastern digits
	const arabic = name.match(/[٠-٩]+/);
	if (arabic) return parseInt(arabic[0].replace(/[٠-٩]/g, d => arabicDigits[d] || d), 10);
	return 999;
}

function sortStations(a: StationStatus, b: StationStatus): number {
	// First by sortOrder, then by number extracted from name (try English first, then Arabic)
	if (a.station.sortOrder !== b.station.sortOrder) {
		return a.station.sortOrder - b.station.sortOrder;
	}
	const numA = extractStationNumber(a.station.name) !== 999
		? extractStationNumber(a.station.name)
		: extractStationNumber(a.station.nameAr);
	const numB = extractStationNumber(b.station.name) !== 999
		? extractStationNumber(b.station.name)
		: extractStationNumber(b.station.nameAr);
	return numA - numB;
}

// ============= Persistent Singleton =============

// Module-level cached state - survives page navigations
let cachedState: PsConvexState | null = null;

// Module-level reactive state (Svelte 5 runes at module scope)
let _stationStatuses = $state<StationStatus[] | undefined>(undefined);
let _analytics = $state<AnalyticsSummary | undefined>(undefined);
let _menuItems = $state<MenuItem[] | undefined>(undefined);
let _isReady = $state(false);
let _hasError = $state(false);

// Track subscriptions so we don't double-subscribe
let subscriptionsActive = false;

function initSubscriptions(client: ConvexClient) {
	if (subscriptionsActive) return;
	subscriptionsActive = true;

	// Subscribe to station statuses
	client.onUpdate(api.psSessions.getStationStatuses, {}, (data: any) => {
		try {
			if (!data || data.length === 0) {
				_stationStatuses = [];
			} else {
				_stationStatuses = data.map(mapStationStatus).sort(sortStations);
			}
			_isReady = true;
		} catch (e) {
			console.warn('[Convex] Failed to map station statuses:', e);
		}
	});

	// Subscribe to analytics
	client.onUpdate(api.psSessions.getTodayAnalytics, {}, (data: any) => {
		_analytics = data as AnalyticsSummary;
	});

	// Subscribe to menu items
	client.onUpdate(api.psMenuItems.list, {}, (data: any) => {
		try {
			_menuItems = data ? mapMenuItems(data) : [];
		} catch (e) {
			console.warn('[Convex] Failed to map menu items:', e);
		}
	});
}

/**
 * Create or return the cached PlayStation Convex state.
 * Subscriptions persist across page navigations.
 * Must be called during component init (needs Svelte context for client).
 */
export function createPsConvexState(): PsConvexState {
	// Return cached singleton if already initialized
	if (cachedState) return cachedState;

	if (!browser) {
		// Return a dummy on SSR
		cachedState = createDummyState();
		return cachedState;
	}

	// Get the ConvexClient from Svelte context (set by setupConvex in layout)
	let client: ConvexClient;
	try {
		client = getContext<ConvexClient>('$$_convexClient');
		if (!client) throw new Error('No client');
	} catch {
		console.warn('[Convex] No ConvexClient in context');
		_hasError = true;
		cachedState = createDummyState();
		return cachedState;
	}

	// Initialize persistent subscriptions (only once, ever)
	initSubscriptions(client);

	// Build the state object with mutation helpers
	cachedState = buildState(client);
	return cachedState;
}

function createDummyState(): PsConvexState {
	return {
		get stationStatuses() { return undefined; },
		get analytics() { return undefined; },
		get menuItems() { return undefined; },
		get stations() { return undefined; },
		get isReady() { return false; },
		get hasError() { return _hasError; },
		get stationStatusesLoading() { return true; },
		get stationStatusesError() { return undefined; },
		get analyticsLoading() { return true; },
		get menuItemsLoading() { return true; },
		startSession: async () => null,
		endSession: async () => null,
		switchMode: async () => null,
		pauseSession: async () => null,
		resumeSession: async () => null,
		updateTimer: async () => null,
		updateStartTime: async () => null,
		addOrder: async () => null,
		addMultipleOrders: async () => false,
		removeOrder: async () => null,
		addCharge: async () => null,
		updateCharge: async () => null,
		deleteCharge: async () => null,
	};
}

function buildState(client: ConvexClient) {
	// Mutation helper
	async function runMutation<T>(
		mutationFn: any,
		args: any,
		successMessage?: string,
		errorMessage?: string
	): Promise<T | null> {
		try {
			const result = await client.mutation(mutationFn, args);
			if (successMessage) toast.success(successMessage);
			return result as T;
		} catch (error) {
			console.error('[Convex Mutation Error]', error);
			toast.error(errorMessage || 'حدث خطأ');
			return null;
		}
	}

	// Session mutations
	async function startSession(stationId: string, options?: { timerMinutes?: number; costLimitPiasters?: number; mode?: 'single' | 'multi' }) {
		return runMutation(api.psSessions.start, {
			stationId: stationId as any,
			timerMinutes: options?.timerMinutes,
			costLimitPiasters: options?.costLimitPiasters,
			mode: options?.mode,
			startedBy: 'manual' as const,
		}, 'تم بدء الجلسة', 'فشل في بدء الجلسة');
	}

	async function endSession(sessionId: string, totalCost: number) {
		return runMutation(api.psSessions.end, { id: sessionId as any, totalCost }, 'تم إنهاء الجلسة', 'فشل في إنهاء الجلسة');
	}

	async function switchMode(sessionId: string, newMode: 'single' | 'multi') {
		return runMutation(api.psSessions.switchMode, { id: sessionId as any, newMode },
			newMode === 'multi' ? 'تم التحويل لوضع متعدد' : 'تم التحويل لوضع فردي', 'فشل في تغيير الوضع');
	}

	async function pauseSession(sessionId: string) {
		return runMutation(api.psSessions.pause, { id: sessionId as any }, 'تم إيقاف الجلسة مؤقتاً', 'فشل في إيقاف الجلسة');
	}

	async function resumeSession(sessionId: string) {
		return runMutation(api.psSessions.resume, { id: sessionId as any }, 'تم استئناف الجلسة', 'فشل في استئناف الجلسة');
	}

	async function updateTimer(sessionId: string, timerMinutes?: number, timerNotified?: boolean) {
		return runMutation(api.psSessions.updateTimer, { id: sessionId as any, timerMinutes, timerNotified },
			timerMinutes ? 'تم تحديث المؤقت' : 'تم إلغاء المؤقت');
	}

	async function updateStartTime(sessionId: string, newStartTime: number) {
		return runMutation(api.psSessions.updateStartTime, { id: sessionId as any, newStartTime }, 'تم تحديث وقت البدء', 'فشل في تحديث وقت البدء');
	}

	// Order mutations
	async function addOrder(sessionId: string, menuItemId: string, quantity: number = 1) {
		return runMutation(api.psSessions.addOrder, { sessionId: sessionId as any, menuItemId: menuItemId as any, quantity }, 'تم إضافة الطلب', 'فشل في إضافة الطلب');
	}

	async function addMultipleOrders(sessionId: string, items: Array<{ menuItemId: string; quantity: number }>) {
		try {
			for (const item of items) {
				await client.mutation(api.psSessions.addOrder, {
					sessionId: sessionId as any,
					menuItemId: item.menuItemId as any,
					quantity: item.quantity,
				});
			}
			toast.success(`تم إضافة ${items.length} طلب`);
			return true;
		} catch (error) {
			console.error('[Add Orders Error]', error);
			toast.error('فشل في إضافة الطلبات');
			return false;
		}
	}

	async function removeOrder(orderId: string) {
		return runMutation(api.psSessions.removeOrder, { orderId: orderId as any }, 'تم حذف الطلب', 'فشل في حذف الطلب');
	}

	// Charge mutations
	async function addCharge(sessionId: string, amount: number, reason?: string) {
		return runMutation(api.psSessions.addCharge, { sessionId: sessionId as any, amount, reason }, 'تم إضافة الرسوم', 'فشل في إضافة الرسوم');
	}

	async function updateCharge(chargeId: string, amount: number, reason?: string) {
		return runMutation(api.psSessions.updateCharge, { chargeId: chargeId as any, amount, reason }, 'تم تحديث الرسوم', 'فشل في تحديث الرسوم');
	}

	async function deleteCharge(chargeId: string) {
		return runMutation(api.psSessions.deleteCharge, { chargeId: chargeId as any }, 'تم حذف الرسوم', 'فشل في حذف الرسوم');
	}

	return {
		get stationStatuses() { return _stationStatuses; },
		get analytics() { return _analytics; },
		get menuItems() { return _menuItems; },
		get stations() {
			return _stationStatuses?.map((s: StationStatus) => s.station);
		},
		get isReady() { return _isReady; },
		get hasError() { return _hasError; },
		get stationStatusesLoading() { return _stationStatuses === undefined; },
		get stationStatusesError() { return undefined; },
		get analyticsLoading() { return _analytics === undefined; },
		get menuItemsLoading() { return _menuItems === undefined; },

		startSession,
		endSession,
		switchMode,
		pauseSession,
		resumeSession,
		updateTimer,
		updateStartTime,
		addOrder,
		addMultipleOrders,
		removeOrder,
		addCharge,
		updateCharge,
		deleteCharge,
	};
}

export type PsConvexState = ReturnType<typeof buildState>;
