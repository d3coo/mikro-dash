import {
  getExpenses as convexGetExpenses,
  getActiveExpenses as convexGetActiveExpenses,
  createExpense as convexCreateExpense,
  updateExpense as convexUpdateExpense,
  deleteExpense as convexDeleteExpense,
  getUnifiedDailyStatsByDate,
  getUnifiedDailyStatsRange,
  upsertUnifiedDailyStats,
  type ConvexExpense,
  type ConvexUnifiedDailyStat
} from '$lib/server/convex';
import { getVouchers } from './vouchers';
import { getPackages } from '$lib/server/config';
import { getBusinessDayDate, getBusinessDayStartMs, getBusinessDayEndMs, getBusinessDayDaysAgo } from './date-utils';

// ===== EXPENSE MANAGEMENT =====

export type ExpenseCategory = 'wifi' | 'playstation' | 'fnb' | 'general';

/**
 * Get all expenses
 */
export async function getExpenses(): Promise<ConvexExpense[]> {
  return await convexGetExpenses();
}

/**
 * Get active expenses only
 */
export async function getActiveExpenses(): Promise<ConvexExpense[]> {
  return await convexGetActiveExpenses();
}

/**
 * Get expenses filtered by category
 */
export async function getExpensesByCategory(category?: ExpenseCategory): Promise<ConvexExpense[]> {
  if (category) {
    const all = await convexGetExpenses();
    return all.filter(e => e.category === category);
  }
  return await getExpenses();
}

/**
 * Get expense by ID (now string _id from Convex)
 */
export async function getExpenseById(id: string): Promise<ConvexExpense | undefined> {
  const all = await convexGetExpenses();
  return all.find(e => e._id === id);
}

/**
 * Create new expense
 */
export async function createExpense(expense: {
  type: 'per_gb' | 'fixed_monthly';
  category?: ExpenseCategory;
  name: string;
  nameAr: string;
  amount: number;
}): Promise<ConvexExpense> {
  const category = expense.category || (expense.type === 'per_gb' ? 'wifi' : 'general');

  const id = await convexCreateExpense({
    type: expense.type,
    category,
    name: expense.name,
    nameAr: expense.nameAr,
    amount: expense.amount,
    isActive: true,
  });

  // Return the created expense
  const all = await convexGetExpenses();
  return all.find(e => e._id === id)!;
}

/**
 * Update expense (id is now string)
 */
export async function updateExpense(id: string, updates: Partial<{
  name: string;
  nameAr: string;
  amount: number;
  category: ExpenseCategory;
  isActive: boolean;
}>): Promise<ConvexExpense | undefined> {
  await convexUpdateExpense(id, updates);

  // Return updated expense
  const all = await convexGetExpenses();
  return all.find(e => e._id === id);
}

/**
 * Delete expense (id is now string)
 */
export async function deleteExpense(id: string): Promise<void> {
  await convexDeleteExpense(id);
}

/**
 * Get cost per GB (in EGP)
 * Returns the per_gb expense amount converted from piasters to EGP
 */
export async function getCostPerGb(): Promise<number> {
  const active = await convexGetActiveExpenses();
  const perGbExpense = active.find(e => e.type === 'per_gb');

  // Amount is in piasters, convert to EGP
  return perGbExpense ? perGbExpense.amount / 100 : 0;
}

/**
 * Get total monthly fixed costs (in EGP)
 */
export async function getMonthlyFixedCosts(): Promise<number> {
  const active = await convexGetActiveExpenses();
  const fixedExpenses = active.filter(e => e.type === 'fixed_monthly');

  // Sum amounts (in piasters) and convert to EGP
  const totalPiasters = fixedExpenses.reduce((sum, e) => sum + e.amount, 0);
  return totalPiasters / 100;
}

// ===== DAILY STATS =====

/**
 * Get today's business day date in YYYY-MM-DD format (Cairo time, 10 AM reset)
 */
function getTodayDate(): string {
  return getBusinessDayDate();
}

/**
 * Get business day date N days ago in YYYY-MM-DD format
 */
