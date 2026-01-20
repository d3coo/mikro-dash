import { db } from '$lib/server/db';
import { expenses, dailyStats, type Expense, type NewExpense, type DailyStat } from '$lib/server/db/schema';
import { eq, desc, and, gte, lte } from 'drizzle-orm';
import { getVouchers } from './vouchers';
import { getPackages } from '$lib/server/config';

// ===== EXPENSE MANAGEMENT =====

/**
 * Get all expenses
 */
export function getExpenses(): Expense[] {
  return db.select().from(expenses).orderBy(expenses.type, expenses.name).all();
}

/**
 * Get active expenses only
 */
export function getActiveExpenses(): Expense[] {
  return db.select().from(expenses).where(eq(expenses.isActive, 1)).all();
}

/**
 * Get expense by ID
 */
export function getExpenseById(id: number): Expense | undefined {
  return db.select().from(expenses).where(eq(expenses.id, id)).get();
}

/**
 * Create new expense
 */
export function createExpense(expense: {
  type: 'per_gb' | 'fixed_monthly';
  name: string;
  nameAr: string;
  amount: number;
}): Expense {
  const now = Date.now();
  const result = db.insert(expenses).values({
    type: expense.type,
    name: expense.name,
    nameAr: expense.nameAr,
    amount: expense.amount,
    isActive: 1,
    createdAt: now,
    updatedAt: now
  }).returning().get();
  return result;
}

/**
 * Update expense
 */
export function updateExpense(id: number, updates: Partial<{
  name: string;
  nameAr: string;
  amount: number;
  isActive: number;
}>): Expense | undefined {
  const now = Date.now();
  const result = db.update(expenses)
    .set({ ...updates, updatedAt: now })
    .where(eq(expenses.id, id))
    .returning()
    .get();
  return result;
}

/**
 * Delete expense
 */
export function deleteExpense(id: number): void {
  db.delete(expenses).where(eq(expenses.id, id)).run();
}

/**
 * Get cost per GB (in EGP)
 * Returns the per_gb expense amount converted from piasters to EGP
 */
export function getCostPerGb(): number {
  const perGbExpense = db.select()
    .from(expenses)
    .where(and(eq(expenses.type, 'per_gb'), eq(expenses.isActive, 1)))
    .get();

  // Amount is in piasters, convert to EGP
  return perGbExpense ? perGbExpense.amount / 100 : 0;
}

/**
 * Get total monthly fixed costs (in EGP)
 */
export function getMonthlyFixedCosts(): number {
  const fixedExpenses = db.select()
    .from(expenses)
    .where(and(eq(expenses.type, 'fixed_monthly'), eq(expenses.isActive, 1)))
    .all();

  // Sum amounts (in piasters) and convert to EGP
  const totalPiasters = fixedExpenses.reduce((sum, e) => sum + e.amount, 0);
  return totalPiasters / 100;
}

// ===== DAILY STATS =====

/**
 * Get today's date in YYYY-MM-DD format
 */
function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Get date N days ago in YYYY-MM-DD format
 */
function getDateDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
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
export function getDailyStats(date: string): DailyStat | undefined {
  return db.select().from(dailyStats).where(eq(dailyStats.date, date)).get();
}

/**
 * Get stats for a date range
 */
export function getStatsRange(startDate: string, endDate: string): DailyStat[] {
  return db.select()
    .from(dailyStats)
    .where(and(
      gte(dailyStats.date, startDate),
      lte(dailyStats.date, endDate)
    ))
    .orderBy(dailyStats.date)
    .all();
}

/**
 * Aggregate and save daily stats from current voucher data
 * This should be called periodically (on page load, scheduled, etc.)
 */
