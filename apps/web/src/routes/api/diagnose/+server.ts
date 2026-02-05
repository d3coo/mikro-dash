import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMikroTikClient } from '$lib/server/services/mikrotik';

/**
 * Diagnostic endpoint to check for hotspot bypass issues
 * GET /api/diagnose
 */
export const GET: RequestHandler = async () => {
  try {
    const client = await getMikroTikClient();

    // Fetch all relevant data in parallel
    const [ipBindings, hotspotCookies, hotspotHosts, activeSessions] = await Promise.all([
      client.getIpBindings(),
      client.getHotspotCookies(),
      client.getHotspotHosts(),
      client.getActiveSessions()
    ]);

    // Find bypassed devices
    const bypassedBindings = ipBindings.filter(b => b.type === 'bypassed' && b.disabled !== 'true');

    // Find unauthorized hosts with traffic
    const unauthorizedHosts = hotspotHosts.filter(h =>
      h.authorized !== 'true' &&
      (parseInt(h['bytes-in'] || '0', 10) > 0 || parseInt(h['bytes-out'] || '0', 10) > 0)
    );

    // Find hosts marked as bypassed
    const bypassedHosts = hotspotHosts.filter(h => h.bypassed === 'true');

    // Build active session MAC set
    const activeSessionMacs = new Set(activeSessions.map(s => s['mac-address'].toUpperCase()));

    // Find cookies for devices NOT in active sessions (stale cookies)
    const staleCookies = hotspotCookies.filter(c =>
      !activeSessionMacs.has(c['mac-address'].toUpperCase())
    );

    return json({
      success: true,
      diagnosis: {
        // IP Bindings that bypass authentication
        bypassedBindings: bypassedBindings.map(b => ({
          id: b['.id'],
          mac: b['mac-address'],
          ip: b.address,
          comment: b.comment
        })),

        // Devices getting traffic without authorization
        unauthorizedWithTraffic: unauthorizedHosts.map(h => ({
          mac: h['mac-address'],
          ip: h.address,
          bytesIn: parseInt(h['bytes-in'] || '0', 10),
          bytesOut: parseInt(h['bytes-out'] || '0', 10),
          authorized: h.authorized,
          bypassed: h.bypassed
        })),

        // Hosts explicitly bypassed
        bypassedHosts: bypassedHosts.map(h => ({
          mac: h['mac-address'],
          ip: h.address,
          bytesIn: parseInt(h['bytes-in'] || '0', 10),
          bytesOut: parseInt(h['bytes-out'] || '0', 10)
        })),

        // Stale cookies (might allow re-auth without voucher)
        staleCookies: staleCookies.map(c => ({
          id: c['.id'],
          mac: c['mac-address'],
          user: c.user,
          expires: c['expires-in']
        })),

        // Summary
        summary: {
          totalIpBindings: ipBindings.length,
          bypassedCount: bypassedBindings.length,
          totalCookies: hotspotCookies.length,
          staleCookieCount: staleCookies.length,
          totalHosts: hotspotHosts.length,
          unauthorizedWithTrafficCount: unauthorizedHosts.length,
          bypassedHostsCount: bypassedHosts.length
        }
      }
    });
  } catch (error) {
    console.error('Diagnose error:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to diagnose'
    }, { status: 500 });
  }
};

/**
 * POST /api/diagnose - Clean up stale cookies
 * Body: { action: "clean-cookies" | "clean-cookie", cookieId?: string }
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const client = await getMikroTikClient();

    if (body.action === 'clean-cookies') {
      // Delete ALL stale cookies (not in active sessions)
      const [hotspotCookies, activeSessions] = await Promise.all([
        client.getHotspotCookies(),
        client.getActiveSessions()
      ]);

      const activeSessionMacs = new Set(activeSessions.map(s => s['mac-address'].toUpperCase()));
      const staleCookies = hotspotCookies.filter(c =>
        !activeSessionMacs.has(c['mac-address'].toUpperCase())
      );

      let deleted = 0;
      for (const cookie of staleCookies) {
        try {
          await client.deleteHotspotCookie(cookie['.id']);
          deleted++;
        } catch (e) {
          console.error(`Failed to delete cookie ${cookie['.id']}:`, e);
        }
      }

      return json({
        success: true,
        message: `Deleted ${deleted} stale cookies`,
        deleted
      });
    }

    if (body.action === 'clean-cookie' && body.cookieId) {
      // Delete specific cookie
      await client.deleteHotspotCookie(body.cookieId);
      return json({
        success: true,
        message: `Deleted cookie ${body.cookieId}`
      });
    }

    return json({
      success: false,
      error: 'Invalid action. Use "clean-cookies" or "clean-cookie" with cookieId'
    }, { status: 400 });

  } catch (error) {
    console.error('Diagnose POST error:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to execute action'
    }, { status: 500 });
  }
};