function getDateDaysAgo(days: number): string {
  return getBusinessDayDaysAgo(days);
}

/**
 * Parse creation timestamp from voucher comment
 * Format: "pkg:ID|created:TIMESTAMP|Name"
 */
function parseCreatedAt(comment: string): number | null {
  const match = comment.match(/created:(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Get daily stats for a specific date
 */
export async function getDailyStats(date: string): Promise<ConvexUnifiedDailyStat | null> {
  return await getUnifiedDailyStatsByDate(date);
}

/**
 * Get stats for a date range
 */
export async function getStatsRange(startDate: string, endDate: string): Promise<ConvexUnifiedDailyStat[]> {
  return await getUnifiedDailyStatsRange(startDate, endDate);
}

/**
 * Aggregate and save daily stats from current voucher data
 * This should be called periodically (on page load, scheduled, etc.)
 */
export async function aggregateTodayStats(): Promise<ConvexUnifiedDailyStat | null> {
  const today = getTodayDate();
  const todayStart = getBusinessDayStartMs();
  const todayEnd = getBusinessDayEndMs(today);

  const vouchers = await getVouchers();

  // Find vouchers created today
  const todayVouchers = vouchers.filter(v => {
    const createdAt = parseCreatedAt(v.comment);
    return createdAt && createdAt >= todayStart && createdAt < todayEnd;
  });

  // Calculate metrics
  const wifiVouchersSold = todayVouchers.length;
  const wifiRevenue = todayVouchers.reduce((sum, v) => sum + v.priceLE, 0) * 100; // Store in piasters

  // Data sold: sum of bytes limits for sold vouchers
  const wifiDataSold = todayVouchers.reduce((sum, v) => sum + v.bytesLimit, 0);

  // Data used: sum of actual bytes used by ALL vouchers (not just today's)
  // Only count used/exhausted vouchers
  const wifiDataUsed = vouchers
    .filter(v => v.status === 'used' || v.status === 'exhausted')
    .reduce((sum, v) => sum + v.bytesTotal, 0);

  await upsertUnifiedDailyStats({
    date: today,
    wifiVouchersSold,
    wifiRevenue,
    wifiDataSold,
    wifiDataUsed,
  });

  return await getUnifiedDailyStatsByDate(today);
}

// ===== ANALYTICS SUMMARIES =====

export interface AnalyticsSummary {
  period: 'today' | 'week' | 'month';
  vouchersSold: number;
  revenue: number;          // In EGP
  dataSoldGB: number;
  dataUsedGB: number;
  grossProfit: number;      // Revenue - data costs
  netProfit: number;        // Gross profit - fixed costs (prorated)
  salesByPackage: Record<string, number>;
}

/**
 * Calculate analytics summary for a period
 */
async function calculateSummary(
  period: 'today' | 'week' | 'month',
  startDate: string,
  endDate: string,
  daysInPeriod: number
): Promise<AnalyticsSummary> {
  const vouchers = await getVouchers();
  const startMs = getBusinessDayEndMs(startDate) - 24 * 60 * 60 * 1000; // Start of business day
  const endMs = getBusinessDayEndMs(endDate); // End of business day

  // Filter vouchers created in this period
  const periodVouchers = vouchers.filter(v => {
    const createdAt = parseCreatedAt(v.comment);
    return createdAt && createdAt >= startMs && createdAt < endMs;
  });

  const vouchersSold = periodVouchers.length;
  const revenue = periodVouchers.reduce((sum, v) => sum + v.priceLE, 0);
  const dataSoldBytes = periodVouchers.reduce((sum, v) => sum + v.bytesLimit, 0);

  // Data used by vouchers created in this period
  const dataUsedBytes = periodVouchers.reduce((sum, v) => sum + v.bytesTotal, 0);

  // Convert bytes to GB
  const dataSoldGB = dataSoldBytes / (1024 * 1024 * 1024);
  const dataUsedGB = dataUsedBytes / (1024 * 1024 * 1024);

  // Get costs
  const costPerGb = await getCostPerGb();
  const monthlyFixedCosts = await getMonthlyFixedCosts();

  // Calculate profit based on data SOLD (not data used)
  // This reflects the actual cost of the vouchers sold
  const dataCost = dataSoldGB * costPerGb;
  const grossProfit = revenue - dataCost;

  // Prorate fixed costs
  const dailyFixedCost = monthlyFixedCosts / 30;
  const periodFixedCost = dailyFixedCost * daysInPeriod;
  const netProfit = grossProfit - periodFixedCost;

  // Sales by package
  const salesByPackage: Record<string, number> = {};
  for (const v of periodVouchers) {
    const pkgId = v.packageId || 'unknown';
    salesByPackage[pkgId] = (salesByPackage[pkgId] || 0) + 1;
  }

  return {
    period,
    vouchersSold,
    revenue,
    dataSoldGB: Math.round(dataSoldGB * 100) / 100,
    dataUsedGB: Math.round(dataUsedGB * 100) / 100,
    grossProfit: Math.round(grossProfit * 100) / 100,
    netProfit: Math.round(netProfit * 100) / 100,
    salesByPackage
  };
}

/**
 * Get today's analytics
 */
export async function getTodayStats(): Promise<AnalyticsSummary> {
  const today = getTodayDate();
  return calculateSummary('today', today, today, 1);
}

/**
 * Get this week's analytics (last 7 days)
 */
export async function getWeekStats(): Promise<AnalyticsSummary> {
  const today = getTodayDate();
  const weekAgo = getDateDaysAgo(6); // Today + 6 days = 7 days
  return calculateSummary('week', weekAgo, today, 7);
}

/**
 * Get this month's analytics (last 30 days)
 */
export async function getMonthStats(): Promise<AnalyticsSummary> {
  const today = getTodayDate();
  const monthAgo = getDateDaysAgo(29); // Today + 29 days = 30 days
  return calculateSummary('month', monthAgo, today, 30);
}

// ===== CHART DATA =====

export interface ChartDataPoint {
  date: string;
  label: string;
  value: number;
}

export interface PackageSalesData {
  packageId: string;
  packageName: string;
  count: number;
  revenue: number;
}

export interface DataUsagePoint {
  date: string;
  label: string;
  sold: number;  // GB
  used: number;  // GB
}

/**
 * Get revenue chart data for the last N days
 */
export async function getRevenueChartData(days: number): Promise<ChartDataPoint[]> {
  const vouchers = await getVouchers();
  const data: ChartDataPoint[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = getDateDaysAgo(i);
    const dayStart = getBusinessDayEndMs(date) - 24 * 60 * 60 * 1000;
    const dayEnd = getBusinessDayEndMs(date);

    const dayVouchers = vouchers.filter(v => {
      const createdAt = parseCreatedAt(v.comment);
      return createdAt && createdAt >= dayStart && createdAt < dayEnd;
    });

    const revenue = dayVouchers.reduce((sum, v) => sum + v.priceLE, 0);

    // Format date label in Arabic style (day/month)
    const [y, m, d] = date.split('-').map(Number);
    const label = `${d}/${m}`;

    data.push({ date, label, value: revenue });
  }

  return data;
}

/**
 * Get profit chart data for the last N days
 */
export async function getProfitChartData(days: number): Promise<ChartDataPoint[]> {
  const vouchers = await getVouchers();
  const costPerGb = await getCostPerGb();
  const monthlyFixed = await getMonthlyFixedCosts();
  const dailyFixed = monthlyFixed / 30;
  const data: ChartDataPoint[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = getDateDaysAgo(i);
    const dayStart = getBusinessDayEndMs(date) - 24 * 60 * 60 * 1000;
    const dayEnd = getBusinessDayEndMs(date);

    const dayVouchers = vouchers.filter(v => {
      const createdAt = parseCreatedAt(v.comment);
      return createdAt && createdAt >= dayStart && createdAt < dayEnd;
    });

    const revenue = dayVouchers.reduce((sum, v) => sum + v.priceLE, 0);
    const dataSoldBytes = dayVouchers.reduce((sum, v) => sum + v.bytesLimit, 0);
    const dataSoldGB = dataSoldBytes / (1024 * 1024 * 1024);
    const dataCost = dataSoldGB * costPerGb;
    const netProfit = revenue - dataCost - dailyFixed;

    const [y, m, d] = date.split('-').map(Number);
    const label = `${d}/${m}`;

    data.push({ date, label, value: Math.round(netProfit * 100) / 100 });
  }

  return data;
}

/**
 * Get sales by package for the last N days
 */
export async function getSalesByPackageData(days: number): Promise<PackageSalesData[]> {
  const vouchers = await getVouchers();
  const packages = await getPackages();
  const startDate = getDateDaysAgo(days - 1);
  const startMs = new Date(startDate).getTime();

  // Filter to period
  const periodVouchers = vouchers.filter(v => {
    const createdAt = parseCreatedAt(v.comment);
    return createdAt && createdAt >= startMs;
  });

  // Group by package
  const salesMap = new Map<string, { count: number; revenue: number }>();
  for (const v of periodVouchers) {
    const pkgId = v.packageId || 'unknown';
    const existing = salesMap.get(pkgId) || { count: 0, revenue: 0 };
    salesMap.set(pkgId, {
      count: existing.count + 1,
      revenue: existing.revenue + v.priceLE
    });
  }

  // Convert to array with package names
  return Array.from(salesMap.entries()).map(([pkgId, data]) => {
    const pkg = packages.find(p => p.id === pkgId);
    return {
      packageId: pkgId,
      packageName: pkg?.nameAr || pkgId,
      count: data.count,
      revenue: data.revenue
    };
  }).sort((a, b) => b.count - a.count); // Sort by count descending
}

/**
 * Get data usage comparison (sold vs used) for the last N days
 */
export async function getDataUsageComparison(days: number): Promise<DataUsagePoint[]> {
  const vouchers = await getVouchers();
  const data: DataUsagePoint[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = getDateDaysAgo(i);
    const dayStart = getBusinessDayEndMs(date) - 24 * 60 * 60 * 1000;
    const dayEnd = getBusinessDayEndMs(date);

    const dayVouchers = vouchers.filter(v => {
      const createdAt = parseCreatedAt(v.comment);
      return createdAt && createdAt >= dayStart && createdAt < dayEnd;
    });

    const dataSoldBytes = dayVouchers.reduce((sum, v) => sum + v.bytesLimit, 0);
    const dataUsedBytes = dayVouchers.reduce((sum, v) => sum + v.bytesTotal, 0);

    const [y, m, d] = date.split('-').map(Number);
    const label = `${d}/${m}`;

    data.push({
      date,
      label,
      sold: Math.round(dataSoldBytes / (1024 * 1024 * 1024) * 100) / 100,
      used: Math.round(dataUsedBytes / (1024 * 1024 * 1024) * 100) / 100
    });
  }

  return data;
}

/**
 * Get full analytics data for the UI
 */
export async function getAnalyticsData(period: 'today' | 'week' | 'month' = 'today') {
  // Aggregate today's stats first
  await aggregateTodayStats();

  // Get summary based on period
  let summary: AnalyticsSummary;
  let chartDays: number;

  switch (period) {
    case 'today':
      summary = await getTodayStats();
      chartDays = 7; // Show last 7 days for context
      break;
    case 'week':
      summary = await getWeekStats();
      chartDays = 7;
      break;
    case 'month':
      summary = await getMonthStats();
      chartDays = 30;
      break;
  }

  // Get chart data
  const [revenue, profit, salesByPackage, dataUsage] = await Promise.all([
    getRevenueChartData(chartDays),
    getProfitChartData(chartDays),
    getSalesByPackageData(chartDays),
    getDataUsageComparison(chartDays)
  ]);

  return {
    summary,
    charts: {
      revenue,
      profit,
      salesByPackage,
      dataUsage
    }
  };
}
