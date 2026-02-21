/**
 * PlayStation State Management (Polling-based)
 *
 * Replaces Convex WebSocket subscriptions with SvelteKit API polling.
 * Polls station statuses every 2s, analytics every 10s, menu items once.
 * Mutations call POST /api/playstation/mutation.
 */

import { browser } from '$app/environment';
import { toast } from 'svelte-sonner';

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
		hasInternet?: boolean;
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

function mapStationStatus(status: any): StationStatus {
	const station = { ...status.station, id: status.station._id };
	const activeSession = status.activeSession ? { ...status.activeSession, id: status.activeSession._id } : null;
	const lastSession = status.lastSession ? { ...status.lastSession, id: status.lastSession._id } : null;
	const orders = (status.orders || []).map((o: any) => ({
		...o,
		id: o._id,
		menuItem: o.menuItem ? { ...o.menuItem, id: o.menuItem._id } : null,
	}));
	const charges = (status.charges || []).map((c: any) => ({ ...c, id: c._id }));
	const segments = (status.segments || []).map((s: any) => ({ ...s, id: s._id }));

	let costBreakdown: StationStatus['costBreakdown'] = null;
	if (activeSession && segments.length > 0) {
		const totalPausedMs = activeSession.totalPausedMs || 0;
		const currentlyPausedMs = activeSession.pausedAt ? (Date.now() - activeSession.pausedAt) : 0;
		const sessionPauseMs = totalPausedMs + currentlyPausedMs;

		const breakdown = segments.map((seg: any) => {
			let durationMs: number;
			if (seg.endedAt) {
				durationMs = seg.endedAt - seg.startedAt;
			} else {
				durationMs = Math.max(0, Date.now() - seg.startedAt - sessionPauseMs);
			}
			const minutes = Math.ceil(durationMs / (1000 * 60));
			return {
				mode: seg.mode || 'single',
				minutes,
				cost: Math.round((seg.hourlyRateSnapshot * minutes) / 60),
			};
		});
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
		isOnline: status.station.isOnline ?? false,
		isOfflineWithSession: !!(status.station.isOnline === false && status.activeSession),
		costBreakdown,
		lastSessionOrders: [],
		lastSessionCharges: [],
		lastSessionTransfers: [],
		lastSessionSegments: [],
	};
}

function mapMenuItems(items: any[]): MenuItem[] {
	return items.map(item => ({ ...item, id: item._id }));
}

// Extract number from station name for sorting
const arabicDigits: Record<string, string> = { '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9' };
function extractStationNumber(name: string): number {
	const western = name.match(/\d+/);
	if (western) return parseInt(western[0], 10);
	const arabic = name.match(/[٠-٩]+/);
	if (arabic) return parseInt(arabic[0].replace(/[٠-٩]/g, d => arabicDigits[d] || d), 10);
	return 999;
}

function sortStations(a: StationStatus, b: StationStatus): number {
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

// ============= Singleton State =============

let cachedState: PsConvexState | null = null;

// Module-level reactive state (Svelte 5 runes)
let _stationStatuses = $state<StationStatus[] | undefined>(undefined);
let _analytics = $state<AnalyticsSummary | undefined>(undefined);
let _menuItems = $state<MenuItem[] | undefined>(undefined);
let _isReady = $state(false);
let _hasError = $state(false);

let pollingActive = false;
let statusInterval: ReturnType<typeof setInterval> | null = null;
let analyticsInterval: ReturnType<typeof setInterval> | null = null;

async function fetchState(include: string) {
	try {
		const res = await fetch(`/api/playstation/state?include=${include}`);
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		return await res.json();
	} catch (e) {
		console.warn(`[PS State] Failed to fetch (${include}):`, e);
		return null;
	}
}

function startPolling() {
	if (pollingActive) return;
	pollingActive = true;

	// Initial fetch
	fetchState('all').then(data => {
		if (!data) { _hasError = true; return; }
		if (data.stationStatuses) {
			_stationStatuses = data.stationStatuses.map(mapStationStatus).sort(sortStations);
		}
		if (data.analytics) {
			_analytics = data.analytics as AnalyticsSummary;
		}
		if (data.menuItems) {
			_menuItems = data.menuItems ? mapMenuItems(data.menuItems) : [];
		}
		_isReady = true;
	});

	// Poll statuses every 2s
	statusInterval = setInterval(async () => {
		const data = await fetchState('statuses');
		if (data?.stationStatuses) {
			_stationStatuses = data.stationStatuses.map(mapStationStatus).sort(sortStations);
			_isReady = true;
		}
	}, 2000);

	// Poll analytics every 10s
	analyticsInterval = setInterval(async () => {
		const data = await fetchState('analytics');
		if (data?.analytics) {
			_analytics = data.analytics as AnalyticsSummary;
		}
	}, 10000);
}

async function runMutation(action: string, args: any, successMessage?: string, errorMessage?: string): Promise<any> {
	try {
		const res = await fetch('/api/playstation/mutation', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action, args }),
		});
		const data = await res.json();
		if (!data.success) throw new Error(data.error || 'Mutation failed');
		if (successMessage) toast.success(successMessage);

		// Trigger immediate refresh after mutation
		const stateData = await fetchState('statuses');
		if (stateData?.stationStatuses) {
			_stationStatuses = stateData.stationStatuses.map(mapStationStatus).sort(sortStations);
		}

		return data.result;
	} catch (error) {
		console.error('[PS Mutation Error]', error);
		toast.error(errorMessage || 'حدث خطأ');
		return null;
	}
}

