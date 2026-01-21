import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { getTodayFnbSales, getTodayFnbRevenue, recordFnbSale, deleteFnbSale } from '$lib/server/services/fnb-sales';
import { getMenuItems } from '$lib/server/services/playstation';

export const load: PageServerLoad = async () => {
  try {
    const sales = getTodayFnbSales();
    const revenue = getTodayFnbRevenue();
    const menuItems = getMenuItems().filter(item => item.isAvailable);

    // Group sales by menu item for summary
    const salesByItem = new Map<number, { name: string; quantity: number; total: number }>();
    for (const sale of sales) {
      const itemName = sale.menuItem?.nameAr || 'غير معروف';
      const existing = salesByItem.get(sale.menuItemId);
      if (existing) {
        existing.quantity += sale.quantity;
        existing.total += sale.priceSnapshot * sale.quantity;
      } else {
        salesByItem.set(sale.menuItemId, {
          name: itemName,
          quantity: sale.quantity,
          total: sale.priceSnapshot * sale.quantity
        });
      }
    }

    return {
      sales,
      revenue,
      menuItems,
      salesSummary: Array.from(salesByItem.values()),
      totalItems: sales.reduce((sum, s) => sum + s.quantity, 0)
    };
  } catch (error) {
    console.error('F&B page load error:', error);
    return {
      sales: [],
      revenue: 0,
      menuItems: [],
      salesSummary: [],
      totalItems: 0,
      error: 'فشل في تحميل البيانات'
    };
  }
};

export const actions: Actions = {
  recordSale: async ({ request }) => {
    const formData = await request.formData();
    const menuItemId = parseInt(formData.get('menuItemId') as string, 10);
    const quantity = parseInt(formData.get('quantity') as string, 10) || 1;

    if (isNaN(menuItemId) || menuItemId <= 0) {
      return fail(400, { error: 'يرجى اختيار عنصر' });
    }

    if (quantity <= 0) {
      return fail(400, { error: 'الكمية يجب أن تكون أكبر من صفر' });
    }

    try {
      recordFnbSale(menuItemId, quantity);
      return { success: true, message: 'تم تسجيل البيع بنجاح' };
    } catch (error) {
      console.error('Record sale error:', error);
      return fail(500, { error: error instanceof Error ? error.message : 'فشل في تسجيل البيع' });
    }
  },

  deleteSale: async ({ request }) => {
    const formData = await request.formData();
    const id = parseInt(formData.get('id') as string, 10);

    if (isNaN(id)) {
      return fail(400, { error: 'معرف البيع غير صالح' });
    }

    try {
      deleteFnbSale(id);
      return { success: true, message: 'تم حذف البيع بنجاح' };
    } catch (error) {
      console.error('Delete sale error:', error);
      return fail(500, { error: error instanceof Error ? error.message : 'فشل في حذف البيع' });
    }
  }
};
