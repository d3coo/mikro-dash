import type { Handle } from '@sveltejs/kit';
import { startBackgroundSync, shouldAutoStart } from '$lib/server/services/ps-background-sync';

// Initialize background services on server start
let initialized = false;

async function initializeServices() {
  if (initialized) return;
  initialized = true;

  // Don't block server startup - fire and forget
  // Delay 10s so the server can start serving pages first
  setTimeout(async () => {
    try {
      if (await shouldAutoStart()) {
        console.log('[Server] Starting PS background sync...');
        startBackgroundSync();
      } else {
        console.log('[Server] No PS stations configured, skipping background sync');
      }
    } catch (err) {
      console.error('[Server] Failed to initialize background services:', err);
    }
  }, 10_000);
}

export const handle: Handle = async ({ event, resolve }) => {
  // Initialize services on first request (non-blocking)
  initializeServices();

  return resolve(event);
};
