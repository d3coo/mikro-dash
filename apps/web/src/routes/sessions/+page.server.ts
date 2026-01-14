import type { PageServerLoad, Actions } from './$types';
import { getMikroTikClient } from '$lib/server/services/settings';
import { fail } from '@sveltejs/kit';

export interface SessionInfo {
  // Voucher info
  id: string;
  username: string;
  password?: string;
  profile: string;
  server?: string;
  // Data usage
  limitBytes: number;
  usedBytes: number;
  remainingBytes: number;
  // Device info (from active session or cookie)
  isOnline: boolean;
  deviceName?: string;
  macAddress?: string;
  ipAddress?: string;
  uptime?: string;
  // Cookie info
  cookieExpiresIn?: string;
}

export const load: PageServerLoad = async ({ url }) => {
  const search = url.searchParams.get('search') || '';
  const filterProfile = url.searchParams.get('profile') || '';
  const filterServer = url.searchParams.get('server') || '';

  let sessions: SessionInfo[] = [];
  let routerConnected = false;
  let profiles: string[] = [];
  let servers: string[] = [];

  try {
    const client = await getMikroTikClient();
    await client.getSystemResources();
    routerConnected = true;

    // Fetch all data in parallel
    const [hotspotUsers, activeSessions, cookies, dhcpLeases, hotspotServers] = await Promise.all([
      client.getHotspotUsers(),
      client.getActiveSessions(),
      client.getHotspotCookies(),
      client.getDhcpLeases(),
      client.getHotspotServers()
    ]);

    // Get unique profiles and servers for filters
    servers = hotspotServers.map(s => s.name);

    // Create lookup maps
    const activeSessionMap = new Map(activeSessions.map(s => [s.user, s]));
    const cookieMap = new Map(cookies.map(c => [c.user, c]));
    const dhcpMap = new Map(dhcpLeases.map(l => [l['mac-address'], l]));

    // Build session info for each hotspot user
    for (const user of hotspotUsers) {
      // Skip system users
      if (user.name === 'default-trial') continue;

      const activeSession = activeSessionMap.get(user.name);
      const cookie = cookieMap.get(user.name);

      // Get device name from DHCP if we have MAC
      const macAddress = activeSession?.['mac-address'] || cookie?.['mac-address'];
      const dhcpLease = macAddress ? dhcpMap.get(macAddress) : undefined;

      // Parse bytes - MikroTik may return as string or number
      // User bytes are cumulative, session bytes are for current session only
      const limitBytes = Number(user['limit-bytes-total']) || 0;

      // Get bytes from user (cumulative) or active session (current session)
      let bytesIn = Number(user['bytes-in']) || 0;
      let bytesOut = Number(user['bytes-out']) || 0;

      // If user has no cumulative bytes but has active session, use session bytes
      if (bytesIn === 0 && bytesOut === 0 && activeSession) {
        bytesIn = Number(activeSession['bytes-in']) || 0;
        bytesOut = Number(activeSession['bytes-out']) || 0;
      }

      const usedBytes = bytesIn + bytesOut;

      sessions.push({
        id: user['.id'],
        username: user.name,
        password: user.password,
        profile: user.profile,
        server: (user as any).server || undefined,
        limitBytes,
        usedBytes,
        remainingBytes: Math.max(0, limitBytes - usedBytes),
        isOnline: !!activeSession,
        deviceName: dhcpLease?.['host-name']?.replace(/-/g, ' ') || undefined,
        macAddress,
        ipAddress: activeSession?.address,
        uptime: activeSession?.uptime,
        cookieExpiresIn: cookie?.['expires-in']
      });
    }

    // Get unique profiles from sessions
    profiles = [...new Set(sessions.map(s => s.profile).filter(Boolean))];

    // Sort: online first, then by username
    sessions.sort((a, b) => {
      if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
      return a.username.localeCompare(b.username);
    });

    // Apply filters
    if (search) {
      const searchLower = search.toLowerCase();
      sessions = sessions.filter(s =>
        s.username.toLowerCase().includes(searchLower) ||
        s.macAddress?.toLowerCase().includes(searchLower) ||
        s.deviceName?.toLowerCase().includes(searchLower)
      );
    }

    if (filterProfile) {
      sessions = sessions.filter(s => s.profile === filterProfile);
    }

    if (filterServer) {
      sessions = sessions.filter(s => s.server === filterServer);
    }

  } catch (error) {
    console.error('Failed to load sessions:', error);
  }

  return {
    sessions,
    routerConnected,
    search,
    filterProfile,
    filterServer,
    profiles,
    servers
  };
};

export const actions: Actions = {
  delete: async ({ request }) => {
    const formData = await request.formData();
    const userId = formData.get('userId') as string;

    if (!userId) {
      return fail(400, { error: 'معرف المستخدم مطلوب' });
    }

    try {
      const client = await getMikroTikClient();
      await client.deleteHotspotUser(userId);
      return { success: true, deleted: true };
    } catch (error) {
      console.error('Delete user error:', error);
      return fail(500, { error: 'فشل في حذف المستخدم' });
    }
  }
};
