/**
 * Convex client setup
 * Provides the ConvexClient instance for use in the app
 */

import { ConvexClient } from 'convex/browser';
import { PUBLIC_CONVEX_URL } from '$env/static/public';

if (!PUBLIC_CONVEX_URL) {
	throw new Error('PUBLIC_CONVEX_URL environment variable is not set');
}

export const convex = new ConvexClient(PUBLIC_CONVEX_URL);
