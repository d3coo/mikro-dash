import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  recordFnbSale,
  getTodayFnbSalesWithItems,
  getFnbSales,
} from '$lib/server/convex';

/**
 * GET /api/fnb/sales - List F&B sales
 * Query params:
 *   - start: Start timestamp (optional)
 *   - end: End timestamp (optional)
 *   - today: If 'true', get today's sales only
 */
export const GET: RequestHandler = async ({ url }) => {
  try {
    const today = url.searchParams.get('today');
    const start = url.searchParams.get('start');
    const end = url.searchParams.get('end');

    if (today === 'true') {
      const sales = await getTodayFnbSalesWithItems();
      const revenue = sales.reduce((sum: number, s) => sum + s.priceSnapshot * s.quantity, 0);

      return json({
        success: true,
        sales,
        summary: {
          totalRevenue: revenue,
          totalItems: sales.reduce((sum: number, s) => sum + s.quantity, 0),
        },
      });
    }

    const startDate = start ? parseInt(start, 10) : undefined;
    const endDate = end ? parseInt(end, 10) : undefined;

    const sales = await getFnbSales({ startDate, endDate });

    return json({
      success: true,
      sales,
    });
  } catch (error) {
    console.error('Get F&B sales error:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch F&B sales',
    }, { status: 500 });
  }
};

/**
 * POST /api/fnb/sales - Record a new F&B sale
 * Body: { menuItemId: string, quantity?: number }
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const { menuItemId, quantity = 1 } = body;

    if (!menuItemId || typeof menuItemId !== 'string') {
      return json({ error: 'menuItemId is required' }, { status: 400 });
    }

    if (typeof quantity !== 'number' || quantity <= 0) {
      return json({ error: 'quantity must be a positive number' }, { status: 400 });
    }

    const saleId = await recordFnbSale(menuItemId, quantity);

    return json({
      success: true,
      saleId,
    }, { status: 201 });
  } catch (error) {
    console.error('Record F&B sale error:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to record F&B sale',
    }, { status: 500 });
  }
};
