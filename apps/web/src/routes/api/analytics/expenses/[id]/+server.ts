import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getExpenseById, updateExpense, deleteExpense, type ExpenseCategory } from '$lib/server/services/analytics';

/**
 * GET /api/analytics/expenses/[id] - Get single expense
 */
export const GET: RequestHandler = async ({ params }) => {
  try {
    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
      return json({ error: 'Invalid expense ID' }, { status: 400 });
    }

    const expense = await getExpenseById(id);
    if (!expense) {
      return json({ error: 'Expense not found' }, { status: 404 });
    }

    return json({
      success: true,
      expense
    });
  } catch (error) {
    console.error('Get expense error:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch expense'
    }, { status: 500 });
  }
};

/**
 * PUT /api/analytics/expenses/[id] - Update expense
 * Body: { name?: string, nameAr?: string, amount?: number, category?: string, isActive?: boolean }
 */
export const PUT: RequestHandler = async ({ params, request }) => {
  try {
    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
      return json({ error: 'Invalid expense ID' }, { status: 400 });
    }

    const existing = await getExpenseById(id);
    if (!existing) {
      return json({ error: 'Expense not found' }, { status: 404 });
    }

    const body = await request.json();

    // Validate category if provided
    const validCategories = ['wifi', 'playstation', 'fnb', 'general'];
    if (body.category && !validCategories.includes(body.category)) {
      return json({ error: 'Invalid category. Use: wifi, playstation, fnb, or general' }, { status: 400 });
    }

    const updates: Partial<{ name: string; nameAr: string; amount: number; category: ExpenseCategory; isActive: number }> = {};

    if (body.name !== undefined) updates.name = body.name;
    if (body.nameAr !== undefined) updates.nameAr = body.nameAr;
    if (body.amount !== undefined) updates.amount = Math.round(body.amount);
    if (body.category !== undefined) updates.category = body.category as ExpenseCategory;
    if (body.isActive !== undefined) updates.isActive = body.isActive ? 1 : 0;

    const expense = await updateExpense(id, updates);

    return json({
      success: true,
      expense
    });
  } catch (error) {
    console.error('Update expense error:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update expense'
    }, { status: 500 });
  }
};

/**
 * DELETE /api/analytics/expenses/[id] - Delete expense
 */
export const DELETE: RequestHandler = async ({ params }) => {
  try {
    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
      return json({ error: 'Invalid expense ID' }, { status: 400 });
    }

    const existing = await getExpenseById(id);
    if (!existing) {
      return json({ error: 'Expense not found' }, { status: 404 });
    }

    await deleteExpense(id);

    return json({
      success: true,
      deleted: id
    });
  } catch (error) {
    console.error('Delete expense error:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete expense'
    }, { status: 500 });
  }
};
