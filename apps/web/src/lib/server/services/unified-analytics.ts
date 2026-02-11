import {
  getActiveExpenses,
  getActivePsSessions,
  getPsSessionHistory,
  upsertUnifiedDailyStats,
  getUnifiedDailyStatsRange as convexGetUnifiedDailyStatsRange,
  type ConvexExpense,
  type ConvexUnifiedDailyStat
} from '$lib/server/convex';
import { getVouchers } from './vouchers';
import { getFnbSalesSummary } from './fnb-sales';
import { getBusinessDayDate, getBusinessDayStartMs, getBusinessDayEndMs, getBusinessDayDaysAgo } from './date-utils';

// ===== TYPES =====

export type BusinessSegment = 'wifi' | 'playstation' | 'fnb' | 'general';
export type TimePeriod = 'today' | 'week' | 'month' | 'custom';

export interface SegmentSummary {
  revenue: number;      // Piasters
  expenses: number;     // Piasters
  profit: number;       // Piasters
  contribution: number; // % of total revenue (0-100)
}

export interface WifiSegmentSummary extends SegmentSummary {
  vouchersSold: number;
  dataSoldGB: number;
  dataUsedGB: number;
}

export interface PlayStationSegmentSummary extends SegmentSummary {
  sessions: number;
  minutes: number;
}

export interface FnbSegmentSummary extends SegmentSummary {
  itemsSold: number;
  psOrdersRevenue: number;      // Revenue from PS session orders
  standaloneRevenue: number;    // Revenue from standalone F&B sales
}

export interface UnifiedAnalyticsSummary {
  period: {
    type: TimePeriod;
    start: string; // YYYY-MM-DD
    end: string;   // YYYY-MM-DD
    days: number;
  };
  segments: {
    wifi: WifiSegmentSummary;
    playstation: PlayStationSegmentSummary;
    fnb: FnbSegmentSummary;
  };
  totals: {
    revenue: number;       // Piasters - sum of all segment revenue
    expenses: number;      // Piasters - sum of all segment + general expenses
    grossProfit: number;   // Piasters - revenue - segment expenses
    netProfit: number;     // Piasters - gross profit - general expenses (prorated)
    generalExpenses: number; // Piasters - prorated general expenses
  };
  expensesByCategory: Record<BusinessSegment, number>; // Piasters
}

// ===== HELPER FUNCTIONS =====

function getTodayDate(): string {
  return getBusinessDayDate();
}

function getDateDaysAgo(days: number): string {
  return getBusinessDayDaysAgo(days);
}

function daysBetween(start: string, end: string): number {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end days
}

/**
 * Parse creation timestamp from voucher comment
 * Format: "pkg:ID|created:TIMESTAMP|Name"
 */
