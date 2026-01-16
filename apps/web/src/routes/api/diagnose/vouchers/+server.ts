import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMikroTikClient } from '$lib/server/services/mikrotik';

/**
 * GET /api/diagnose/vouchers - Analyze all vouchers for issues
 */
export const GET: RequestHandler = async () => {
  try {
    const client = getMikroTikClient();

    const [hotspotUsers, activeSessions, profiles] = await Promise.all([
      client.getHotspotUsers(),
      client.getActiveSessions(),
      client.getHotspotUserProfiles()
    ]);

    // Build profile map
    const profileMap = new Map(profiles.map(p => [p.name, p]));

    // Build active session set
    const activeUsers = new Set(activeSessions.map(s => s.user));

    // Analyze each voucher
    const vouchers = hotspotUsers
      .filter(u => !u.name.includes('default') && u.name !== 'admin')
      .map(u => {
        const bytesIn = parseInt(u['bytes-in'] || '0', 10);
        const bytesOut = parseInt(u['bytes-out'] || '0', 10);
        const bytesLimit = parseInt(u['limit-bytes-total'] || '0', 10);
        const totalBytes = bytesIn + bytesOut;

        // Parse uptime (total accumulated session time)
        const uptime = u.uptime || '0s';
        const uptimeSeconds = parseTime(uptime);

        // Get profile settings
        const profile = profileMap.get(u.profile);
        const sessionTimeout = profile?.['session-timeout'] || 'none';
        const sessionTimeoutSeconds = parseTime(sessionTimeout);

        // Check limit-uptime (total lifetime limit)
        const limitUptime = u['limit-uptime'] || 'none';
        const limitUptimeSeconds = parseTime(limitUptime);

        // Determine status
        const isActive = activeUsers.has(u.name);
        const isDataExhausted = bytesLimit > 0 && totalBytes >= bytesLimit;
        const isTimeExhausted = limitUptimeSeconds > 0 && uptimeSeconds >= limitUptimeSeconds;

        // Calculate percentages
        const dataPercent = bytesLimit > 0 ? Math.round(totalBytes / bytesLimit * 100) : 0;
        const timePercent = limitUptimeSeconds > 0 ? Math.round(uptimeSeconds / limitUptimeSeconds * 100) : 0;

        // Flag issues
        const issues: string[] = [];

        if (isDataExhausted && isActive) {
          issues.push('Data exhausted but still active!');
        }
        if (isTimeExhausted && isActive) {
          issues.push('Time limit reached but still active!');
        }
        if (limitUptime === 'none' && bytesLimit > 0) {
          issues.push('No total time limit set - can reconnect forever until data exhausted');
        }
        if (uptimeSeconds > 24 * 3600 && !isDataExhausted) {
          issues.push(`Used ${Math.round(uptimeSeconds / 3600)}h total - exceeds 24h but data not exhausted`);
        }

        return {
          id: u['.id'],
          name: u.name,
          profile: u.profile,
          isActive,
          // Data
          bytesUsed: totalBytes,
          bytesLimit,
          dataPercent,
          dataExhausted: isDataExhausted,
          // Time
          uptime,
          uptimeSeconds,
          uptimeHours: Math.round(uptimeSeconds / 3600 * 10) / 10,
          limitUptime,
          limitUptimeSeconds,
          timeExhausted: isTimeExhausted,
          timePercent,
          // Profile
          sessionTimeout,
          // Issues
          issues,
          hasIssues: issues.length > 0,
          // Should this voucher be deleted?
          shouldDelete: isDataExhausted || isTimeExhausted
        };
      });

    // Sort: issues first, then by uptime
    vouchers.sort((a, b) => {
      if (a.hasIssues !== b.hasIssues) return a.hasIssues ? -1 : 1;
      return b.uptimeSeconds - a.uptimeSeconds;
    });

    // Categorize
    const exhaustedVouchers = vouchers.filter(v => v.dataExhausted || v.timeExhausted);
    const activeVouchers = vouchers.filter(v => v.isActive && !v.dataExhausted);
    const oldVouchers = vouchers.filter(v => v.uptimeSeconds > 24 * 3600 && !v.dataExhausted && !v.isActive);
    const noTimeLimitVouchers = vouchers.filter(v => v.limitUptime === 'none' && v.bytesLimit > 0);

    return json({
      success: true,
      analysis: {
        exhaustedVouchers: exhaustedVouchers.slice(0, 20),
        activeVouchers: activeVouchers.slice(0, 20),
        oldVouchers: oldVouchers.slice(0, 20),
        vouchersWithoutTimeLimit: noTimeLimitVouchers.length
      },
      summary: {
        total: vouchers.length,
        active: activeVouchers.length,
        exhausted: exhaustedVouchers.length,
        oldButNotExhausted: oldVouchers.length,
        withoutTimeLimit: noTimeLimitVouchers.length
      },
      recommendation: noTimeLimitVouchers.length > 0
        ? 'Vouchers have data limits but NO total time limit. Users can reconnect indefinitely until data runs out. Consider adding limit-uptime to vouchers.'
        : 'Configuration looks good.'
    });

  } catch (error) {
    console.error('Voucher diagnose error:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to diagnose vouchers'
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
