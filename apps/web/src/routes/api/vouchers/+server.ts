import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createVouchers, getVouchers, deleteVouchers } from '$lib/server/services/vouchers';

export const GET: RequestHandler = async () => {
  try {
    const vouchers = await getVouchers();
    return json(vouchers);
  } catch (error) {
    console.error('Get vouchers error:', error);
    return json({ error: 'Failed to fetch vouchers' }, { status: 500 });
  }
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

    const result = await createVouchers(packageId, quantity);
    return json(result, { status: 201 });
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

    const result = await deleteVouchers(ids);
    return json({ success: true, deleted: result.deleted });
  } catch (error) {
    console.error('Delete vouchers error:', error);
    return json({ error: 'Failed to delete vouchers' }, { status: 500 });
  }
};
