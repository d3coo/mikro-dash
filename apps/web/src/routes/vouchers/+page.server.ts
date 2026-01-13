import type { PageServerLoad, Actions } from './$types';
import { getMikroTikClient } from '$lib/server/services/settings';
import { VOUCHER_PACKAGES, getPackageById } from '$lib/voucher-packages';
import { fail } from '@sveltejs/kit';

const PAGE_SIZE = 10;

interface MikroTikVoucher {
  id: string;           // MikroTik internal ID (.id)
  name: string;         // Voucher code/username
  password: string;
  profile: string;
  bytesIn: number;
  bytesOut: number;
  bytesTotal: number;
  bytesLimit: number;
  uptime: string;
  status: 'available' | 'used' | 'exhausted';
  comment: string;
}

export const load: PageServerLoad = async ({ url }) => {
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const statusFilter = url.searchParams.get('status') || 'all';

  let allVouchers: MikroTikVoucher[] = [];
  let routerConnected = false;

  try {
    const client = await getMikroTikClient();
    await client.getSystemResources(); // Test connection
    routerConnected = true;

    // Get all hotspot users from MikroTik
    const hotspotUsers = await client.getHotspotUsers();

    // Transform to voucher format, filter out system users
    allVouchers = hotspotUsers
      .filter(u => !u.name.includes('default') && u.name !== 'admin')
      .map(u => {
        const bytesIn = parseInt(u['bytes-in'] || '0', 10);
        const bytesOut = parseInt(u['bytes-out'] || '0', 10);
        const bytesTotal = bytesIn + bytesOut;
        const bytesLimit = parseInt(u['limit-bytes-total'] || '0', 10);
        const uptime = u.uptime || '0s';

        // Determine status
        let status: 'available' | 'used' | 'exhausted' = 'available';
        if (bytesLimit > 0 && bytesTotal >= bytesLimit) {
          status = 'exhausted';
        } else if (uptime !== '0s' || bytesTotal > 0) {
          status = 'used';
        }

        return {
          id: u['.id'],
          name: u.name,
          password: u.password || '',
          profile: u.profile,
          bytesIn,
          bytesOut,
          bytesTotal,
          bytesLimit,
          uptime,
          status,
          comment: u.comment || ''
        };
      });
  } catch (error) {
    console.error('Failed to connect to router:', error);
    routerConnected = false;
  }

  // Apply status filter
  const filteredVouchers = statusFilter === 'all'
    ? allVouchers
    : allVouchers.filter(v => v.status === statusFilter);

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

  return {
    vouchers: paginatedVouchers,
    totalVouchers: totalItems,
    statusCounts,
    packages: VOUCHER_PACKAGES,
    routerConnected,
    currentFilter: statusFilter,
    pagination: {
      currentPage,
      totalPages,
      pageSize: PAGE_SIZE,
      hasNext: currentPage < totalPages,
      hasPrev: currentPage > 1
    }
  };
};

// Generate random password excluding confusing characters
function generatePassword(length = 8): string {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Generate next voucher ID based on existing vouchers
async function generateVoucherId(client: any, prefix: string, pkgCode: string): Promise<string> {
  const users = await client.getHotspotUsers();
  const pattern = `${prefix}-${pkgCode}-`;

  let maxNum = 0;
  for (const u of users) {
    if (u.name.startsWith(pattern)) {
      const parts = u.name.split('-');
      const num = parseInt(parts[parts.length - 1], 10);
      if (num > maxNum) maxNum = num;
    }
  }

  const nextNum = (maxNum + 1).toString().padStart(3, '0');
  return `${prefix}-${pkgCode}-${nextNum}`;
}

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

    const pkg = getPackageById(packageId);
    if (!pkg) {
      return fail(400, { error: 'الباقة غير صالحة' });
    }

    try {
      const client = await getMikroTikClient();
      const prefix = 'ABO'; // Could be fetched from settings
      const pkgCode = pkg.id.replace('.', '').replace('GB', 'G');

      let created = 0;
      for (let i = 0; i < quantity; i++) {
        const id = await generateVoucherId(client, prefix, pkgCode);
        const password = generatePassword();

        // Create directly in MikroTik with comment containing price
        await client.createHotspotUser(id, password, pkg.profile, pkg.bytes);
        created++;
      }

      return { success: true, created };
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
      const client = await getMikroTikClient();

      // Delete each voucher from MikroTik using their .id
      for (const id of ids) {
        await client.deleteHotspotUser(id);
      }

      return { success: true, deleted: ids.length };
    } catch (error) {
      console.error('Delete vouchers error:', error);
      return fail(500, { error: 'فشل في حذف الكروت' });
    }
  }
};
