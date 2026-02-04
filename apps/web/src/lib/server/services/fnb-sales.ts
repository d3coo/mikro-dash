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
export async function recordFnbSale(menuItemId: number, quantity: number = 1): Promise<FnbSale> {
  const menuItemResults = await db.select().from(psMenuItems).where(eq(psMenuItems.id, menuItemId));
  const menuItem = menuItemResults[0];
  if (!menuItem) throw new Error(`Menu item ${menuItemId} not found`);
  if (!menuItem.isAvailable) throw new Error(`Menu item ${menuItem.nameAr} is not available`);

  const now = Date.now();
  const result = await db.insert(fnbSales).values({
    menuItemId,
    quantity,
    priceSnapshot: menuItem.price,
    soldAt: now,
    createdAt: now
  }).returning();

  return result[0];
}

/**
 * Get F&B sales with optional date range filter
 */
export async function getFnbSales(options?: {
  startDate?: number;
  endDate?: number;
  limit?: number;
}): Promise<FnbSaleWithItem[]> {
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

  const sales = await query.orderBy(desc(fnbSales.soldAt));

  // Apply limit after fetching (drizzle quirk)
  const limitedSales = options?.limit ? sales.slice(0, options.limit) : sales;

  // Join with menu items
  const salesWithItems: FnbSaleWithItem[] = [];
  for (const sale of limitedSales) {
    const menuItemResults = await db.select().from(psMenuItems).where(eq(psMenuItems.id, sale.menuItemId));
    salesWithItems.push({
      ...sale,
      menuItem: menuItemResults[0] || null
    });
  }

  return salesWithItems;
}

/**
 * Get today's F&B sales
 */
export async function getTodayFnbSales(): Promise<FnbSaleWithItem[]> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  return await getFnbSales({ startDate: todayStart.getTime() });
}

/**
 * Get today's F&B revenue in piasters
 */
export async function getTodayFnbRevenue(): Promise<number> {
  const sales = await getTodayFnbSales();
  return sales.reduce((sum, sale) => sum + (sale.priceSnapshot * sale.quantity), 0);
}

/**
 * Delete a F&B sale (for correcting mistakes)
 */
export async function deleteFnbSale(id: number): Promise<void> {
  const saleResults = await db.select().from(fnbSales).where(eq(fnbSales.id, id));
  const sale = saleResults[0];
  if (!sale) throw new Error(`F&B sale ${id} not found`);

  await db.delete(fnbSales).where(eq(fnbSales.id, id));
}

/**
 * Get F&B sale by ID
 */
export async function getFnbSaleById(id: number): Promise<FnbSale | undefined> {
  const results = await db.select().from(fnbSales).where(eq(fnbSales.id, id));
  return results[0];
}

// ===== ANALYTICS =====

/**
 * Get F&B sales summary for a date range
 */
export async function getFnbSalesSummary(startDate: number, endDate: number): Promise<{
  totalRevenue: number;
  totalItemsSold: number;
  salesByCategory: Record<string, { count: number; revenue: number }>;
}> {
  const sales = await getFnbSales({ startDate, endDate });

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
