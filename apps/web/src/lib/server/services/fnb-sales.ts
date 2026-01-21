import { db } from '$lib/server/db';
import { fnbSales, psMenuItems } from '$lib/server/db/schema';
import type { FnbSale, NewFnbSale, PsMenuItem } from '$lib/server/db/schema';
import { eq, desc, and, gte, lte } from 'drizzle-orm';

// ===== F&B SALE TYPES =====

export interface FnbSaleWithItem extends FnbSale {
  menuItem: PsMenuItem | null;
}

// ===== CRUD OPERATIONS =====

/**
 * Record a standalone F&B sale (not tied to PlayStation session)
 */
export function recordFnbSale(menuItemId: number, quantity: number = 1): FnbSale {
  const menuItem = db.select().from(psMenuItems).where(eq(psMenuItems.id, menuItemId)).get();
  if (!menuItem) throw new Error(`Menu item ${menuItemId} not found`);
  if (!menuItem.isAvailable) throw new Error(`Menu item ${menuItem.nameAr} is not available`);

  const now = Date.now();
  const result = db.insert(fnbSales).values({
    menuItemId,
    quantity,
    priceSnapshot: menuItem.price,
    soldAt: now,
    createdAt: now
  }).returning().get();

  return result;
}

/**
 * Get F&B sales with optional date range filter
 */
export function getFnbSales(options?: {
  startDate?: number;
  endDate?: number;
  limit?: number;
}): FnbSaleWithItem[] {
  const conditions = [];

  if (options?.startDate) {
    conditions.push(gte(fnbSales.soldAt, options.startDate));
  }
  if (options?.endDate) {
    conditions.push(lte(fnbSales.soldAt, options.endDate));
  }

  let query = db.select().from(fnbSales);

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }

  const sales = query.orderBy(desc(fnbSales.soldAt)).all();

  // Apply limit after fetching (drizzle quirk)
  const limitedSales = options?.limit ? sales.slice(0, options.limit) : sales;

  // Join with menu items
  return limitedSales.map(sale => ({
    ...sale,
    menuItem: db.select().from(psMenuItems).where(eq(psMenuItems.id, sale.menuItemId)).get() || null
  }));
}

/**
 * Get today's F&B sales
 */
export function getTodayFnbSales(): FnbSaleWithItem[] {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  return getFnbSales({ startDate: todayStart.getTime() });
}

/**
 * Get today's F&B revenue in piasters
 */
export function getTodayFnbRevenue(): number {
  const sales = getTodayFnbSales();
  return sales.reduce((sum, sale) => sum + (sale.priceSnapshot * sale.quantity), 0);
}

/**
 * Delete a F&B sale (for correcting mistakes)
 */
export function deleteFnbSale(id: number): void {
  const sale = db.select().from(fnbSales).where(eq(fnbSales.id, id)).get();
  if (!sale) throw new Error(`F&B sale ${id} not found`);

  db.delete(fnbSales).where(eq(fnbSales.id, id)).run();
}

/**
 * Get F&B sale by ID
 */
export function getFnbSaleById(id: number): FnbSale | undefined {
  return db.select().from(fnbSales).where(eq(fnbSales.id, id)).get();
}

// ===== ANALYTICS =====

/**
 * Get F&B sales summary for a date range
 */
export function getFnbSalesSummary(startDate: number, endDate: number): {
  totalRevenue: number;
  totalItemsSold: number;
  salesByCategory: Record<string, { count: number; revenue: number }>;
} {
  const sales = getFnbSales({ startDate, endDate });

  let totalRevenue = 0;
  let totalItemsSold = 0;
  const salesByCategory: Record<string, { count: number; revenue: number }> = {};

  for (const sale of sales) {
    const saleTotal = sale.priceSnapshot * sale.quantity;
    totalRevenue += saleTotal;
    totalItemsSold += sale.quantity;

    const category = sale.menuItem?.category || 'unknown';
    if (!salesByCategory[category]) {
      salesByCategory[category] = { count: 0, revenue: 0 };
    }
    salesByCategory[category].count += sale.quantity;
    salesByCategory[category].revenue += saleTotal;
  }

  return {
    totalRevenue,
    totalItemsSold,
    salesByCategory
  };
}
