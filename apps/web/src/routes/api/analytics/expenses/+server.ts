import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getExpenses, createExpense, getCostPerGb, getMonthlyFixedCosts } from '$lib/server/services/analytics';

/**
 * GET /api/analytics/expenses - List all expenses
 */
export const GET: RequestHandler = async () => {
  try {
    const expensesList = getExpenses();
    const costPerGb = getCostPerGb();
    const monthlyFixed = getMonthlyFixedCosts();

    return json({
      success: true,
      expenses: expensesList,
      summary: {
        costPerGb,
        monthlyFixed
      }
    });
  } catch (error) {
    console.error('Get expenses error:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch expenses'
    }, { status: 500 });
  }
};

/**
 * POST /api/analytics/expenses - Create new expense
 * Body: { type: 'per_gb' | 'fixed_monthly', name: string, nameAr: string, amount: number }
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const { type, name, nameAr, amount } = body;

    // Validation
    if (!type || !['per_gb', 'fixed_monthly'].includes(type)) {
      return json({ error: 'Invalid type. Use: per_gb or fixed_monthly' }, { status: 400 });
    }

    if (!name || typeof name !== 'string') {
      return json({ error: 'name is required' }, { status: 400 });
    }

    if (!nameAr || typeof nameAr !== 'string') {
      return json({ error: 'nameAr is required' }, { status: 400 });
    }

    if (typeof amount !== 'number' || amount < 0) {
      return json({ error: 'amount must be a positive number' }, { status: 400 });
    }

    const expense = createExpense({
      type,
      name,
      nameAr,
      amount: Math.round(amount) // Ensure integer (piasters)
    });

    return json({
      success: true,
      expense
    }, { status: 201 });
  } catch (error) {
    console.error('Create expense error:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create expense'
    }, { status: 500 });
  }
};