export async function aggregateTodayStats(): Promise<DailyStat> {
  const today = getTodayDate();
  const todayStart = new Date(today).getTime();
  const todayEnd = todayStart + 24 * 60 * 60 * 1000;

  const vouchers = await getVouchers();
  const packages = getPackages();

  // Find vouchers created today
  const todayVouchers = vouchers.filter(v => {
    const createdAt = parseCreatedAt(v.comment);
    return createdAt && createdAt >= todayStart && createdAt < todayEnd;
  });

  // Calculate metrics
  const vouchersSold = todayVouchers.length;
  const revenue = todayVouchers.reduce((sum, v) => sum + v.priceLE, 0);

  // Data sold: sum of bytes limits for sold vouchers
  const dataSold = todayVouchers.reduce((sum, v) => sum + v.bytesLimit, 0);

  // Data used: sum of actual bytes used by ALL vouchers (not just today's)
  // Only count used/exhausted vouchers
  const dataUsed = vouchers
    .filter(v => v.status === 'used' || v.status === 'exhausted')
    .reduce((sum, v) => sum + v.bytesTotal, 0);

  // Sales by package
  const salesByPackage: Record<string, number> = {};
  for (const v of todayVouchers) {
    const pkgId = v.packageId || 'unknown';
    salesByPackage[pkgId] = (salesByPackage[pkgId] || 0) + 1;
  }

  const now = Date.now();
  const statsData = {
    date: today,
    vouchersSold,
    revenue: revenue * 100, // Store in piasters
    dataSold,
    dataUsed,
    salesByPackage: JSON.stringify(salesByPackage),
    createdAt: now,
    updatedAt: now
  };

  // Upsert: update if exists, insert if not
  const existing = getDailyStats(today);
  if (existing) {
    const result = db.update(dailyStats)
      .set({ ...statsData, updatedAt: now })
      .where(eq(dailyStats.date, today))
      .returning()
      .get();
    return result!;
  } else {
    const result = db.insert(dailyStats).values(statsData).returning().get();
    return result;
  }
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
  const startMs = new Date(startDate).getTime();
  const endMs = new Date(endDate).getTime() + 24 * 60 * 60 * 1000; // End of day

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
  const costPerGb = getCostPerGb();
  const monthlyFixedCosts = getMonthlyFixedCosts();

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
    const dayStart = new Date(date).getTime();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;

    const dayVouchers = vouchers.filter(v => {
      const createdAt = parseCreatedAt(v.comment);
      return createdAt && createdAt >= dayStart && createdAt < dayEnd;
    });

    const revenue = dayVouchers.reduce((sum, v) => sum + v.priceLE, 0);

    // Format date label in Arabic style (day/month)
    const d = new Date(date);
    const label = `${d.getDate()}/${d.getMonth() + 1}`;

    data.push({ date, label, value: revenue });
  }

  return data;
}

/**
 * Get profit chart data for the last N days
 */
export async function getProfitChartData(days: number): Promise<ChartDataPoint[]> {
  const vouchers = await getVouchers();
  const costPerGb = getCostPerGb();
  const monthlyFixed = getMonthlyFixedCosts();
  const dailyFixed = monthlyFixed / 30;
  const data: ChartDataPoint[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = getDateDaysAgo(i);
    const dayStart = new Date(date).getTime();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;

    const dayVouchers = vouchers.filter(v => {
      const createdAt = parseCreatedAt(v.comment);
      return createdAt && createdAt >= dayStart && createdAt < dayEnd;
    });

    const revenue = dayVouchers.reduce((sum, v) => sum + v.priceLE, 0);
    const dataSoldBytes = dayVouchers.reduce((sum, v) => sum + v.bytesLimit, 0);
    const dataSoldGB = dataSoldBytes / (1024 * 1024 * 1024);
    const dataCost = dataSoldGB * costPerGb;
    const netProfit = revenue - dataCost - dailyFixed;

    const d = new Date(date);
    const label = `${d.getDate()}/${d.getMonth() + 1}`;

    data.push({ date, label, value: Math.round(netProfit * 100) / 100 });
  }

  return data;
}

/**
 * Get sales by package for the last N days
 */
export async function getSalesByPackageData(days: number): Promise<PackageSalesData[]> {
  const vouchers = await getVouchers();
  const packages = getPackages();
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
    const dayStart = new Date(date).getTime();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;

    const dayVouchers = vouchers.filter(v => {
      const createdAt = parseCreatedAt(v.comment);
      return createdAt && createdAt >= dayStart && createdAt < dayEnd;
    });

    const dataSoldBytes = dayVouchers.reduce((sum, v) => sum + v.bytesLimit, 0);
    const dataUsedBytes = dayVouchers.reduce((sum, v) => sum + v.bytesTotal, 0);

    const d = new Date(date);
    const label = `${d.getDate()}/${d.getMonth() + 1}`;

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
