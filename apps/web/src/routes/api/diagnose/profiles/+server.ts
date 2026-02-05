import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMikroTikClient } from '$lib/server/services/mikrotik';

/**
 * GET /api/diagnose/profiles - Check hotspot profile configurations
 */
export const GET: RequestHandler = async () => {
  try {
    const client = await getMikroTikClient();

    const [userProfiles, hotspotUsers, activeSessions, cookies] = await Promise.all([
      client.getHotspotUserProfiles(),
      client.getHotspotUsers(),
      client.getActiveSessions(),
      client.getHotspotCookies()
    ]);

    // Analyze each profile
    const profileAnalysis = userProfiles.map(p => ({
      id: p['.id'],
      name: p.name,
      sessionTimeout: p['session-timeout'] || 'none',
      macCookieTimeout: p['mac-cookie-timeout'] || 'none',
      rateLimit: p['rate-limit'] || 'none',
      sharedUsers: p['shared-users'] || '1',
      // Flag potential issues
      issues: [
        ...(p['mac-cookie-timeout'] && p['mac-cookie-timeout'] !== 'none' &&
            p['session-timeout'] && p['session-timeout'] !== 'none' &&
            parseTime(p['mac-cookie-timeout']) > parseTime(p['session-timeout'])
            ? ['Cookie timeout > Session timeout - users can reconnect after session expires!'] : []),
        ...(!p['session-timeout'] || p['session-timeout'] === 'none'
            ? ['No session timeout - users can stay connected forever!'] : [])
      ]
    }));

    // Find old sessions (connected > 24h)
    const oldSessions = activeSessions
      .filter(s => parseTime(s.uptime) > 24 * 3600)
      .map(s => ({
        user: s.user,
        mac: s['mac-address'],
        ip: s.address,
        uptime: s.uptime,
        uptimeHours: Math.round(parseTime(s.uptime) / 3600 * 10) / 10,
        bytesIn: parseInt(s['bytes-in'] || '0', 10),
        bytesOut: parseInt(s['bytes-out'] || '0', 10)
      }));

    // Find users with data used but not exhausted (potential stale)
    const usersWithData = hotspotUsers
      .filter(u => {
        const bytesIn = parseInt(u['bytes-in'] || '0', 10);
        const bytesOut = parseInt(u['bytes-out'] || '0', 10);
        const bytesLimit = parseInt(u['limit-bytes-total'] || '0', 10);
        const totalUsed = bytesIn + bytesOut;
        // Has used data but not at limit
        return totalUsed > 0 && (bytesLimit === 0 || totalUsed < bytesLimit);
      })
      .map(u => {
        const bytesIn = parseInt(u['bytes-in'] || '0', 10);
        const bytesOut = parseInt(u['bytes-out'] || '0', 10);
        const bytesLimit = parseInt(u['limit-bytes-total'] || '0', 10);
        return {
          id: u['.id'],
          name: u.name,
          profile: u.profile,
          bytesUsed: bytesIn + bytesOut,
          bytesLimit,
          percentUsed: bytesLimit > 0 ? Math.round((bytesIn + bytesOut) / bytesLimit * 100) : 0,
          uptime: u.uptime || '0s',
          comment: u.comment
        };
      });

    // Check cookies linked to exhausted/old vouchers
    const userByName = new Map(hotspotUsers.map(u => [u.name, u]));
    const problematicCookies = cookies
      .map(c => {
        const user = userByName.get(c.user);
        if (!user) return null;

        const bytesIn = parseInt(user['bytes-in'] || '0', 10);
        const bytesOut = parseInt(user['bytes-out'] || '0', 10);
        const bytesLimit = parseInt(user['limit-bytes-total'] || '0', 10);
        const totalUsed = bytesIn + bytesOut;
        const isExhausted = bytesLimit > 0 && totalUsed >= bytesLimit;

        return {
          cookieId: c['.id'],
          mac: c['mac-address'],
          user: c.user,
          expiresIn: c['expires-in'],
          voucherBytesUsed: totalUsed,
          voucherBytesLimit: bytesLimit,
          voucherExhausted: isExhausted,
          problem: isExhausted ? 'Cookie exists for exhausted voucher!' : null
        };
      })
      .filter(c => c && c.problem);

    return json({
      success: true,
      profiles: profileAnalysis,
      oldSessions,
      usersWithData: usersWithData.slice(0, 20), // Limit to 20
      problematicCookies,
      summary: {
        totalProfiles: userProfiles.length,
        profilesWithIssues: profileAnalysis.filter(p => p.issues.length > 0).length,
        oldSessionsCount: oldSessions.length,
        usersWithDataCount: usersWithData.length,
        problematicCookiesCount: problematicCookies.length
      }
    });
  } catch (error) {
    console.error('Profile diagnose error:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to diagnose profiles'
    }, { status: 500 });
  }
};

/**
 * Parse MikroTik time format to seconds
 */
function parseTime(time: string | undefined): number {
  if (!time || time === 'none') return 0;

  let seconds = 0;
  const weeks = time.match(/(\d+)w/);
  const days = time.match(/(\d+)d/);
  const hours = time.match(/(\d+)h/);
  const minutes = time.match(/(\d+)m/);
  const secs = time.match(/(\d+)s/);

  if (weeks) seconds += parseInt(weeks[1], 10) * 7 * 24 * 3600;
  if (days) seconds += parseInt(days[1], 10) * 24 * 3600;
  if (hours) seconds += parseInt(hours[1], 10) * 3600;
  if (minutes) seconds += parseInt(minutes[1], 10) * 60;
  if (secs) seconds += parseInt(secs[1], 10);

  return seconds;
}
