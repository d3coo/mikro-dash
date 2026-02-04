import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMikroTikClient } from '$lib/server/services/mikrotik';
import { getPackageFromComment, getPackageByCodePrefix, getSettings } from '$lib/server/config';

interface VoucherForExport {
  id: string;
  name: string;
  packageName: string;
  priceLE: number;
}

export const GET: RequestHandler = async ({ url }) => {
  const idsParam = url.searchParams.get('ids') ?? '';
  const ids = idsParam.split(',').filter(Boolean);
  const status = url.searchParams.get('status');

  const settings = await getSettings();
  let vouchers: VoucherForExport[] = [];

  try {
    const client = await getMikroTikClient();
    const allUsers = await client.getHotspotUsers();
    const activeSessions = await client.getActiveSessions();
    const activeUsernames = new Set(activeSessions.map((a: any) => a.user));

    // System users to exclude
    const systemUsers = ['default-trial', 'default', 'admin', 'guest'];

    // Helper to determine voucher status
    const getVoucherStatus = (user: any): 'available' | 'used' | 'exhausted' => {
      const bytesIn = parseInt(user['bytes-in']) || 0;
      const bytesOut = parseInt(user['bytes-out']) || 0;
      const bytesTotal = bytesIn + bytesOut;
      const limitBytesIn = parseInt(user['limit-bytes-in']) || 0;
      const limitBytesOut = parseInt(user['limit-bytes-out']) || 0;
      const limitBytesTotal = parseInt(user['limit-bytes-total']) || 0;
      const bytesLimit = limitBytesTotal || (limitBytesIn + limitBytesOut);

      if (bytesLimit > 0 && bytesTotal >= bytesLimit) return 'exhausted';
      if (activeUsernames.has(user.name) || bytesTotal > 0) return 'used';
      return 'available';
    };

    // Helper to convert user to export format (async)
    const toExportVoucher = async (user: any): Promise<VoucherForExport> => {
      const pkg = await getPackageFromComment(user.comment || '', user.profile)
        || await getPackageByCodePrefix(user.name);

      return {
        id: user['.id'],
        name: user.name,
        packageName: pkg?.nameAr || user.profile || 'باقة',
        priceLE: pkg?.priceLE || 0
      };
    };

    if (status === 'available') {
      // Get all available vouchers (excluding system users)
      const filteredUsers = allUsers.filter((user: any) =>
        getVoucherStatus(user) === 'available' &&
        !systemUsers.includes(user.name?.toLowerCase())
      );
      vouchers = await Promise.all(filteredUsers.map(toExportVoucher));
    } else if (ids.length > 0) {
      // Get specific vouchers by ID
      const usersToConvert = ids
        .map(id => allUsers.find((u: any) => u['.id'] === id))
        .filter((u): u is any => u !== undefined);
      vouchers = await Promise.all(usersToConvert.map(toExportVoucher));
    }
  } catch (error) {
    console.error('Failed to fetch vouchers:', error);
    return json({ error: 'Failed to fetch vouchers' }, { status: 500 });
  }

  return json({
    vouchers,
    businessName: settings.business.name,
    wifiSSID: settings.wifi.ssid
  });
};
