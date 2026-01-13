import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createVouchers, getVouchers, deleteVouchers } from '$lib/server/services/vouchers';

export const GET: RequestHandler = async ({ url }) => {
  const status = url.searchParams.get('status') ?? undefined;
  const vouchers = getVouchers(status);
  return json(vouchers);
};

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { packageId, quantity } = await request.json();

    if (!packageId || !quantity) {
      return json({ error: 'packageId and quantity required' }, { status: 400 });
    }

    if (quantity < 1 || quantity > 100) {
      return json({ error: 'quantity must be 1-100' }, { status: 400 });
    }

    const vouchers = await createVouchers(packageId, quantity);
    return json(vouchers, { status: 201 });
  } catch (error) {
    console.error('Create vouchers error:', error);
    return json({ error: 'Failed to create vouchers' }, { status: 500 });
  }
};

export const DELETE: RequestHandler = async ({ request }) => {
  try {
    const { ids } = await request.json();

    if (!ids || !Array.isArray(ids)) {
      return json({ error: 'ids array required' }, { status: 400 });
    }

    await deleteVouchers(ids);
    return json({ success: true });
  } catch (error) {
    console.error('Delete vouchers error:', error);
    return json({ error: 'Failed to delete vouchers' }, { status: 500 });
  }
};
