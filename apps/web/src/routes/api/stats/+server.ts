import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getVoucherStats } from '$lib/server/services/vouchers';
import { getActiveSessions } from '$lib/server/services/sessions';
import { getMikroTikClient } from '$lib/server/services/mikrotik';

export const GET: RequestHandler = async () => {
  try {
    let activeUsers = 0;
    let routerConnected = false;
    let stats = { total: 0, available: 0, used: 0, exhausted: 0, revenue: 0 };

    try {
      const client = await getMikroTikClient();
      await client.getSystemResources();
      routerConnected = true;

      const [sessions, voucherStats] = await Promise.all([
        getActiveSessions(),
        getVoucherStats()
      ]);

      activeUsers = sessions.length;
      stats = voucherStats;
    } catch {
      routerConnected = false;
    }

    const now = new Date();
    const updatedAtFormatted = `${now.getDate().toString().padStart(2, '0')}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    return json({
      activeUsers,
      availableVouchers: stats.available,
      todayRevenue: stats.revenue,
      routerConnected,
      updatedAt: updatedAtFormatted,
      updatedAtISO: now.toISOString()
    });
  } catch (error) {
    console.error('Stats API error:', error);
    return json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
};
