import { getMikroTikClient } from './mikrotik';
import { getVouchersWithFallback, type Voucher } from './vouchers';
import { getActiveSessions, type ActiveSession } from './sessions';
import { getSettings } from '$lib/server/config';
import { getPsStations, getActivePsSessions, getTodayPsAnalytics } from '$lib/server/convex';
import { getCachedSessions } from './voucher-cache';

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
  let settings;
  try {
    settings = await getSettings();
  } catch (error) {
    console.error('Failed to get settings from Convex, using defaults:', error);
    settings = {
      mikrotik: { host: '192.168.1.109', user: 'admin', pass: 'need4speed' },
      business: { name: 'AboYassen WiFi' },
      wifi: { ssid: 'AboYassen' }
    };
  }
  let routerConnected = false;
  let vouchers: Voucher[] = [];
  let activeSessions: ActiveSession[] = [];
  let routerHealth: RouterHealth | null = null;

  // Fetch router data and PS stats in parallel
  const [voucherResult, routerResult, psResult] = await Promise.all([
    // Vouchers (router + cache fallback)
    getVouchersWithFallback().catch(error => {
      console.error('Failed to get vouchers:', error);
      return null;
    }),
    // Router health + active sessions
    (async () => {
      const client = await getMikroTikClient();
      const [resources, sessions] = await Promise.all([
        client.getSystemResources(),
        getActiveSessions()
      ]);
      return { resources, sessions };
    })().catch(error => {
      console.error('Failed to get router health/sessions:', error);
      return null;
    }),
    // PlayStation stats (local SQLite — instant)
    Promise.all([getPsStations(), getActivePsSessions(), getTodayPsAnalytics()]).catch(error => {
      console.error('Failed to get PlayStation stats:', error);
      return null;
    })
  ]);

  if (voucherResult) {
    vouchers = voucherResult.vouchers;
    routerConnected = voucherResult.source === 'router';
  }

  if (routerResult) {
    const { resources, sessions } = routerResult;
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
    activeSessions = sessions;
  } else {
    // Fallback: use cached sessions if available
    try {
      const cached = await getCachedSessions();
      if (cached) {
        activeSessions = cached.map(s => ({
          id: s.id,
          user: s.voucherCode,
          address: s.ipAddress || '',
          macAddress: s.macAddress || '',
          bytesIn: s.bytesIn,
          bytesOut: s.bytesOut,
          uptime: s.uptime || '0s',
          deviceName: undefined
        }));
      }
    } catch (cacheError) {
      console.error('Failed to get cached sessions:', cacheError);
    }
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
  let psStationsCount = 0;
  let psActiveSessionsCount = 0;
  let psTodayRevenueValue = 0;

  if (psResult) {
    const [psStations, psActiveSessions, psAnalytics] = psResult;
    psStationsCount = psStations.length;
    psActiveSessionsCount = psActiveSessions.length;
    psTodayRevenueValue = psAnalytics.totalRevenue;
  }

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
      psStations: psStationsCount,
      psActiveSessions: psActiveSessionsCount,
      psTodayRevenue: Math.round(psTodayRevenueValue / 100) // Convert to EGP
    },
    vouchers,
    activeSessions,
    businessName: settings.business.name
  };
}
