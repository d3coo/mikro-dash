import {
  recordFnbSale as convexRecordFnbSale,
  deleteFnbSale as convexDeleteFnbSale,
  getTodayFnbSalesWithItems,
  getFnbSales as convexGetFnbSales,
  getFnbSalesSummary as convexGetFnbSalesSummary,
  getFnbSaleById as convexGetFnbSaleById,
} from '$lib/server/convex';

// ===== F&B SALE TYPES =====

export interface FnbSaleWithItem {
  _id: string;
  menuItemId: string;
  quantity: number;
  priceSnapshot: number;
  soldAt: number;
  menuItem: {
    _id: string;
    name: string;
    nameAr: string;
    category: string;
    price: number;
    isAvailable: boolean;
    sortOrder: number;
  } | null;
}

// ===== CRUD OPERATIONS =====

/**
 * Record a standalone F&B sale (not tied to PlayStation session)
 */
export async function recordFnbSale(menuItemId: string, quantity: number = 1): Promise<string> {
  return await convexRecordFnbSale(menuItemId, quantity);
}

/**
 * Get F&B sales with optional date range filter
 */
export async function getFnbSales(options?: {
  startDate?: number;
  endDate?: number;
  limit?: number;
}): Promise<FnbSaleWithItem[]> {
  const sales = await convexGetFnbSales(options);
  return sales as FnbSaleWithItem[];
}

/**
 * Get today's F&B sales
 */
export async function getTodayFnbSales(): Promise<FnbSaleWithItem[]> {
  const sales = await getTodayFnbSalesWithItems();
  return sales as FnbSaleWithItem[];
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
export async function deleteFnbSale(id: string): Promise<void> {
  await convexDeleteFnbSale(id);
}

/**
 * Get F&B sale by ID
 */
export async function getFnbSaleById(id: string) {
  return await convexGetFnbSaleById(id);
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
  return await convexGetFnbSalesSummary(startDate, endDate);
}
