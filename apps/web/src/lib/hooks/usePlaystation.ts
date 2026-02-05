/**
 * PlayStation page hooks with Convex cached queries
 *
 * Uses convex-svelte's useQuery for real-time updates with automatic caching.
 * When offline, cached data is automatically used.
 *
 * Mutations use the Convex client directly.
 */

import { useQuery, useConvexClient } from 'convex-svelte';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';

// Re-export types
export type { Id };

// ============= QUERIES (with real-time & caching) =============

/**
 * Get station statuses with real-time updates
 * This query is automatically cached by Convex
 */
export function useStationStatuses() {
	return useQuery(api.psSessions.getStationStatuses, {});
}

/**
 * Get today's PS analytics with real-time updates
 */
export function useTodayAnalytics() {
	return useQuery(api.psSessions.getTodayAnalytics, {});
}

/**
 * Get all menu items
 */
export function useMenuItems() {
	return useQuery(api.psMenuItems.list, {});
}

/**
 * Get all stations
 */
export function useStations() {
	return useQuery(api.psStations.list, {});
}

// ============= MUTATION HELPERS =============

/**
 * Get the Convex client for mutations
 * Usage: const client = useConvexClient(); client.mutation(api.psSessions.start, {...})
 */
export { useConvexClient };

/**
 * Helper type for PlayStation mutations
 */
export const psMutations = {
	// Sessions
	startSession: api.psSessions.start,
	endSession: api.psSessions.end,
	switchMode: api.psSessions.switchMode,
	pauseSession: api.psSessions.pause,
	resumeSession: api.psSessions.resume,
	updateTimer: api.psSessions.updateTimer,
	updateStartTime: api.psSessions.updateStartTime,

	// Orders
	addOrder: api.psSessions.addOrder,
	removeOrder: api.psSessions.removeOrder,

	// Charges
	addCharge: api.psSessions.addCharge,
	updateCharge: api.psSessions.updateCharge,
	deleteCharge: api.psSessions.deleteCharge,

	// Stations
	createStation: api.psStations.create,
	updateStation: api.psStations.update,
	deleteStation: api.psStations.remove,

	// Menu Items
	createMenuItem: api.psMenuItems.create,
	updateMenuItem: api.psMenuItems.update,
	deleteMenuItem: api.psMenuItems.remove,
	toggleMenuItem: api.psMenuItems.toggleAvailable,
} as const;

// ============= TYPES FOR COMPONENT USE =============

import type { FunctionReturnType } from 'convex/server';

/**
 * Type for station status from getStationStatuses query
 */
export type StationStatusArray = FunctionReturnType<typeof api.psSessions.getStationStatuses>;
export type StationStatus = StationStatusArray[number];
