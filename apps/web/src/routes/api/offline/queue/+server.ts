import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { pendingWrites } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

// POST - Add a write to the queue
export const POST: RequestHandler = async ({ request }) => {
  const write = await request.json();

  const result = await db.insert(pendingWrites).values({
    mutation: write.mutation,
    args: JSON.stringify(write.args),
    localId: write.localId,
    createdAt: write.createdAt || Date.now(),
    status: 'pending',
  }).returning();

  return json({ success: true, id: result[0].id });
};

// GET - Get all pending writes
export const GET: RequestHandler = async () => {
  const writes = await db
    .select()
    .from(pendingWrites)
    .where(eq(pendingWrites.status, 'pending'))
    .orderBy(pendingWrites.createdAt);

  return json(writes.map((w) => ({
    ...w,
    args: JSON.parse(w.args),
  })));
};

// DELETE - Remove a write from the queue (after successful sync)
export const DELETE: RequestHandler = async ({ url }) => {
  const id = url.searchParams.get('id');
  if (!id) {
    return json({ error: 'Missing id parameter' }, { status: 400 });
  }

  await db.delete(pendingWrites).where(eq(pendingWrites.id, parseInt(id, 10)));
  return json({ success: true });
};

// PATCH - Update write status (for marking failed)
export const PATCH: RequestHandler = async ({ request, url }) => {
  const id = url.searchParams.get('id');
  if (!id) {
    return json({ error: 'Missing id parameter' }, { status: 400 });
  }

  const updates = await request.json();

  await db.update(pendingWrites)
    .set({
      status: updates.status,
      error: updates.error,
      retryCount: updates.retryCount,
    })
    .where(eq(pendingWrites.id, parseInt(id, 10)));

  return json({ success: true });
};
