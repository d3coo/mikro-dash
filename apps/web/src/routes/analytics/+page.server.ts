import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import {
  getAnalyticsData,
  getExpenses,
  getCostPerGb,
  getMonthlyFixedCosts,
  createExpense,
  updateExpense,
  deleteExpense,
  type ExpenseCategory
} from '$lib/server/services/analytics';
import {
  getUnifiedAnalytics,
  getRevenueBySegmentChart,
  getProfitBySegmentChart,
  type TimePeriod
} from '$lib/server/services/unified-analytics';
import { getPackages } from '$lib/server/config';

export const load: PageServerLoad = async ({ url }) => {
  const periodParam = url.searchParams.get('period') || 'today';
  const startDate = url.searchParams.get('start');
  const endDate = url.searchParams.get('end');
  const categoryFilter = url.searchParams.get('category') as ExpenseCategory | null;

  // Validate period
  const validPeriods = ['today', 'week', 'month', 'custom'];
  const period = validPeriods.includes(periodParam) ? periodParam as TimePeriod : 'today';

  try {
    // Get custom range if provided
    const customRange = period === 'custom' && startDate && endDate
      ? { start: startDate, end: endDate }
      : undefined;

    // Fetch all data in parallel
    const chartDays = period === 'month' ? 30 : period === 'week' ? 7 : 7;
    const legacyPeriod = period === 'custom' ? 'month' : period;

    const [unifiedAnalytics, revenueBySegment, profitBySegment, analyticsData, expensesList, packages] = await Promise.all([
      getUnifiedAnalytics(period, customRange),
      getRevenueBySegmentChart(chartDays),
      getProfitBySegmentChart(chartDays),
      getAnalyticsData(legacyPeriod),
      getExpenses(),
      getPackages()
    ]);

    const filteredExpenses = categoryFilter
      ? expensesList.filter(e => e.category === categoryFilter)
      : expensesList;

    return {
      period,
      startDate: customRange?.start || null,
      endDate: customRange?.end || null,
      categoryFilter,
      // Unified analytics
      unified: unifiedAnalytics,
      // Segment charts
      segmentCharts: {
        revenue: revenueBySegment,
        profit: profitBySegment
      },
      // Legacy data for backward compatibility
      ...analyticsData,
      expenses: filteredExpenses,
      allExpenses: expensesList,
      costPerGb: await getCostPerGb(),
      monthlyFixed: await getMonthlyFixedCosts(),
      packages
    };
  } catch (error) {
    console.error('Analytics load error:', error);
    return {
      period,
      startDate: null,
      endDate: null,
      categoryFilter: null,
      unified: null,
      segmentCharts: { revenue: [], profit: [] },
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
      allExpenses: [],
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
    const category = formData.get('category') as ExpenseCategory | null;
    const name = formData.get('name') as string;
    const nameAr = formData.get('nameAr') as string;
    const amount = parseFloat(formData.get('amount') as string);

    if (!type || !['per_gb', 'fixed_monthly'].includes(type)) {
      return fail(400, { error: 'نوع المصروف غير صالح' });
    }

    const validCategories = ['wifi', 'playstation', 'fnb', 'general'];
    if (category && !validCategories.includes(category)) {
      return fail(400, { error: 'فئة المصروف غير صالحة' });
    }

    if (!name || !nameAr) {
      return fail(400, { error: 'الاسم مطلوب' });
    }

    if (isNaN(amount) || amount < 0) {
      return fail(400, { error: 'المبلغ غير صالح' });
    }

    try {
      // Convert EGP to piasters (multiply by 100)
      await createExpense({
        type,
        category: category || undefined,
        name,
        nameAr,
        amount: Math.round(amount * 100)
      });
      return { success: true, message: 'تم إضافة المصروف بنجاح' };
    } catch (error) {
      console.error('Add expense error:', error);
      return fail(500, { error: 'فشل في إضافة المصروف' });
    }
  },

  updateExpense: async ({ request }) => {
    const formData = await request.formData();
    const id = formData.get('id') as string;
    const amount = parseFloat(formData.get('amount') as string);
    const category = formData.get('category') as ExpenseCategory | null;
    const isActive = formData.get('isActive') === 'true';

    if (!id) {
      return fail(400, { error: 'معرف المصروف غير صالح' });
    }

    const validCategories = ['wifi', 'playstation', 'fnb', 'general'];
    if (category && !validCategories.includes(category)) {
      return fail(400, { error: 'فئة المصروف غير صالحة' });
    }

    try {
      const updates: Partial<{ amount: number; category: ExpenseCategory; isActive: boolean }> = {};
      if (!isNaN(amount)) {
        updates.amount = Math.round(amount * 100); // Convert to piasters
      }
      if (category) {
        updates.category = category;
      }
      updates.isActive = isActive;

      await updateExpense(id, updates);
      return { success: true, message: 'تم تحديث المصروف بنجاح' };
    } catch (error) {
      console.error('Update expense error:', error);
      return fail(500, { error: 'فشل في تحديث المصروف' });
    }
  },

  deleteExpense: async ({ request }) => {
    const formData = await request.formData();
    const id = formData.get('id') as string;

    if (!id) {
      return fail(400, { error: 'معرف المصروف غير صالح' });
    }

    try {
      await deleteExpense(id);
      return { success: true, message: 'تم حذف المصروف بنجاح' };
    } catch (error) {
      console.error('Delete expense error:', error);
      return fail(500, { error: 'فشل في حذف المصروف' });
    }
  }
};
