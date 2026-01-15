import { getMikroTikClient } from './mikrotik';
import { getVouchers, getVoucherStats, type Voucher } from './vouchers';
import { getActiveSessions, type ActiveSession } from './sessions';
import { getSettings } from '$lib/server/config';

export interface DashboardStats {
  activeUsers: number;
  availableVouchers: number;
  usedVouchers: number;
  exhaustedVouchers: number;
  totalVouchers: number;
  todayRevenue: number;
  routerConnected: boolean;
}

export interface DashboardData {
  stats: DashboardStats;
  vouchers: Voucher[];
  activeSessions: ActiveSession[];
  businessName: string;
}

/**
 * Get all dashboard data
 */
export async function getDashboardData(): Promise<DashboardData> {
  const settings = getSettings();
  let routerConnected = false;
  let vouchers: Voucher[] = [];
  let activeSessions: ActiveSession[] = [];

  try {
    const client = getMikroTikClient();
    await client.getSystemResources(); // Test connection
    routerConnected = true;

    // Fetch data in parallel
    [vouchers, activeSessions] = await Promise.all([
      getVouchers(),
      getActiveSessions()
    ]);
  } catch (error) {
    console.error('Failed to connect to router:', error);
    routerConnected = false;
  }

  // Calculate stats
  const voucherStats = {
    available: vouchers.filter(v => v.status === 'available').length,
    used: vouchers.filter(v => v.status === 'used').length,
    exhausted: vouchers.filter(v => v.status === 'exhausted').length,
    revenue: vouchers
      .filter(v => v.status === 'used' || v.status === 'exhausted')
      .reduce((sum, v) => sum + v.priceLE, 0)
  };

  return {
    stats: {
      activeUsers: activeSessions.length,
      availableVouchers: voucherStats.available,
      usedVouchers: voucherStats.used,
      exhaustedVouchers: voucherStats.exhausted,
      totalVouchers: vouchers.length,
      todayRevenue: voucherStats.revenue,
      routerConnected
    },
    vouchers,
    activeSessions,
    businessName: settings.business.name
  };
}
