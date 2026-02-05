import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  recordFnbSale,
  getFnbSales,
  getTodayFnbSales,
  getTodayFnbRevenue,
  getFnbSalesSummary
} from '$lib/server/services/fnb-sales';

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
      const sales = await getTodayFnbSales();
      const revenue = await getTodayFnbRevenue();

      return json({
        success: true,
        sales,
        summary: {
          totalRevenue: revenue,
          totalItems: sales.reduce((sum: number, s: { quantity: number }) => sum + s.quantity, 0)
        }
      });
    }

    const startDate = start ? parseInt(start, 10) : undefined;
    const endDate = end ? parseInt(end, 10) : undefined;

    const sales = getFnbSales({ startDate, endDate });

    // Get summary if date range provided
    let summary = null;
    if (startDate && endDate) {
      summary = getFnbSalesSummary(startDate, endDate);
    }

    return json({
      success: true,
      sales,
      summary
    });
  } catch (error) {
    console.error('Get F&B sales error:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch F&B sales'
    }, { status: 500 });
  }
};

/**
 * POST /api/fnb/sales - Record a new F&B sale
 * Body: { menuItemId: number, quantity?: number }
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const { menuItemId, quantity = 1 } = body;

    // Validation
    if (typeof menuItemId !== 'number' || menuItemId <= 0) {
      return json({ error: 'menuItemId must be a positive number' }, { status: 400 });
    }

    if (typeof quantity !== 'number' || quantity <= 0) {
      return json({ error: 'quantity must be a positive number' }, { status: 400 });
    }

    const sale = recordFnbSale(menuItemId, quantity);

    return json({
      success: true,
      sale
    }, { status: 201 });
  } catch (error) {
    console.error('Record F&B sale error:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to record F&B sale'
    }, { status: 500 });
  }
};
