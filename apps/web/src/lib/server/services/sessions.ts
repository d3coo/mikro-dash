import { getMikroTikClient } from './mikrotik';

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

export interface ActiveSession {
  id: string;
  user: string;
  address: string;
  macAddress: string;
  uptime: string;
  bytesIn: number;
  bytesOut: number;
}

/**
 * Get active sessions from router
 */
export async function getActiveSessions(): Promise<ActiveSession[]> {
  const client = getMikroTikClient();
  const sessions = await client.getActiveSessions();

  return sessions.map(s => ({
    id: s['.id'],
    user: s.user,
    address: s.address,
    macAddress: s['mac-address'],
    uptime: s.uptime,
    bytesIn: parseInt(s['bytes-in'] || '0', 10),
    bytesOut: parseInt(s['bytes-out'] || '0', 10)
  }));
}

/**
 * Get detailed session info combining hotspot users, active sessions, cookies, and DHCP
 */
export async function getDetailedSessions(): Promise<{
  sessions: SessionInfo[];
  profiles: string[];
  servers: string[];
}> {
  const client = getMikroTikClient();

  // Fetch all data in parallel
  const [hotspotUsers, activeSessions, cookies, dhcpLeases, hotspotServers] = await Promise.all([
    client.getHotspotUsers(),
    client.getActiveSessions(),
    client.getHotspotCookies(),
    client.getDhcpLeases(),
    client.getHotspotServers()
  ]);

  // Get unique servers
  const servers = hotspotServers.map(s => s.name);

  // Create lookup maps
  const activeSessionMap = new Map(activeSessions.map(s => [s.user, s]));
  const cookieMap = new Map(cookies.map(c => [c.user, c]));
  const dhcpMap = new Map(dhcpLeases.map(l => [l['mac-address'], l]));

  const sessions: SessionInfo[] = [];

  // Build session info for each hotspot user
  for (const user of hotspotUsers) {
    // Skip system users
    if (user.name === 'default-trial') continue;

    const activeSession = activeSessionMap.get(user.name);
    const cookie = cookieMap.get(user.name);

    // Get device name from DHCP if we have MAC
    const macAddress = activeSession?.['mac-address'] || cookie?.['mac-address'];
    const dhcpLease = macAddress ? dhcpMap.get(macAddress) : undefined;

    // Parse bytes
    const limitBytes = Number(user['limit-bytes-total']) || 0;
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
      server: user.server,
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
  const profiles = [...new Set(sessions.map(s => s.profile).filter(Boolean))];

  // Sort: online first, then by username
  sessions.sort((a, b) => {
    if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
    return a.username.localeCompare(b.username);
  });

  return { sessions, profiles, servers };
}

/**
 * Kick an active session
 */
export async function kickSession(sessionId: string): Promise<void> {
  const client = getMikroTikClient();
  await client.kickSession(sessionId);
}

/**
 * Delete a hotspot user
 */
export async function deleteUser(userId: string): Promise<void> {
  const client = getMikroTikClient();
  await client.deleteHotspotUser(userId);
}
