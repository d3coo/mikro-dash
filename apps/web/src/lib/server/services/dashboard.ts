import { getMikroTikClient } from './mikrotik';
import { getVouchers, getVoucherStats, type Voucher } from './vouchers';
import { getActiveSessions, type ActiveSession } from './sessions';
import { getSettings } from '$lib/server/config';
import { getTodayPsRevenue, getStations, getActiveSessions as getPsActiveSessions } from './playstation';

export interface RouterHealth {
  cpuLoad: number;
  memoryUsed: number;
  memoryTotal: number;
  memoryPercent: number;
  uptime: string;
  version: string;
  boardName: string;
}

export interface DashboardStats {
  activeUsers: number;
  availableVouchers: number;
  usedVouchers: number;
  exhaustedVouchers: number;
  totalVouchers: number;
  todayRevenue: number;
  routerConnected: boolean;
  routerHealth: RouterHealth | null;
  // PlayStation stats
  psStations: number;
  psActiveSessions: number;
  psTodayRevenue: number;
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
  const settings = await getSettings();
  let routerConnected = false;
  let vouchers: Voucher[] = [];
  let activeSessions: ActiveSession[] = [];
  let routerHealth: RouterHealth | null = null;

  try {
    const client = getMikroTikClient();
    const resources = await client.getSystemResources();
    routerConnected = true;

    // Parse router health
    const freeMemory = parseInt(resources['free-memory']) || 0;
    const totalMemory = parseInt(resources['total-memory']) || 1;
    const memoryUsed = totalMemory - freeMemory;

    routerHealth = {
      cpuLoad: parseInt(resources['cpu-load']) || 0,
      memoryUsed,
      memoryTotal: totalMemory,
      memoryPercent: Math.round((memoryUsed / totalMemory) * 100),
      uptime: resources.uptime || '0s',
      version: resources.version || 'Unknown',
      boardName: resources['board-name'] || 'MikroTik'
    };

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

  // PlayStation stats
  const psStations = await getStations();
  const psActiveSessions = await getPsActiveSessions();
  const psTodayRevenue = await getTodayPsRevenue();

  return {
    stats: {
      activeUsers: activeSessions.length,
      availableVouchers: voucherStats.available,
      usedVouchers: voucherStats.used,
      exhaustedVouchers: voucherStats.exhausted,
      totalVouchers: vouchers.length,
      todayRevenue: voucherStats.revenue,
      routerConnected,
      routerHealth,
      // PlayStation stats
      psStations: psStations.length,
      psActiveSessions: psActiveSessions.length,
      psTodayRevenue: Math.round(psTodayRevenue / 100) // Convert to EGP
    },
    vouchers,
    activeSessions,
    businessName: settings.business.name
  };
}
