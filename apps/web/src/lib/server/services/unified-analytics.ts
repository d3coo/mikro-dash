import { db } from '$lib/server/db';
import { expenses, dailyStats, psDailyStats, psSessions, unifiedDailyStats, fnbSales, psSessionOrders } from '$lib/server/db/schema';
import type { UnifiedDailyStat, Expense } from '$lib/server/db/schema';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import { getVouchers } from './vouchers';
import { getPackages } from '$lib/server/config';
import { getFnbSalesSummary, getTodayFnbRevenue } from './fnb-sales';
import { getActivePsSessions } from '$lib/server/convex';

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
  return new Date().toISOString().split('T')[0];
}

function getDateDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
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
 * Get expenses grouped by category
 */
export async function getExpensesByCategory(): Promise<Record<BusinessSegment, Expense[]>> {
  const allExpenses = await db.select()
    .from(expenses)
    .where(eq(expenses.isActive, 1));

  const result: Record<BusinessSegment, Expense[]> = {
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
  const categoryExpenses = await db.select()
    .from(expenses)
    .where(and(
      eq(expenses.isActive, 1),
      eq(expenses.category, category)
    ));

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
  const perGbExpenses = await db.select()
    .from(expenses)
    .where(and(
      eq(expenses.type, 'per_gb'),
      eq(expenses.isActive, 1),
      eq(expenses.category, 'wifi')
    ));

  return perGbExpenses[0]?.amount || 0;
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
  const startMs = new Date(startDate).getTime();
  const endMs = new Date(endDate).getTime() + 24 * 60 * 60 * 1000 - 1; // End of day

  // ===== WIFI SEGMENT =====
  const vouchers = await getVouchers();
  const packages = await getPackages();

  // Filter vouchers: either created in this period OR sold (used/exhausted) without timestamp
  // For vouchers with created: timestamp, filter by date
  // For vouchers without timestamp (legacy), count them if they're sold (used/exhausted)
  const periodVouchers = vouchers.filter(v => {
    const createdAt = parseCreatedAt(v.comment);
    if (createdAt) {
      // Has timestamp - filter by date range
      return createdAt >= startMs && createdAt <= endMs;
    } else {
      // No timestamp (legacy voucher) - count if sold and period is 'today' or includes today
      // For historical queries, we can't know when legacy vouchers were sold
      const isSold = v.status === 'used' || v.status === 'exhausted';
      const includesLegacy = endDate === getTodayDate(); // Only count legacy for current periods
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
  const psStats = await db.select()
    .from(psDailyStats)
    .where(and(
      gte(psDailyStats.date, startDate),
      lte(psDailyStats.date, endDate)
    ));

  // Sum up PS stats from daily records
  let psGamingRevenue = 0;
  let psSessions_count = 0;
  let psMinutes = 0;

  for (const stat of psStats) {
    psGamingRevenue += stat.totalRevenue;
    psSessions_count += stat.totalSessions;
    psMinutes += stat.totalMinutes;
  }

  // For today, also include active sessions (gaming cost only, not orders)
  if (period === 'today' || endDate === getTodayDate()) {
    const activeSessions = await getActivePsSessions();
    for (const session of activeSessions) {
      const now = Date.now();
      // Simple cost calculation: hourlyRate * minutes / 60
      const elapsedMs = now - session.startedAt - (session.totalPausedMs || 0);
      const minutes = Math.ceil(elapsedMs / (1000 * 60));
      psGamingRevenue += Math.round((session.hourlyRateSnapshot * minutes) / 60);
      psMinutes += Math.floor(elapsedMs / (1000 * 60));
    }
  }

  // Get PS orders revenue (F&B during sessions) - this will be moved to F&B segment
  const psOrders = await db.select()
    .from(psSessionOrders)
    .innerJoin(psSessions, eq(psSessionOrders.sessionId, psSessions.id))
    .where(and(
      gte(psSessions.startedAt, startMs),
      lte(psSessions.startedAt, endMs)
    ));

  const psOrdersRevenue = psOrders.reduce((sum, row) =>
    sum + (row.ps_session_orders.priceSnapshot * row.ps_session_orders.quantity), 0);
  const psOrdersItemCount = psOrders.reduce((sum, row) => sum + row.ps_session_orders.quantity, 0);

  // PS revenue is now GAMING ONLY (subtract any orders that were included in daily stats)
  // Daily stats totalRevenue may include orders, so we need to subtract them
  const psGamingOnlyRevenue = psGamingRevenue - psOrdersRevenue;
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
  const totalRevenue = wifiRevenue + psGamingOnlyRevenue + fnbTotalRevenue;
  const segmentExpenses = wifiExpenses + psExpenses + fnbExpenses;
  const totalExpenses = segmentExpenses + generalExpenses;
  const grossProfit = totalRevenue - segmentExpenses;
  const netProfit = grossProfit - generalExpenses;

  // Calculate contribution percentages
  const wifiContribution = totalRevenue > 0 ? Math.round((wifiRevenue / totalRevenue) * 100) : 0;
  const psContribution = totalRevenue > 0 ? Math.round((psGamingOnlyRevenue / totalRevenue) * 100) : 0;
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
        revenue: psGamingOnlyRevenue, // Gaming time only, NO orders
        expenses: psExpenses,
        profit: psGamingOnlyRevenue - psExpenses,
        contribution: psContribution,
        sessions: psSessions_count,
        minutes: psMinutes
      },
      fnb: {
        revenue: fnbTotalRevenue, // Combined: PS orders + standalone
        expenses: fnbExpenses,
        profit: fnbTotalRevenue - fnbExpenses,
        contribution: fnbContribution,
        itemsSold: fnbTotalItemsSold,
        psOrdersRevenue: psOrdersRevenue,      // Breakdown: PS session orders
        standaloneRevenue: standaloneRevenue   // Breakdown: Standalone F&B
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
export async function aggregateUnifiedDailyStats(date: string): Promise<UnifiedDailyStat> {
  const startMs = new Date(date).getTime();
  const endMs = startMs + 24 * 60 * 60 * 1000 - 1;
  const today = getTodayDate();
  const isToday = date === today;

  // WiFi data from vouchers
  const vouchers = await getVouchers();
  const dayVouchers = vouchers.filter(v => {
    const createdAt = parseCreatedAt(v.comment);
    if (createdAt) {
      return createdAt >= startMs && createdAt <= endMs;
    } else {
      // Legacy vouchers only counted for today's aggregation
      const isSold = v.status === 'used' || v.status === 'exhausted';
      return isSold && isToday;
    }
  });

  const soldVouchers = dayVouchers.filter(v => v.status === 'used' || v.status === 'exhausted');
  const wifiRevenue = soldVouchers.reduce((sum, v) => sum + v.priceLE, 0) * 100;
  const wifiVouchersSold = soldVouchers.length;
  const wifiDataSold = dayVouchers.reduce((sum, v) => sum + v.bytesLimit, 0);
  const wifiDataUsed = dayVouchers.reduce((sum, v) => sum + v.bytesTotal, 0);

  // PlayStation data from daily stats
  const psStatsResults = await db.select()
    .from(psDailyStats)
    .where(eq(psDailyStats.date, date));
  const psStats = psStatsResults[0];

  const psGamingRevenue = psStats?.totalRevenue || 0;
  const psSessions_count = psStats?.totalSessions || 0;
  const psMinutes_count = psStats?.totalMinutes || 0;

  // PS orders for that day
  const psOrders = await db.select()
    .from(psSessionOrders)
    .innerJoin(psSessions, eq(psSessionOrders.sessionId, psSessions.id))
    .where(and(
      gte(psSessions.startedAt, startMs),
      lte(psSessions.startedAt, endMs)
    ));

  const psOrdersRevenue = psOrders.reduce((sum, row) =>
    sum + (row.ps_session_orders.priceSnapshot * row.ps_session_orders.quantity), 0);

  // F&B standalone sales
  const fnbSummary = await getFnbSalesSummary(startMs, endMs);

  const now = Date.now();
  const statsData = {
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
    createdAt: now,
    updatedAt: now
  };

  // Upsert
  const existingResults = await db.select()
    .from(unifiedDailyStats)
    .where(eq(unifiedDailyStats.date, date));
  const existing = existingResults[0];

  if (existing) {
    const result = await db.update(unifiedDailyStats)
      .set({ ...statsData, updatedAt: now })
      .where(eq(unifiedDailyStats.date, date))
      .returning();
    return result[0]!;
  } else {
    const result = await db.insert(unifiedDailyStats)
      .values(statsData)
      .returning();
    return result[0];
  }
}

/**
 * Get historical unified daily stats for a date range
 */
export async function getUnifiedDailyStatsRange(startDate: string, endDate: string): Promise<UnifiedDailyStat[]> {
  return await db.select()
    .from(unifiedDailyStats)
    .where(and(
      gte(unifiedDailyStats.date, startDate),
      lte(unifiedDailyStats.date, endDate)
    ))
    .orderBy(unifiedDailyStats.date);
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

  for (let i = days - 1; i >= 0; i--) {
    const date = getDateDaysAgo(i);
    const dayStart = new Date(date).getTime();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000 - 1;
    const isToday = date === today;

    // WiFi revenue - filter by creation date or include legacy vouchers for today
    const dayVouchers = vouchers.filter(v => {
      const createdAt = parseCreatedAt(v.comment);
      if (createdAt) {
        return createdAt >= dayStart && createdAt <= dayEnd;
      } else {
        // Legacy vouchers (no timestamp) only counted for today
        const isSold = v.status === 'used' || v.status === 'exhausted';
        return isSold && isToday;
      }
    });
    const wifiRevenue = dayVouchers.filter(v => v.status === 'used' || v.status === 'exhausted')
      .reduce((sum, v) => sum + v.priceLE, 0) * 100;

    // PS revenue from daily stats (total includes orders)
    const psStatsResults = await db.select()
      .from(psDailyStats)
      .where(eq(psDailyStats.date, date));
    const psStats = psStatsResults[0];
    const psTotalRevenue = psStats?.totalRevenue || 0;

    // Get PS orders for that day to subtract from PS total
    const psOrders = await db.select()
      .from(psSessionOrders)
      .innerJoin(psSessions, eq(psSessionOrders.sessionId, psSessions.id))
      .where(and(
        gte(psSessions.startedAt, dayStart),
        lte(psSessions.startedAt, dayEnd)
      ));

    const psOrdersRevenue = psOrders.reduce((sum, row) =>
      sum + (row.ps_session_orders.priceSnapshot * row.ps_session_orders.quantity), 0);

    // PS gaming only = total - orders
    const psGamingRevenue = psTotalRevenue - psOrdersRevenue;

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
      playstation: psGamingRevenue, // Gaming only
      fnb: fnbTotalRevenue,          // PS orders + standalone
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
    const dayStart = new Date(point.date).getTime();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000 - 1;
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
 * Backfill unified_daily_stats from existing daily_stats and ps_daily_stats tables
 * This should be run once after deploying the unified analytics system
 */
export async function backfillUnifiedDailyStats(days: number = 90): Promise<{
  processed: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let processed = 0;

  // Get all unique dates from both tables
  const wifiStats = await db.select().from(dailyStats);
  const psStatsList = await db.select().from(psDailyStats);

  const allDates = new Set<string>();
  for (const stat of wifiStats) {
    allDates.add(stat.date);
  }
  for (const stat of psStatsList) {
    allDates.add(stat.date);
  }

  // Also add dates from the last N days to ensure recent coverage
  for (let i = 0; i < days; i++) {
    allDates.add(getDateDaysAgo(i));
  }

  // Process each date
  const sortedDates = Array.from(allDates).sort();
  for (const date of sortedDates) {
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
