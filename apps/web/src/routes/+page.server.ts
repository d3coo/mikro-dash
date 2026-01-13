import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { vouchers } from '$lib/server/db/schema';
import { getMikroTikClient, getSetting } from '$lib/server/services/settings';

export const load: PageServerLoad = async () => {
  const allVouchers = db.select().from(vouchers).all();
  const availableVouchers = allVouchers.filter(v => v.status === 'available').length;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString();

  const usedToday = allVouchers.filter(
    v => v.status === 'used' && v.usedAt && v.usedAt >= todayISO
  );
  const todayRevenue = usedToday.reduce((sum, v) => sum + v.priceLE, 0);

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

  const businessName = await getSetting('business_name');

  return {
    stats: {
      activeUsers,
      availableVouchers,
      todayRevenue,
      routerConnected
    },
    businessName
  };
};
