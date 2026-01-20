import type { Handle } from '@sveltejs/kit';
import { startBackgroundSync, shouldAutoStart } from '$lib/server/services/ps-background-sync';

// Initialize background services on server start
let initialized = false;

function initializeServices() {
  if (initialized) return;
  initialized = true;

  console.log('[Server] Initializing background services...');

  // Start PlayStation background sync if stations are configured
  if (shouldAutoStart()) {
    // Small delay to ensure database is ready
    setTimeout(() => {
      startBackgroundSync();
    }, 2000);
  } else {
    console.log('[Server] No PS stations configured, background sync will start when stations are added');
  }
}

export const handle: Handle = async ({ event, resolve }) => {
  // Initialize services on first request
  initializeServices();

  return resolve(event);
};
