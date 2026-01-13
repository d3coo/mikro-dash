import type { PageServerLoad, Actions } from './$types';
import { getVouchers, createVouchers, deleteVouchers, syncAllVouchers, getUnsyncedVouchers } from '$lib/server/services/vouchers';
import { VOUCHER_PACKAGES } from '$lib/voucher-packages';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async () => {
  const vouchers = getVouchers();
  const unsyncedCount = getUnsyncedVouchers().length;
  return {
    vouchers,
    packages: VOUCHER_PACKAGES,
    unsyncedCount
  };
};

export const actions: Actions = {
  generate: async ({ request }) => {
    const formData = await request.formData();
    const packageId = formData.get('packageId') as string;
    const quantity = parseInt(formData.get('quantity') as string, 10);

    if (!packageId) {
      return fail(400, { error: 'يجب اختيار الباقة' });
    }

    if (!quantity || quantity < 1 || quantity > 100) {
      return fail(400, { error: 'الكمية يجب أن تكون بين 1 و 100' });
    }

    try {
      const vouchers = await createVouchers(packageId, quantity);
      return { success: true, created: vouchers.length };
    } catch (error) {
      console.error('Generate vouchers error:', error);
      return fail(500, { error: 'فشل في إنشاء الكروت' });
    }
  },

  delete: async ({ request }) => {
    const formData = await request.formData();
    const ids = formData.getAll('ids') as string[];

    if (!ids.length) {
      return fail(400, { error: 'يجب اختيار كروت للحذف' });
    }

    try {
      await deleteVouchers(ids);
      return { success: true, deleted: ids.length };
    } catch (error) {
      console.error('Delete vouchers error:', error);
      return fail(500, { error: 'فشل في حذف الكروت' });
    }
  },

  sync: async () => {
    try {
      const result = await syncAllVouchers();
      if (result.synced === 0 && result.failed > 0) {
        return fail(500, { error: `فشل في مزامنة ${result.failed} كرت. تأكد من اتصال الراوتر.` });
      }
      return {
        success: true,
        syncResult: result
      };
    } catch (error) {
      console.error('Sync vouchers error:', error);
      return fail(500, { error: 'فشل في مزامنة الكروت' });
    }
  }
};
