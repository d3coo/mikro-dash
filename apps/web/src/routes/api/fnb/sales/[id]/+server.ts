import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deleteFnbSale } from '$lib/server/convex';

/**
 * DELETE /api/fnb/sales/[id] - Delete a F&B sale
 */
export const DELETE: RequestHandler = async ({ params }) => {
  try {
    const id = params.id;
    if (!id) {
      return json({ error: 'Invalid sale ID' }, { status: 400 });
    }

    await deleteFnbSale(id);

    return json({
      success: true,
      message: 'Sale deleted successfully',
    });
  } catch (error) {
    console.error('Delete F&B sale error:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete F&B sale',
    }, { status: 500 });
  }
};
