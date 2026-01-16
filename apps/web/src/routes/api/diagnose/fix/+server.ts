import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMikroTikClient } from '$lib/server/services/mikrotik';

/**
 * POST /api/diagnose/fix - Fix hotspot configuration issues
 * Actions:
 * - fix-profiles: Adjust mac-cookie-timeout to not exceed session-timeout
 * - clean-exhausted-cookies: Delete cookies for exhausted vouchers only
 * - fix-all: Do both
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const action = body.action as string;
    const client = getMikroTikClient();

    const results: {
      profilesFixed: string[];
      cookiesDeleted: string[];
      errors: string[];
    } = {
      profilesFixed: [],
      cookiesDeleted: [],
      errors: []
    };

    // Fix profiles if requested
    if (action === 'fix-profiles' || action === 'fix-all') {
      const profiles = await client.getHotspotUserProfiles();

      for (const profile of profiles) {
        const sessionTimeout = profile['session-timeout'];
        const cookieTimeout = profile['mac-cookie-timeout'];

        // Skip if no cookie timeout set
        if (!cookieTimeout || cookieTimeout === 'none') continue;

        // If no session timeout, disable cookie timeout
        if (!sessionTimeout || sessionTimeout === 'none') {
          try {
            await client.updateHotspotUserProfile(profile['.id'], {
              macCookieTimeout: 'none'
            });
            results.profilesFixed.push(`${profile.name}: disabled cookie (no session timeout)`);
          } catch (e) {
            results.errors.push(`Failed to fix ${profile.name}: ${e}`);
          }
          continue;
        }

        // If cookie > session, set cookie = session
        const sessionSecs = parseTime(sessionTimeout);
        const cookieSecs = parseTime(cookieTimeout);

        if (cookieSecs > sessionSecs) {
          try {
            await client.updateHotspotUserProfile(profile['.id'], {
              macCookieTimeout: sessionTimeout
            });
            results.profilesFixed.push(`${profile.name}: cookie ${cookieTimeout} → ${sessionTimeout}`);
          } catch (e) {
            results.errors.push(`Failed to fix ${profile.name}: ${e}`);
          }
        }
      }
    }

    // Clean exhausted voucher cookies if requested
    if (action === 'clean-exhausted-cookies' || action === 'fix-all') {
      const [cookies, hotspotUsers] = await Promise.all([
        client.getHotspotCookies(),
        client.getHotspotUsers()
      ]);

      // Build map of exhausted users
      const exhaustedUsers = new Set<string>();
      for (const user of hotspotUsers) {
        const bytesIn = parseInt(user['bytes-in'] || '0', 10);
        const bytesOut = parseInt(user['bytes-out'] || '0', 10);
        const bytesLimit = parseInt(user['limit-bytes-total'] || '0', 10);
        const totalUsed = bytesIn + bytesOut;

        if (bytesLimit > 0 && totalUsed >= bytesLimit) {
          exhaustedUsers.add(user.name);
        }
      }

      // Delete cookies for exhausted users
      for (const cookie of cookies) {
        if (exhaustedUsers.has(cookie.user)) {
          try {
            await client.deleteHotspotCookie(cookie['.id']);
            results.cookiesDeleted.push(`${cookie.user} (${cookie['mac-address']})`);
          } catch (e) {
            results.errors.push(`Failed to delete cookie for ${cookie.user}: ${e}`);
          }
        }
      }
    }

    return json({
      success: true,
      action,
      results,
      summary: {
        profilesFixed: results.profilesFixed.length,
        cookiesDeleted: results.cookiesDeleted.length,
        errors: results.errors.length
      }
    });

  } catch (error) {
    console.error('Fix error:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to apply fixes'
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
