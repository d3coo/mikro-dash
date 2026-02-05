import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { markVouchersAsPrinted, getAllPrintedVoucherCodes } from '$lib/server/services/print-tracking';
import { getVouchers } from '$lib/server/services/vouchers';

/**
 * POST /api/vouchers/print
 * Mark vouchers as printed
 * Body: { codes: string[] } or { markAll: true } or { markAllExisting: true }
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const { codes, markAll, markAllExisting } = body;

    if (markAllExisting === true) {
      // Mark ALL existing vouchers as printed (regardless of status)
      const vouchers = await getVouchers();
      const allCodes = vouchers.map(v => v.name);
      await markVouchersAsPrinted(allCodes);
      return json({ success: true, marked: allCodes.length });
    }

    if (markAll === true) {
      // Mark all available vouchers as printed
      const vouchers = await getVouchers();
      const availableCodes = vouchers
        .filter(v => v.status === 'available')
        .map(v => v.name);
      await markVouchersAsPrinted(availableCodes);
      return json({ success: true, marked: availableCodes.length });
    }

    if (!codes || !Array.isArray(codes) || codes.length === 0) {
      return json({ error: 'codes array is required' }, { status: 400 });
    }

    await markVouchersAsPrinted(codes);
    return json({ success: true, marked: codes.length });
  } catch (error) {
    console.error('Mark printed error:', error);
    return json({ error: 'Failed to mark vouchers as printed' }, { status: 500 });
  }
};

/**
 * GET /api/vouchers/print
 * Get all printed voucher codes
 */
export const GET: RequestHandler = async () => {
  try {
    const printedCodes = await getAllPrintedVoucherCodes();
    return json({ codes: Array.from(printedCodes) });
  } catch (error) {
    console.error('Get printed vouchers error:', error);
    return json({ error: 'Failed to get printed vouchers' }, { status: 500 });
  }
};
