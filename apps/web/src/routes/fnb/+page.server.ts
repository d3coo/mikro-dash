import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import {
  getTodayFnbSalesWithItems,
  getPsMenuItems,
  recordFnbSale,
  deleteFnbSale,
} from '$lib/server/convex';

export const load: PageServerLoad = async () => {
  try {
    const sales = await getTodayFnbSalesWithItems();
    const allMenuItems = await getPsMenuItems();
    const menuItems = allMenuItems.filter((item) => item.isAvailable);

    // Calculate revenue
    const revenue = sales.reduce((sum, s) => sum + s.priceSnapshot * s.quantity, 0);

    // Group sales by menu item for summary
    const salesByItem = new Map<string, { name: string; quantity: number; total: number }>();
    for (const sale of sales) {
      const itemName = sale.menuItem?.nameAr || 'غير معروف';
      const key = sale.menuItemId as string;
      const existing = salesByItem.get(key);
      if (existing) {
        existing.quantity += sale.quantity;
        existing.total += sale.priceSnapshot * sale.quantity;
      } else {
        salesByItem.set(key, {
          name: itemName,
          quantity: sale.quantity,
          total: sale.priceSnapshot * sale.quantity,
        });
      }
    }

    return {
      sales,
      revenue,
      menuItems,
      salesSummary: Array.from(salesByItem.values()),
      totalItems: sales.reduce((sum, s) => sum + s.quantity, 0),
    };
  } catch (error) {
    console.error('F&B page load error:', error);
    return {
      sales: [],
      revenue: 0,
      menuItems: [],
      salesSummary: [],
      totalItems: 0,
      error: 'فشل في تحميل البيانات',
    };
  }
};

export const actions: Actions = {
  recordSale: async ({ request }) => {
    const formData = await request.formData();
    const menuItemId = formData.get('menuItemId') as string;
    const quantity = parseInt(formData.get('quantity') as string, 10) || 1;

    if (!menuItemId) {
      return fail(400, { error: 'يرجى اختيار عنصر' });
    }

    if (quantity <= 0) {
      return fail(400, { error: 'الكمية يجب أن تكون أكبر من صفر' });
    }

    try {
      await recordFnbSale(menuItemId, quantity);
      return { success: true, message: 'تم تسجيل البيع بنجاح' };
    } catch (error) {
      console.error('Record sale error:', error);
      return fail(500, { error: error instanceof Error ? error.message : 'فشل في تسجيل البيع' });
    }
  },

  deleteSale: async ({ request }) => {
    const formData = await request.formData();
    const id = formData.get('id') as string;

    if (!id) {
      return fail(400, { error: 'معرف البيع غير صالح' });
    }

    try {
      await deleteFnbSale(id);
      return { success: true, message: 'تم حذف البيع بنجاح' };
    } catch (error) {
      console.error('Delete sale error:', error);
      return fail(500, { error: error instanceof Error ? error.message : 'فشل في حذف البيع' });
    }
  }
};
