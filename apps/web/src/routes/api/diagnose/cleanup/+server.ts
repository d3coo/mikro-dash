import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMikroTikClient } from '$lib/server/services/mikrotik';
import { deleteVoucherUsageHistory } from '$lib/server/services/voucher-usage';

/**
 * GET /api/diagnose/cleanup - Preview what would be cleaned up
 * POST /api/diagnose/cleanup - Execute cleanup
 *
 * Actions:
 * - delete-exhausted: Delete vouchers that have exhausted their data limit
 * - add-time-limit: Add limit-uptime to existing vouchers that don't have it
 * - delete-old-used: Delete vouchers that have been used (uptime > 0) but are not currently active
 * - delete-expired: Delete vouchers created > 24h ago that have been used (Option B: 24h from first use)
 */

/**
 * Parse creation timestamp from comment
 * Format: "pkg:ID|created:TIMESTAMP|Name"
 */
function parseCreatedAt(comment: string): number | null {
  const match = comment.match(/created:(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}
export const GET: RequestHandler = async () => {
  try {
    const client = await getMikroTikClient();
    const [hotspotUsers, activeSessions] = await Promise.all([
      client.getHotspotUsers(),
      client.getActiveSessions()
    ]);

    const activeUsers = new Set(activeSessions.map(s => s.user));

    // Categorize vouchers
    const exhausted: Array<{ id: string; name: string; bytesUsed: number; bytesLimit: number }> = [];
    const usedButInactive: Array<{ id: string; name: string; uptime: string; bytesUsed: number }> = [];
    const noTimeLimit: Array<{ id: string; name: string; profile: string }> = [];

    for (const user of hotspotUsers) {
      // Skip system users
      if (user.name.includes('default') || user.name === 'admin') continue;

      const bytesIn = parseInt(user['bytes-in'] || '0', 10);
      const bytesOut = parseInt(user['bytes-out'] || '0', 10);
      const bytesLimit = parseInt(user['limit-bytes-total'] || '0', 10);
      const totalBytes = bytesIn + bytesOut;
      const uptime = user.uptime || '0s';
      const limitUptime = user['limit-uptime'];

      // Check if exhausted
      if (bytesLimit > 0 && totalBytes >= bytesLimit) {
        exhausted.push({
          id: user['.id'],
          name: user.name,
          bytesUsed: totalBytes,
          bytesLimit
        });
      }
      // Check if used but not currently active (and not exhausted)
      else if (!activeUsers.has(user.name) && uptime !== '0s' && totalBytes > 0) {
        usedButInactive.push({
          id: user['.id'],
          name: user.name,
          uptime,
          bytesUsed: totalBytes
        });
      }

      // Check if no time limit
      if (!limitUptime || limitUptime === 'none' || limitUptime === '0s') {
        noTimeLimit.push({
          id: user['.id'],
          name: user.name,
          profile: user.profile
        });
      }
    }

    // Check for expired vouchers (created > 24h ago AND used)
    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000;
    const expired: Array<{ id: string; name: string; createdAt: string; hoursAgo: number; bytesUsed: number }> = [];

    for (const user of hotspotUsers) {
      if (user.name.includes('default') || user.name === 'admin') continue;

      const createdAt = parseCreatedAt(user.comment || '');
      if (!createdAt) continue; // Skip vouchers without creation timestamp

      const bytesIn = parseInt(user['bytes-in'] || '0', 10);
      const bytesOut = parseInt(user['bytes-out'] || '0', 10);
      const uptime = user.uptime || '0s';
      const hasBeenUsed = uptime !== '0s' || (bytesIn + bytesOut) > 0;
      const ageMs = now - createdAt;

      // Expired if: created > 24h ago AND has been used
      if (ageMs > twentyFourHours && hasBeenUsed && !activeUsers.has(user.name)) {
        expired.push({
          id: user['.id'],
          name: user.name,
          createdAt: new Date(createdAt).toISOString(),
          hoursAgo: Math.round(ageMs / (60 * 60 * 1000)),
          bytesUsed: bytesIn + bytesOut
        });
      }
    }

    return json({
      success: true,
      preview: {
        exhaustedVouchers: exhausted,
        usedButInactive: usedButInactive.slice(0, 30),
        expiredVouchers: expired,
        vouchersWithoutTimeLimit: noTimeLimit.length
      },
      counts: {
        exhausted: exhausted.length,
        usedButInactive: usedButInactive.length,
        expired: expired.length,
        noTimeLimit: noTimeLimit.length,
        activeNow: activeSessions.length
      }
    });

  } catch (error) {
    console.error('Cleanup preview error:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to preview cleanup'
    }, { status: 500 });
  }
};

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const action = body.action as string;
    const client = await getMikroTikClient();

    const results: {
      deleted: string[];
      updated: string[];
      errors: string[];
    } = {
      deleted: [],
      updated: [],
      errors: []
    };

    const [hotspotUsers, activeSessions] = await Promise.all([
      client.getHotspotUsers(),
      client.getActiveSessions()
    ]);

    const activeUsers = new Set(activeSessions.map(s => s.user));

    if (action === 'delete-exhausted') {
      // Delete vouchers that exhausted their data
      for (const user of hotspotUsers) {
        if (user.name.includes('default') || user.name === 'admin') continue;

        const bytesIn = parseInt(user['bytes-in'] || '0', 10);
        const bytesOut = parseInt(user['bytes-out'] || '0', 10);
        const bytesLimit = parseInt(user['limit-bytes-total'] || '0', 10);

        if (bytesLimit > 0 && (bytesIn + bytesOut) >= bytesLimit) {
          try {
            deleteVoucherUsageHistory(user.name); // Delete usage history first
            await client.deleteHotspotUser(user['.id']);
            results.deleted.push(user.name);
          } catch (e) {
            results.errors.push(`Failed to delete ${user.name}: ${e}`);
          }
        }
      }
    }

    if (action === 'add-time-limit') {
      // Add limit-uptime to vouchers that don't have it
      // We need to use the raw API to update users
      for (const user of hotspotUsers) {
        if (user.name.includes('default') || user.name === 'admin') continue;

        const limitUptime = user['limit-uptime'];
        if (!limitUptime || limitUptime === 'none' || limitUptime === '0s') {
          try {
            await client.request(`/ip/hotspot/user/${user['.id']}`, 'PATCH', {
              'limit-uptime': '1d'
            });
            results.updated.push(user.name);
          } catch (e) {
            results.errors.push(`Failed to update ${user.name}: ${e}`);
          }
        }
      }
    }

    if (action === 'delete-old-used') {
      // Delete vouchers that have been used but are not active
      for (const user of hotspotUsers) {
        if (user.name.includes('default') || user.name === 'admin') continue;

        const bytesIn = parseInt(user['bytes-in'] || '0', 10);
        const bytesOut = parseInt(user['bytes-out'] || '0', 10);
        const bytesLimit = parseInt(user['limit-bytes-total'] || '0', 10);
        const uptime = user.uptime || '0s';
        const isExhausted = bytesLimit > 0 && (bytesIn + bytesOut) >= bytesLimit;

        // Delete if: used (uptime > 0 or bytes > 0), not active, not fresh
        if (!activeUsers.has(user.name) && !isExhausted && (uptime !== '0s' || (bytesIn + bytesOut) > 0)) {
          try {
            deleteVoucherUsageHistory(user.name); // Delete usage history first
            await client.deleteHotspotUser(user['.id']);
            results.deleted.push(user.name);
          } catch (e) {
            results.errors.push(`Failed to delete ${user.name}: ${e}`);
          }
        }
      }
    }

    if (action === 'delete-expired') {
      // Delete vouchers created > 24h ago that have been used (Option B: 24h from first use)
      const now = Date.now();
      const twentyFourHours = 24 * 60 * 60 * 1000;

      for (const user of hotspotUsers) {
        if (user.name.includes('default') || user.name === 'admin') continue;

        const createdAt = parseCreatedAt(user.comment || '');
        if (!createdAt) continue; // Skip vouchers without timestamp

        const bytesIn = parseInt(user['bytes-in'] || '0', 10);
        const bytesOut = parseInt(user['bytes-out'] || '0', 10);
        const uptime = user.uptime || '0s';
        const hasBeenUsed = uptime !== '0s' || (bytesIn + bytesOut) > 0;
        const ageMs = now - createdAt;

        // Delete if: created > 24h ago AND has been used AND not currently active
        if (ageMs > twentyFourHours && hasBeenUsed && !activeUsers.has(user.name)) {
          try {
            deleteVoucherUsageHistory(user.name); // Delete usage history first
            await client.deleteHotspotUser(user['.id']);
            results.deleted.push(user.name);
          } catch (e) {
            results.errors.push(`Failed to delete ${user.name}: ${e}`);
          }
        }
      }
    }

    return json({
      success: true,
      action,
      results,
      summary: {
        deleted: results.deleted.length,
        updated: results.updated.length,
        errors: results.errors.length
      }
    });

  } catch (error) {
    console.error('Cleanup error:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Cleanup failed'
    }, { status: 500 });
  }
};
