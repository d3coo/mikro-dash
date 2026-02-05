import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  getExpenses,
  getExpensesByCategory,
  createExpense,
  getCostPerGb,
  getMonthlyFixedCosts,
  type ExpenseCategory
} from '$lib/server/services/analytics';

/**
 * GET /api/analytics/expenses - List expenses
 * Query params:
 *   - category: 'wifi' | 'playstation' | 'fnb' | 'general' (optional)
 */
export const GET: RequestHandler = async ({ url }) => {
  try {
    const categoryParam = url.searchParams.get('category');

    // Validate category if provided
    const validCategories = ['wifi', 'playstation', 'fnb', 'general'];
    if (categoryParam && !validCategories.includes(categoryParam)) {
      return json({
        success: false,
        error: 'Invalid category. Use: wifi, playstation, fnb, or general'
      }, { status: 400 });
    }

    const category = categoryParam as ExpenseCategory | undefined;
    const expensesList = category ? await getExpensesByCategory(category) : await getExpenses();
    const costPerGb = await getCostPerGb();
    const monthlyFixed = await getMonthlyFixedCosts();

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
 * Body: { type: 'per_gb' | 'fixed_monthly', category?: 'wifi' | 'playstation' | 'fnb' | 'general', name: string, nameAr: string, amount: number }
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const { type, category, name, nameAr, amount } = body;

    // Validation
    if (!type || !['per_gb', 'fixed_monthly'].includes(type)) {
      return json({ error: 'Invalid type. Use: per_gb or fixed_monthly' }, { status: 400 });
    }

    const validCategories = ['wifi', 'playstation', 'fnb', 'general'];
    if (category && !validCategories.includes(category)) {
      return json({ error: 'Invalid category. Use: wifi, playstation, fnb, or general' }, { status: 400 });
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

    const expense = await createExpense({
      type,
      category: category as ExpenseCategory,
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
