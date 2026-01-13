import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { vouchers } from '$lib/server/db/schema';
import { getMikroTikClient } from '$lib/server/services/settings';

export const GET: RequestHandler = async () => {
  try {
    // Get voucher stats from local DB
    const allVouchers = db.select().from(vouchers).all();
    const availableVouchers = allVouchers.filter(v => v.status === 'available').length;

    // Get today's used vouchers for revenue
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    const usedToday = allVouchers.filter(
      v => v.status === 'used' && v.usedAt && v.usedAt >= todayISO
    );
    const todayRevenue = usedToday.reduce((sum, v) => sum + v.priceLE, 0);

    // Get active sessions from MikroTik
    let activeUsers = 0;
    let routerConnected = false;

    try {
      const client = await getMikroTikClient();
      const sessions = await client.getActiveSessions();
      activeUsers = sessions.length;
      routerConnected = true;
    } catch {
      routerConnected = false;
    }

    const now = new Date();
    const updatedAtFormatted = `${now.getDate().toString().padStart(2, '0')}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    return json({
      activeUsers,
      availableVouchers,
      todayRevenue,
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
