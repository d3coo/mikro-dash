import type { PageServerLoad } from './$types';
import { getMikroTikClient } from '$lib/server/services/mikrotik';
import { getPackageFromComment, getPackageByCodePrefix, getSettings, type PackageConfig } from '$lib/server/config';
import { getAllPrintedVoucherCodes } from '$lib/server/services/print-tracking';

interface PrintVoucher {
  id: string;
  name: string;
  password: string;
  profile: string;
  priceLE: number;
  pkg: PackageConfig | undefined;
}

export const load: PageServerLoad = async ({ url }) => {
  const idsParam = url.searchParams.get('ids') ?? '';
  const ids = idsParam.split(',').filter(Boolean);
  const status = url.searchParams.get('status'); // 'available' to get all available vouchers
  const unprintedOnly = url.searchParams.get('unprinted') === 'true'; // Only get unprinted vouchers

  let vouchers: PrintVoucher[] = [];

  try {
    const client = await getMikroTikClient();
    const allUsers = await client.getHotspotUsers();
    const activeSessions = await client.getActiveSessions();
    const activeUsernames = new Set(activeSessions.map((a: any) => a.user));

    // Get printed voucher codes if filtering by unprinted
    const printedCodes = unprintedOnly ? await getAllPrintedVoucherCodes() : new Set<string>();

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

    // Helper to convert user to PrintVoucher (async)
    const toPrintVoucher = async (user: any): Promise<PrintVoucher> => {
      const pkg = await getPackageFromComment(user.comment || '', user.profile)
        || await getPackageByCodePrefix(user.name);

      return {
        id: user['.id'],
        name: user.name,
        password: user.password || '',
        profile: user.profile,
        priceLE: pkg?.priceLE || 0,
        pkg
      };
    };

    // System users to exclude (not real vouchers)
    const systemUsers = ['default-trial', 'default', 'admin', 'guest'];

    if (status === 'available') {
      // Get all available vouchers (excluding system users)
      const filteredUsers = allUsers.filter((user: any) => {
        const isAvailable = getVoucherStatus(user) === 'available';
        const isNotSystem = !systemUsers.includes(user.name?.toLowerCase());
        const isNotPrinted = unprintedOnly ? !printedCodes.has(user.name) : true;
        return isAvailable && isNotSystem && isNotPrinted;
      });
      vouchers = await Promise.all(filteredUsers.map(toPrintVoucher));
    } else if (ids.length > 0) {
      // Get specific vouchers by ID
      const usersToConvert = ids
        .map(id => allUsers.find((u: any) => u['.id'] === id))
        .filter((u): u is any => u !== undefined);
      vouchers = await Promise.all(usersToConvert.map(toPrintVoucher));
    }
  } catch (error) {
    console.error('Failed to fetch vouchers from MikroTik:', error);
  }

  let settings;
  try {
    settings = await getSettings();
  } catch (error) {
    console.error('Failed to get settings from Convex:', error);
    settings = {
      mikrotik: { host: '192.168.1.109', user: 'admin', pass: 'need4speed' },
      business: { name: 'AboYassen WiFi' },
      wifi: { ssid: 'AboYassen' }
    };
  }

  return {
    vouchers,
    businessName: settings.business.name,
    wifiSSID: settings.wifi.ssid
  };
};
