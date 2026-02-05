/**
 * Convex helpers for Svelte components
 * Provides reactive queries and mutations with offline support
 */

import { browser } from '$app/environment';
import { get, writable, type Readable, type Writable } from 'svelte/store';
import { connectionStatus } from './stores/connection';
import { queueOfflineWrite } from './offline';

// Dynamic import to avoid SSR issues
let convexClient: any = null;
let convexApi: any = null;

async function getConvex() {
	if (!convexClient) {
		const { convex } = await import('./convex');
		const { api } = await import('../../convex/_generated/api');
		convexClient = convex;
		convexApi = api;
	}
	return { client: convexClient, api: convexApi };
}

// Get the API object
export async function getApi() {
	const { api } = await getConvex();
	return api;
}

// Get the client
export async function getClient() {
	const { client } = await getConvex();
	return client;
}

/**
 * Create a reactive Convex query that updates in real-time
 * Returns a Svelte store that can be used with $
 */
export function createQuery<T>(
	queryFn: () => Promise<{ fn: any; args: Record<string, any> }>
): Readable<{ data: T | null; loading: boolean; error: Error | null }> {
	const store = writable<{ data: T | null; loading: boolean; error: Error | null }>({
		data: null,
		loading: true,
		error: null
	});

	if (!browser) {
		return store;
	}

	let unsubscribe: (() => void) | null = null;

	// Set up the subscription
	(async () => {
		try {
			const { client } = await getConvex();
			const { fn, args } = await queryFn();

			unsubscribe = client.onUpdate(fn, args, (result: T) => {
				store.set({ data: result, loading: false, error: null });
			});
		} catch (error) {
			store.set({
				data: null,
				loading: false,
				error: error instanceof Error ? error : new Error('Query failed')
			});
		}
	})();

	// Return a custom store that cleans up on unsubscribe
	return {
		subscribe: (run, invalidate) => {
			const unsub = store.subscribe(run, invalidate);
			return () => {
				unsub();
				if (unsubscribe) {
					unsubscribe();
				}
			};
		}
	};
}

/**
 * Execute a Convex mutation with offline support
 * If offline, queues the mutation for later sync
 */
export async function executeMutation<T>(
	mutationPath: string,
	args: Record<string, any>,
	options?: {
		localId?: string;
		offlineSupported?: boolean;
	}
): Promise<T | null> {
	if (!browser) {
		throw new Error('Mutations can only be executed in the browser');
	}

	const isOffline = get(connectionStatus) === 'offline';

	if (isOffline && options?.offlineSupported) {
		// Queue for later sync
		await queueOfflineWrite(mutationPath, args, options.localId);
		return null;
	}

	try {
		const { client, api } = await getConvex();

		// Navigate to the mutation function
		const parts = mutationPath.split('.');
		let fn = api;
		for (const part of parts) {
			fn = fn?.[part];
		}

		if (!fn) {
			throw new Error(`Mutation not found: ${mutationPath}`);
		}

		return await client.mutation(fn, args);
	} catch (error) {
		// If network error and offline support is enabled, queue it
		if (options?.offlineSupported && isNetworkError(error)) {
			connectionStatus.set('offline');
			await queueOfflineWrite(mutationPath, args, options.localId);
			return null;
		}
		throw error;
	}
}

/**
 * Execute a one-time Convex query (not reactive)
 */
export async function executeQuery<T>(
	queryPath: string,
	args: Record<string, any> = {}
): Promise<T> {
	if (!browser) {
		throw new Error('Queries can only be executed in the browser');
	}

	const { client, api } = await getConvex();

	// Navigate to the query function
	const parts = queryPath.split('.');
	let fn = api;
	for (const part of parts) {
		fn = fn?.[part];
	}

	if (!fn) {
		throw new Error(`Query not found: ${queryPath}`);
	}

	return await client.query(fn, args);
}

function isNetworkError(error: unknown): boolean {
	if (error instanceof Error) {
		return (
			error.message.includes('network') ||
			error.message.includes('fetch') ||
			error.message.includes('offline') ||
			error.name === 'NetworkError'
		);
	}
	return false;
}