/**
 * Create or return the cached PlayStation state.
 * Polling persists across page navigations.
 */
export function createPsConvexState(): PsConvexState {
	if (cachedState) return cachedState;

	if (!browser) {
		cachedState = createDummyState();
		return cachedState;
	}

	// Start polling
	startPolling();

	cachedState = buildState();
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

function buildState() {
	async function startSession(stationId: string, options?: { timerMinutes?: number; costLimitPiasters?: number; mode?: 'single' | 'multi' }) {
		return runMutation('startSession', {
			stationId,
			timerMinutes: options?.timerMinutes,
			costLimitPiasters: options?.costLimitPiasters,
			startedBy: 'manual',
		}, 'تم بدء الجلسة', 'فشل في بدء الجلسة');
	}

	async function endSession(sessionId: string, customTotalCost?: number) {
		return runMutation('endSession', { id: sessionId, customTotalCost }, 'تم إنهاء الجلسة', 'فشل في إنهاء الجلسة');
	}

	async function switchMode(sessionId: string, newMode: 'single' | 'multi') {
		return runMutation('switchMode', { id: sessionId, newMode },
			newMode === 'multi' ? 'تم التحويل لوضع متعدد' : 'تم التحويل لوضع فردي', 'فشل في تغيير الوضع');
	}

	async function pauseSession(sessionId: string) {
		return runMutation('pauseSession', { id: sessionId, source: 'ui-manual' }, 'تم إيقاف الجلسة مؤقتاً', 'فشل في إيقاف الجلسة');
	}

	async function resumeSession(sessionId: string) {
		return runMutation('resumeSession', { id: sessionId }, 'تم استئناف الجلسة', 'فشل في استئناف الجلسة');
	}

	async function updateTimer(sessionId: string, timerMinutes?: number, timerNotified?: boolean) {
		return runMutation('updateTimer', { id: sessionId, timerMinutes, timerNotified },
			timerMinutes ? 'تم تحديث المؤقت' : 'تم إلغاء المؤقت');
	}

	async function updateStartTime(sessionId: string, newStartTime: number) {
		return runMutation('updateStartTime', { id: sessionId, newStartTime }, 'تم تحديث وقت البدء', 'فشل في تحديث وقت البدء');
	}

	async function addOrder(sessionId: string, menuItemId: string, quantity: number = 1) {
		return runMutation('addOrder', { sessionId, menuItemId, quantity }, 'تم إضافة الطلب', 'فشل في إضافة الطلب');
	}

	async function addMultipleOrders(sessionId: string, items: Array<{ menuItemId: string; quantity: number }>) {
		try {
			for (const item of items) {
				await runMutation('addOrder', {
					sessionId,
					menuItemId: item.menuItemId,
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
		return runMutation('removeOrder', { orderId }, 'تم حذف الطلب', 'فشل في حذف الطلب');
	}

	async function addCharge(sessionId: string, amount: number, reason?: string) {
		return runMutation('addCharge', { sessionId, amount, reason }, 'تم إضافة الرسوم', 'فشل في إضافة الرسوم');
	}

	async function updateCharge(chargeId: string, amount: number, reason?: string) {
		return runMutation('updateCharge', { chargeId, amount, reason }, 'تم تحديث الرسوم', 'فشل في تحديث الرسوم');
	}

	async function deleteCharge(chargeId: string) {
		return runMutation('deleteCharge', { chargeId }, 'تم حذف الرسوم', 'فشل في حذف الرسوم');
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
