import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { getVouchers, createVouchers, deleteVouchers, type Voucher } from '$lib/server/services/vouchers';
import { getMikroTikClient } from '$lib/server/services/mikrotik';
import { getPackages, getSettings } from '$lib/server/config';

const PAGE_SIZE = 10;

export const load: PageServerLoad = async ({ url }) => {
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const statusFilter = url.searchParams.get('status') || 'all';
  const packageFilter = url.searchParams.get('package') || '';
  const profileFilter = url.searchParams.get('profile') || '';

  let allVouchers: Voucher[] = [];
  let routerConnected = false;
  let profiles: string[] = [];
  const packages = getPackages();

  try {
    const client = getMikroTikClient();
    await client.getSystemResources(); // Test connection
    routerConnected = true;

    allVouchers = await getVouchers();

    // Get unique profiles from vouchers
    profiles = [...new Set(allVouchers.map(v => v.profile).filter(Boolean))];
  } catch (error) {
    console.error('Failed to connect to router:', error);
    routerConnected = false;
  }

  // Apply filters
  let filteredVouchers = statusFilter === 'all'
    ? allVouchers
    : allVouchers.filter(v => v.status === statusFilter);

  if (packageFilter) {
    filteredVouchers = filteredVouchers.filter(v => v.packageId === packageFilter);
  }

  if (profileFilter) {
    filteredVouchers = filteredVouchers.filter(v => v.profile === profileFilter);
  }

  // Calculate pagination
  const totalItems = filteredVouchers.length;
  const totalPages = Math.ceil(totalItems / PAGE_SIZE);
  const currentPage = Math.min(Math.max(1, page), totalPages || 1);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE;

  const paginatedVouchers = filteredVouchers.slice(startIndex, endIndex);

  // Count by status
  const statusCounts = {
    all: allVouchers.length,
    available: allVouchers.filter(v => v.status === 'available').length,
    used: allVouchers.filter(v => v.status === 'used').length,
    exhausted: allVouchers.filter(v => v.status === 'exhausted').length
  };

  const settings = getSettings();

  return {
    vouchers: paginatedVouchers,
    totalVouchers: totalItems,
    statusCounts,
    packages,
    profiles,
    routerConnected,
    currentFilter: statusFilter,
    packageFilter,
    profileFilter,
    wifiSSID: settings.wifi.ssid,
    pagination: {
      currentPage,
      totalPages,
      pageSize: PAGE_SIZE,
      hasNext: currentPage < totalPages,
      hasPrev: currentPage > 1
    }
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
      const result = await createVouchers(packageId, quantity);
      return { success: true, created: result.created };
    } catch (error) {
      console.error('Generate vouchers error:', error);
      return fail(500, { error: 'فشل في إنشاء الكروت - تأكد من اتصال الراوتر' });
    }
  },

  delete: async ({ request }) => {
    const formData = await request.formData();
    const ids = formData.getAll('ids') as string[];

    if (!ids.length) {
      return fail(400, { error: 'يجب اختيار كروت للحذف' });
    }

    try {
      // Get voucher names before deleting (needed to delete usage history)
      const allVouchers = await getVouchers();
      const vouchersToDelete = allVouchers
        .filter(v => ids.includes(v.id))
        .map(v => ({ id: v.id, name: v.name }));

      const result = await deleteVouchers(vouchersToDelete);
      return { success: true, deleted: result.deleted };
    } catch (error) {
      console.error('Delete vouchers error:', error);
      return fail(500, { error: 'فشل في حذف الكروت' });
    }
  },

  cleanup: async () => {
    try {
      // Get all vouchers and filter exhausted ones
      const allVouchers = await getVouchers();
      const exhaustedVouchers = allVouchers
        .filter(v => v.status === 'exhausted')
        .map(v => ({ id: v.id, name: v.name }));

      if (exhaustedVouchers.length === 0) {
        return { success: true, deleted: 0, message: 'لا توجد كروت منتهية للحذف' };
      }

      const result = await deleteVouchers(exhaustedVouchers);

      return {
        success: true,
        deleted: result.deleted,
        message: `تم حذف ${result.deleted} كرت منتهي`
      };
    } catch (error) {
      console.error('Cleanup vouchers error:', error);
      return fail(500, { error: 'فشل في حذف الكروت المنتهية' });
    }
  }
};