function parseCreatedAt(comment: string): number | null {
  const match = comment.match(/created:(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

// ===== EXPENSE QUERIES =====

/**
 * Get expenses grouped by category (from Convex)
 */
export async function getExpensesByCategory(): Promise<Record<BusinessSegment, ConvexExpense[]>> {
  const allExpenses = await getActiveExpenses();

  const result: Record<BusinessSegment, ConvexExpense[]> = {
    wifi: [],
    playstation: [],
    fnb: [],
    general: []
  };

  for (const expense of allExpenses) {
    const category = expense.category as BusinessSegment;
    if (result[category]) {
      result[category].push(expense);
    } else {
      result.general.push(expense);
    }
  }

  return result;
}

/**
 * Calculate total expenses for a category over a period
 */
export async function calculateCategoryExpenses(
  category: BusinessSegment,
  daysInPeriod: number
): Promise<number> {
  const allExpenses = await getActiveExpenses();
  const categoryExpenses = allExpenses.filter(e => e.category === category);

  let total = 0;
  for (const expense of categoryExpenses) {
    if (expense.type === 'fixed_monthly') {
      // Prorate monthly expenses
      total += Math.round((expense.amount / 30) * daysInPeriod);
    } else if (expense.type === 'per_gb') {
      // per_gb expenses are calculated based on actual usage, not here
      // This is handled in the WiFi segment calculation
    } else {
      // Other expense types (if any) - assume monthly
      total += Math.round((expense.amount / 30) * daysInPeriod);
    }
  }

  return total;
}

/**
 * Get cost per GB for WiFi (in piasters)
 */
async function getWifiCostPerGbPiasters(): Promise<number> {
  const allExpenses = await getActiveExpenses();
  const perGbExpense = allExpenses.find(
    e => e.type === 'per_gb' && e.category === 'wifi'
  );
  return perGbExpense?.amount || 0;
}

// ===== MAIN ANALYTICS FUNCTION =====

/**
 * Get unified analytics for a period
 */
export async function getUnifiedAnalytics(
  period: TimePeriod,
  customRange?: { start: string; end: string }
): Promise<UnifiedAnalyticsSummary> {
  // Determine date range
  let startDate: string;
  let endDate: string;

  if (period === 'custom' && customRange) {
    startDate = customRange.start;
    endDate = customRange.end;
  } else {
    endDate = getTodayDate();
    switch (period) {
      case 'today':
        startDate = endDate;
        break;
      case 'week':
        startDate = getDateDaysAgo(6);
        break;
      case 'month':
        startDate = getDateDaysAgo(29);
        break;
      default:
        startDate = endDate;
    }
  }

  const daysInPeriod = daysBetween(startDate, endDate);
  const startMs = getBusinessDayEndMs(startDate) - 24 * 60 * 60 * 1000; // Business day start
  const endMs = getBusinessDayEndMs(endDate) - 1; // End of business day

  // ===== WIFI SEGMENT =====
  const vouchers = await getVouchers();

  // Filter vouchers: either created in this period OR sold (used/exhausted) without timestamp
  const periodVouchers = vouchers.filter(v => {
    const createdAt = parseCreatedAt(v.comment);
    if (createdAt) {
      return createdAt >= startMs && createdAt <= endMs;
    } else {
      const isSold = v.status === 'used' || v.status === 'exhausted';
      const includesLegacy = endDate === getTodayDate();
      return isSold && includesLegacy;
    }
  });

  const wifiVouchersSold = periodVouchers.filter(v => v.status === 'used' || v.status === 'exhausted').length;
  const wifiRevenue = periodVouchers.filter(v => v.status === 'used' || v.status === 'exhausted')
    .reduce((sum, v) => sum + v.priceLE, 0) * 100; // Convert to piasters
  const wifiDataSoldBytes = periodVouchers.reduce((sum, v) => sum + v.bytesLimit, 0);
  const wifiDataUsedBytes = periodVouchers.reduce((sum, v) => sum + v.bytesTotal, 0);
  const wifiDataSoldGB = wifiDataSoldBytes / (1024 * 1024 * 1024);
  const wifiDataUsedGB = wifiDataUsedBytes / (1024 * 1024 * 1024);

  // WiFi expenses: per_gb cost based on data sold + fixed expenses
  const costPerGbPiasters = await getWifiCostPerGbPiasters();
  const wifiDataExpenses = Math.round(wifiDataSoldGB * costPerGbPiasters);
  const wifiFixedExpenses = await calculateCategoryExpenses('wifi', daysInPeriod);
  const wifiExpenses = wifiDataExpenses + wifiFixedExpenses;

  // ===== PLAYSTATION SEGMENT (Gaming Time Only) =====
  // Get completed PS sessions from Convex for the period
  const psHistory = await getPsSessionHistory({ startDate: startMs, endDate: endMs });

  let psGamingRevenue = 0;
  let psSessions_count = psHistory.length;
  let psMinutes = 0;
  let psOrdersRevenue = 0;
  let psOrdersItemCount = 0;

  for (const session of psHistory) {
    // Gaming revenue (totalCost is gaming cost only, set by end mutation)
    psGamingRevenue += session.totalCost || 0;

    // Duration in minutes
    const endedAt = session.endedAt ?? Date.now();
    const durationMs = endedAt - session.startedAt - (session.totalPausedMs || 0);
    psMinutes += Math.floor(durationMs / (1000 * 60));

    // Orders revenue from nested orders array
    for (const order of session.orders) {
      psOrdersRevenue += order.priceSnapshot * order.quantity;
      psOrdersItemCount += order.quantity;
    }
  }

  // For today, also include active sessions (gaming cost only, not orders)
  if (period === 'today' || endDate === getTodayDate()) {
    const activeSessions = await getActivePsSessions();
    for (const session of activeSessions) {
      const now = Date.now();
      const elapsedMs = now - session.startedAt - (session.totalPausedMs || 0);
      const minutes = Math.ceil(elapsedMs / (1000 * 60));
      psGamingRevenue += Math.round((session.hourlyRateSnapshot * minutes) / 60);
      psMinutes += Math.floor(elapsedMs / (1000 * 60));
    }
  }

  const psExpenses = await calculateCategoryExpenses('playstation', daysInPeriod);

  // ===== F&B SEGMENT (Combined: PS Orders + Standalone F&B) =====
  const fnbSummary = await getFnbSalesSummary(startMs, endMs);
  const standaloneRevenue = fnbSummary.totalRevenue;
  const standaloneItemsSold = fnbSummary.totalItemsSold;

  // Combined F&B revenue = PS session orders + standalone F&B
  const fnbTotalRevenue = psOrdersRevenue + standaloneRevenue;
  const fnbTotalItemsSold = psOrdersItemCount + standaloneItemsSold;
  const fnbExpenses = await calculateCategoryExpenses('fnb', daysInPeriod);

  // ===== GENERAL EXPENSES =====
  const generalExpenses = await calculateCategoryExpenses('general', daysInPeriod);

  // ===== CALCULATE TOTALS =====
  // Total revenue = WiFi + PS Gaming + F&B (which includes PS orders)
  const totalRevenue = wifiRevenue + psGamingRevenue + fnbTotalRevenue;
  const segmentExpenses = wifiExpenses + psExpenses + fnbExpenses;
  const totalExpenses = segmentExpenses + generalExpenses;
  const grossProfit = totalRevenue - segmentExpenses;
  const netProfit = grossProfit - generalExpenses;

  // Calculate contribution percentages
  const wifiContribution = totalRevenue > 0 ? Math.round((wifiRevenue / totalRevenue) * 100) : 0;
  const psContribution = totalRevenue > 0 ? Math.round((psGamingRevenue / totalRevenue) * 100) : 0;
  const fnbContribution = totalRevenue > 0 ? Math.round((fnbTotalRevenue / totalRevenue) * 100) : 0;

  return {
    period: {
      type: period,
      start: startDate,
      end: endDate,
      days: daysInPeriod
    },
    segments: {
      wifi: {
        revenue: wifiRevenue,
        expenses: wifiExpenses,
        profit: wifiRevenue - wifiExpenses,
        contribution: wifiContribution,
        vouchersSold: wifiVouchersSold,
        dataSoldGB: Math.round(wifiDataSoldGB * 100) / 100,
        dataUsedGB: Math.round(wifiDataUsedGB * 100) / 100
      },
      playstation: {
        revenue: psGamingRevenue,
        expenses: psExpenses,
        profit: psGamingRevenue - psExpenses,
        contribution: psContribution,
        sessions: psSessions_count,
        minutes: psMinutes
      },
      fnb: {
        revenue: fnbTotalRevenue,
        expenses: fnbExpenses,
        profit: fnbTotalRevenue - fnbExpenses,
        contribution: fnbContribution,
        itemsSold: fnbTotalItemsSold,
        psOrdersRevenue: psOrdersRevenue,
        standaloneRevenue: standaloneRevenue
      }
    },
    totals: {
      revenue: totalRevenue,
      expenses: totalExpenses,
      grossProfit,
      netProfit,
      generalExpenses
    },
    expensesByCategory: {
      wifi: wifiExpenses,
      playstation: psExpenses,
      fnb: fnbExpenses,
      general: generalExpenses
    }
  };
}

// ===== DAILY AGGREGATION =====

/**
 * Aggregate and save unified daily stats for a specific date
 * This should be called periodically (end of day, or on page load for today)
 */
export async function aggregateUnifiedDailyStats(date: string): Promise<ConvexUnifiedDailyStat | null> {
  const startMs = getBusinessDayEndMs(date) - 24 * 60 * 60 * 1000;
  const endMs = getBusinessDayEndMs(date) - 1;
  const today = getTodayDate();
  const isToday = date === today;

  // WiFi data from vouchers
  const vouchers = await getVouchers();
  const dayVouchers = vouchers.filter(v => {
    const createdAt = parseCreatedAt(v.comment);
    if (createdAt) {
      return createdAt >= startMs && createdAt <= endMs;
    } else {
      const isSold = v.status === 'used' || v.status === 'exhausted';
      return isSold && isToday;
    }
  });

  const soldVouchers = dayVouchers.filter(v => v.status === 'used' || v.status === 'exhausted');
  const wifiRevenue = soldVouchers.reduce((sum, v) => sum + v.priceLE, 0) * 100;
  const wifiVouchersSold = soldVouchers.length;
  const wifiDataSold = dayVouchers.reduce((sum, v) => sum + v.bytesLimit, 0);
  const wifiDataUsed = dayVouchers.reduce((sum, v) => sum + v.bytesTotal, 0);

  // PlayStation data from Convex session history
  const psHistory = await getPsSessionHistory({ startDate: startMs, endDate: endMs });

  let psGamingRevenue = 0;
  let psSessions_count = psHistory.length;
  let psMinutes_count = 0;
  let psOrdersRevenue = 0;

  for (const session of psHistory) {
    psGamingRevenue += session.totalCost || 0;

    const endedAt = session.endedAt ?? Date.now();
    const durationMs = endedAt - session.startedAt - (session.totalPausedMs || 0);
    psMinutes_count += Math.floor(durationMs / (1000 * 60));

    for (const order of session.orders) {
      psOrdersRevenue += order.priceSnapshot * order.quantity;
    }
  }

  // F&B standalone sales
  const fnbSummary = await getFnbSalesSummary(startMs, endMs);

  // Upsert via Convex
  await upsertUnifiedDailyStats({
    date,
    wifiRevenue,
    wifiVouchersSold,
    wifiDataSold,
    wifiDataUsed,
    psGamingRevenue,
    psSessions: psSessions_count,
    psMinutes: psMinutes_count,
    psOrdersRevenue,
    fnbRevenue: fnbSummary.totalRevenue,
    fnbItemsSold: fnbSummary.totalItemsSold,
  });

  // Return the upserted stat (re-fetch to get latest)
  const range = await convexGetUnifiedDailyStatsRange(date, date);
  return range[0] ?? null;
}

/**
 * Get historical unified daily stats for a date range
 */
export async function getUnifiedDailyStatsRange(startDate: string, endDate: string): Promise<ConvexUnifiedDailyStat[]> {
  return await convexGetUnifiedDailyStatsRange(startDate, endDate);
}

// ===== CHART DATA =====

export interface UnifiedChartPoint {
  date: string;
  label: string;
  wifi: number;
  playstation: number;
  fnb: number;
  total: number;
}

/**
 * Get revenue chart data by segment for a date range
 * PS = gaming only, F&B = PS orders + standalone F&B
 */
export async function getRevenueBySegmentChart(days: number): Promise<UnifiedChartPoint[]> {
  const data: UnifiedChartPoint[] = [];
  const vouchers = await getVouchers();
  const today = getTodayDate();

  // Batch fetch: get all PS history for the full range at once
  const rangeStartDate = getDateDaysAgo(days - 1);
  const rangeStart = getBusinessDayEndMs(rangeStartDate) - 24 * 60 * 60 * 1000;
  const rangeEnd = getBusinessDayEndMs(today) - 1;
  const allPsHistory = await getPsSessionHistory({ startDate: rangeStart, endDate: rangeEnd });

  for (let i = days - 1; i >= 0; i--) {
    const date = getDateDaysAgo(i);
    const dayStart = getBusinessDayEndMs(date) - 24 * 60 * 60 * 1000;
    const dayEnd = getBusinessDayEndMs(date) - 1;
    const isToday = date === today;

    // WiFi revenue - filter by creation date or include legacy vouchers for today
    const dayVouchers = vouchers.filter(v => {
      const createdAt = parseCreatedAt(v.comment);
      if (createdAt) {
        return createdAt >= dayStart && createdAt <= dayEnd;
      } else {
        const isSold = v.status === 'used' || v.status === 'exhausted';
        return isSold && isToday;
      }
    });
    const wifiRevenue = dayVouchers.filter(v => v.status === 'used' || v.status === 'exhausted')
      .reduce((sum, v) => sum + v.priceLE, 0) * 100;

    // PS data for this day (filter from batch result)
    const dayPsSessions = allPsHistory.filter(s => s.startedAt >= dayStart && s.startedAt <= dayEnd);

    let psGamingRevenue = 0;
    let psOrdersRevenue = 0;

    for (const session of dayPsSessions) {
      psGamingRevenue += session.totalCost || 0;
      for (const order of session.orders) {
        psOrdersRevenue += order.priceSnapshot * order.quantity;
      }
    }

    // Standalone F&B revenue
    const fnbSummary = await getFnbSalesSummary(dayStart, dayEnd);
    const standaloneRevenue = fnbSummary.totalRevenue;

    // Combined F&B = PS orders + standalone
    const fnbTotalRevenue = psOrdersRevenue + standaloneRevenue;

    const d = new Date(date);
    const label = `${d.getDate()}/${d.getMonth() + 1}`;

    data.push({
      date,
      label,
      wifi: wifiRevenue,
      playstation: psGamingRevenue,
      fnb: fnbTotalRevenue,
      total: wifiRevenue + psGamingRevenue + fnbTotalRevenue
    });
  }

  return data;
}

/**
 * Get profit by segment chart for a date range
 */
export async function getProfitBySegmentChart(days: number): Promise<UnifiedChartPoint[]> {
  const revenueData = await getRevenueBySegmentChart(days);
  const costPerGbPiasters = await getWifiCostPerGbPiasters();
  const vouchers = await getVouchers();
  const today = getTodayDate();

  return revenueData.map(point => {
    // Calculate WiFi data cost for that day
    const dayStart = getBusinessDayEndMs(point.date) - 24 * 60 * 60 * 1000;
    const dayEnd = getBusinessDayEndMs(point.date) - 1;
    const isToday = point.date === today;

    const dayVouchers = vouchers.filter(v => {
      const createdAt = parseCreatedAt(v.comment);
      if (createdAt) {
        return createdAt >= dayStart && createdAt <= dayEnd;
      } else {
        const isSold = v.status === 'used' || v.status === 'exhausted';
        return isSold && isToday;
      }
    });

    const wifiDataSoldBytes = dayVouchers.reduce((sum, v) => sum + v.bytesLimit, 0);
    const wifiDataSoldGB = wifiDataSoldBytes / (1024 * 1024 * 1024);
    const wifiDataCost = Math.round(wifiDataSoldGB * costPerGbPiasters);

    // Daily fixed expenses (prorated) - simplified: don't include in daily profit chart
    const wifiProfit = point.wifi - wifiDataCost;
    const psProfit = point.playstation; // No variable costs tracked
    const fnbProfit = point.fnb; // No variable costs tracked

    return {
      ...point,
      wifi: wifiProfit,
      playstation: psProfit,
      fnb: fnbProfit,
      total: wifiProfit + psProfit + fnbProfit
    };
  });
}

// ===== DATA MIGRATION =====

/**
 * Backfill unified_daily_stats from current data sources
 * Re-aggregates stats for each day in the range using Convex data
 */
export async function backfillUnifiedDailyStats(days: number = 90): Promise<{
  processed: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let processed = 0;

  // Process the last N days
  for (let i = 0; i < days; i++) {
    const date = getDateDaysAgo(i);
    try {
      await aggregateUnifiedDailyStats(date);
      processed++;
    } catch (error) {
      errors.push(`${date}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  console.log(`[Backfill] Processed ${processed} dates, ${errors.length} errors`);
  return { processed, errors };
}
