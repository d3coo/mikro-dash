import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getVoucherById, deleteVoucher, extendVoucherTime } from '$lib/server/services/vouchers';

export const GET: RequestHandler = async ({ params }) => {
  try {
    const voucher = await getVoucherById(params.id);
    if (!voucher) {
      return json({ error: 'Voucher not found' }, { status: 404 });
    }
    return json(voucher);
  } catch (error) {
    console.error('Get voucher error:', error);
    return json({ error: 'Failed to fetch voucher' }, { status: 500 });
  }
};

export const DELETE: RequestHandler = async ({ params }) => {
  try {
    // Get voucher name before deleting (needed to delete usage history)
    const voucher = await getVoucherById(params.id);
    await deleteVoucher(params.id, voucher?.name);
    return json({ success: true });
  } catch (error) {
    console.error('Delete voucher error:', error);
    return json({ error: 'Failed to delete voucher' }, { status: 500 });
  }
};

export const PATCH: RequestHandler = async ({ params, request }) => {
  try {
    const body = await request.json();
    const { limitUptime } = body;

    if (!limitUptime) {
      return json({ error: 'limitUptime is required' }, { status: 400 });
    }

    // Validate format (e.g., "1d", "3d", "12h", "72h")
    if (!/^\d+[dhms]$/.test(limitUptime)) {
      return json({ error: 'Invalid time format. Use format like "3d", "72h", "30m"' }, { status: 400 });
    }

    await extendVoucherTime(params.id, limitUptime);
    return json({ success: true });
  } catch (error) {
    console.error('Extend voucher time error:', error);
    return json({ error: 'Failed to extend voucher time' }, { status: 500 });
  }
};
