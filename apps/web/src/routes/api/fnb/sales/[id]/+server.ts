import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deleteFnbSale, getFnbSaleById } from '$lib/server/services/fnb-sales';

/**
 * GET /api/fnb/sales/[id] - Get a specific F&B sale
 */
export const GET: RequestHandler = async ({ params }) => {
  try {
    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
      return json({ error: 'Invalid sale ID' }, { status: 400 });
    }

    const sale = getFnbSaleById(id);
    if (!sale) {
      return json({ error: 'Sale not found' }, { status: 404 });
    }

    return json({
      success: true,
      sale
    });
  } catch (error) {
    console.error('Get F&B sale error:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch F&B sale'
    }, { status: 500 });
  }
};

/**
 * DELETE /api/fnb/sales/[id] - Delete a F&B sale
 */
export const DELETE: RequestHandler = async ({ params }) => {
  try {
    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
      return json({ error: 'Invalid sale ID' }, { status: 400 });
    }

    deleteFnbSale(id);

    return json({
      success: true,
      message: 'Sale deleted successfully'
    });
  } catch (error) {
    console.error('Delete F&B sale error:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete F&B sale'
    }, { status: 500 });
  }
};
