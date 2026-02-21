import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { getUsersPageData, disconnectWirelessClient, blockMacAddress } from '$lib/server/services/users';
import { kickSession } from '$lib/server/services/sessions';
import { getMikroTikClient } from '$lib/server/services/mikrotik';
import { getSettings } from '$lib/server/config';

const PAGE_SIZE = 10;

export const load: PageServerLoad = async ({ url }) => {
  // Separate page params for each section
  const voucherPage = parseInt(url.searchParams.get('vp') || '1', 10);
  const wifiPage = parseInt(url.searchParams.get('wp') || '1', 10);

  // Fetch router data and settings in parallel
  const [routerData, settings] = await Promise.all([
    getUsersPageData().then(data => ({ data, connected: true })).catch(error => {
      console.error('Failed to connect to router:', error);
      return { data: null as Awaited<ReturnType<typeof getUsersPageData>> | null, connected: false };
    }),
    getSettings().catch(() => ({
      mikrotik: { host: '192.168.1.109', user: 'admin', pass: 'need4speed' },
      business: { name: 'AboYassen WiFi' },
      wifi: { ssid: 'AboYassen' }
    }))
  ]);

  const data = routerData.data;
  const routerConnected = routerData.connected;

  // Paginate voucher users
  const voucherUsers = data?.voucherUsers || [];
  const voucherTotal = voucherUsers.length;
  const voucherTotalPages = Math.ceil(voucherTotal / PAGE_SIZE) || 1;
  const voucherCurrentPage = Math.min(Math.max(1, voucherPage), voucherTotalPages);
  const paginatedVoucherUsers = voucherUsers.slice(
    (voucherCurrentPage - 1) * PAGE_SIZE,
    voucherCurrentPage * PAGE_SIZE
  );

  // Paginate WiFi-only clients
  const wifiClients = data?.wifiOnlyClients || [];
  const wifiTotal = wifiClients.length;
  const wifiTotalPages = Math.ceil(wifiTotal / PAGE_SIZE) || 1;
  const wifiCurrentPage = Math.min(Math.max(1, wifiPage), wifiTotalPages);
  const paginatedWiFiClients = wifiClients.slice(
    (wifiCurrentPage - 1) * PAGE_SIZE,
    wifiCurrentPage * PAGE_SIZE
  );

  return {
    voucherUsers: paginatedVoucherUsers,
    wifiOnlyClients: paginatedWiFiClients,
    totalVoucherUsers: voucherTotal,
    totalWiFiOnlyClients: wifiTotal,
    routerConnected,
    wifiSSID: settings.wifi.ssid,
    voucherPagination: {
      currentPage: voucherCurrentPage,
      totalPages: voucherTotalPages,
      pageSize: PAGE_SIZE,
      hasNext: voucherCurrentPage < voucherTotalPages,
      hasPrev: voucherCurrentPage > 1
    },
    wifiPagination: {
      currentPage: wifiCurrentPage,
      totalPages: wifiTotalPages,
      pageSize: PAGE_SIZE,
      hasNext: wifiCurrentPage < wifiTotalPages,
      hasPrev: wifiCurrentPage > 1
    }
  };
};

export const actions: Actions = {
  // Kick a voucher user (from hotspot active sessions)
  kickVoucher: async ({ request }) => {
    const formData = await request.formData();
    const sessionId = formData.get('sessionId') as string;

    if (!sessionId) {
      return fail(400, { error: 'معرف الجلسة مطلوب' });
    }

    try {
      await kickSession(sessionId);
      return { success: true, kicked: true };
    } catch (error) {
      console.error('Kick voucher user error:', error);
      return fail(500, { error: 'فشل في قطع الاتصال' });
    }
  },

  // Kick a WiFi-only client (disconnect from wireless)
  kickWifi: async ({ request }) => {
    const formData = await request.formData();
    const registrationId = formData.get('registrationId') as string;

    if (!registrationId) {
      return fail(400, { error: 'معرف الاتصال مطلوب' });
    }

    try {
      await disconnectWirelessClient(registrationId);
      return { success: true, kicked: true };
    } catch (error) {
      console.error('Kick WiFi client error:', error);
      return fail(500, { error: 'فشل في قطع الاتصال' });
    }
  },

  // Block a MAC address (for WiFi-only clients)
  blockMac: async ({ request }) => {
    const formData = await request.formData();
    const macAddress = formData.get('macAddress') as string;
    const deviceName = formData.get('deviceName') as string;
    const registrationId = formData.get('registrationId') as string;

    if (!macAddress) {
      return fail(400, { error: 'عنوان MAC مطلوب' });
    }

    try {
      // Block the MAC address
      await blockMacAddress(macAddress, deviceName || undefined);

      // Also disconnect the client immediately if we have the registration ID
      if (registrationId) {
        try {
          await disconnectWirelessClient(registrationId);
        } catch {
          // Ignore disconnect errors - device may have already disconnected
        }
      }

      return { success: true, blocked: true };
    } catch (error) {
      console.error('Block MAC error:', error);
      return fail(500, { error: 'فشل في حظر الجهاز' });
    }
  }
};
