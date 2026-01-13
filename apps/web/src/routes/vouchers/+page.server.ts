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

// Characters for generating codes (excluding confusing ones like 0/O, 1/l/I)
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

// Generate random alphanumeric string
function generateRandomCode(length: number): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
  }
  return result;
}

// Generate 4-character alphanumeric password (letters + numbers, mixed case)
function generatePassword(): string {
  return generateRandomCode(4);
}

// Generate unique voucher username (format: G3XX, G1XX where XX is random alphanumeric)
async function generateVoucherId(client: any, codePrefix: string): Promise<string> {
  const users = await client.getHotspotUsers();
  const existingNames = new Set(users.map((u: any) => u.name));

  // Generate unique code
  let attempts = 0;
  while (attempts < 100) {
    const code = `${codePrefix}${generateRandomCode(2)}`;
    if (!existingNames.has(code)) {
      return code;
    }
    attempts++;
  }

  // Fallback: use 3 characters if 2 chars are exhausted
  while (attempts < 200) {
    const code = `${codePrefix}${generateRandomCode(3)}`;
    if (!existingNames.has(code)) {
      return code;
    }
    attempts++;
  }

  throw new Error('Could not generate unique voucher ID');
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

      let created = 0;
      for (let i = 0; i < quantity; i++) {
        // Generate username like G301, G302, G101, G102, etc.
        const username = await generateVoucherId(client, pkg.codePrefix);
        // Generate 4-digit password like 1234, 5678, etc.
        const password = generatePassword();

        // Create directly in MikroTik
        await client.createHotspotUser(username, password, pkg.profile, pkg.bytes);
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
