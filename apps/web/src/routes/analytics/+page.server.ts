import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import {
  getAnalyticsData,
  getExpenses,
  getCostPerGb,
  getMonthlyFixedCosts,
  createExpense,
  updateExpense,
  deleteExpense
} from '$lib/server/services/analytics';
import { getPackages } from '$lib/server/config';

export const load: PageServerLoad = async ({ url }) => {
  const period = (url.searchParams.get('period') || 'today') as 'today' | 'week' | 'month';

  try {
    const analyticsData = await getAnalyticsData(period);
    const expensesList = getExpenses();
    const packages = getPackages();

    return {
      period,
      ...analyticsData,
      expenses: expensesList,
      costPerGb: getCostPerGb(),
      monthlyFixed: getMonthlyFixedCosts(),
      packages
    };
  } catch (error) {
    console.error('Analytics load error:', error);
    return {
      period,
      summary: {
        period,
        vouchersSold: 0,
        revenue: 0,
        dataSoldGB: 0,
        dataUsedGB: 0,
        grossProfit: 0,
        netProfit: 0,
        salesByPackage: {}
      },
      charts: {
        revenue: [],
        profit: [],
        salesByPackage: [],
        dataUsage: []
      },
      expenses: [],
      costPerGb: 0,
      monthlyFixed: 0,
      packages: [],
      error: 'فشل في تحميل البيانات'
    };
  }
};

export const actions: Actions = {
  addExpense: async ({ request }) => {
    const formData = await request.formData();
    const type = formData.get('type') as 'per_gb' | 'fixed_monthly';
    const name = formData.get('name') as string;
    const nameAr = formData.get('nameAr') as string;
    const amount = parseFloat(formData.get('amount') as string);

    if (!type || !['per_gb', 'fixed_monthly'].includes(type)) {
      return fail(400, { error: 'نوع المصروف غير صالح' });
    }

    if (!name || !nameAr) {
      return fail(400, { error: 'الاسم مطلوب' });
    }

    if (isNaN(amount) || amount < 0) {
      return fail(400, { error: 'المبلغ غير صالح' });
    }

    try {
      // Convert EGP to piasters (multiply by 100)
      createExpense({ type, name, nameAr, amount: Math.round(amount * 100) });
      return { success: true, message: 'تم إضافة المصروف بنجاح' };
    } catch (error) {
      console.error('Add expense error:', error);
      return fail(500, { error: 'فشل في إضافة المصروف' });
    }
  },

  updateExpense: async ({ request }) => {
    const formData = await request.formData();
    const id = parseInt(formData.get('id') as string, 10);
    const amount = parseFloat(formData.get('amount') as string);
    const isActive = formData.get('isActive') === 'true';

    if (isNaN(id)) {
      return fail(400, { error: 'معرف المصروف غير صالح' });
    }

    try {
      const updates: Partial<{ amount: number; isActive: number }> = {};
      if (!isNaN(amount)) {
        updates.amount = Math.round(amount * 100); // Convert to piasters
      }
      updates.isActive = isActive ? 1 : 0;

      updateExpense(id, updates);
      return { success: true, message: 'تم تحديث المصروف بنجاح' };
    } catch (error) {
      console.error('Update expense error:', error);
      return fail(500, { error: 'فشل في تحديث المصروف' });
    }
  },

  deleteExpense: async ({ request }) => {
    const formData = await request.formData();
    const id = parseInt(formData.get('id') as string, 10);

    if (isNaN(id)) {
      return fail(400, { error: 'معرف المصروف غير صالح' });
    }

    try {
      deleteExpense(id);
      return { success: true, message: 'تم حذف المصروف بنجاح' };
    } catch (error) {
      console.error('Delete expense error:', error);
      return fail(500, { error: 'فشل في حذف المصروف' });
    }
  }
};
