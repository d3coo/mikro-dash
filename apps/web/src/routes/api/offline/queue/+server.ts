import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Offline queue is no longer needed with Convex (built-in offline support)
export const POST: RequestHandler = async () => {
  return json({ success: true, message: 'Offline queue deprecated - Convex handles sync automatically' });
};
export const GET: RequestHandler = async () => {
  return json([]);
};
export const DELETE: RequestHandler = async () => {
  return json({ success: true });
};
export const PATCH: RequestHandler = async () => {
  return json({ success: true });
};
