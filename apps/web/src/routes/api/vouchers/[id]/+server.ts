import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getVoucherById, deleteVoucher } from '$lib/server/services/vouchers';

export const GET: RequestHandler = async ({ params }) => {
  const voucher = getVoucherById(params.id);
  if (!voucher) {
    return json({ error: 'Voucher not found' }, { status: 404 });
  }
  return json(voucher);
};

export const DELETE: RequestHandler = async ({ params }) => {
  try {
    await deleteVoucher(params.id);
    return json({ success: true });
  } catch (error) {
    console.error('Delete voucher error:', error);
    return json({ error: 'Failed to delete voucher' }, { status: 500 });
  }
};
