/**
 * Convex queries and mutations for standalone F&B sales
 */

import { query, mutation } from './_generated/server';
import { v } from 'convex/values';

/**
 * List all F&B sales
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query('fnbSales').collect();
  },
});

/**
 * Get F&B sales within a date range
 * Uses the by_date index on soldAt timestamp
 */
export const getByDateRange = query({
  args: {
    start: v.number(),
    end: v.number(),
  },
  handler: async (ctx, { start, end }) => {
    return await ctx.db
      .query('fnbSales')
      .withIndex('by_date', (q) => q.gte('soldAt', start).lte('soldAt', end))
      .collect();
  },
});

/**
 * Get today's F&B sales with menu item details joined
 */
export const getTodaySalesWithItems = query({
  args: {},
  handler: async (ctx) => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayMs = todayStart.getTime();

    const sales = await ctx.db
      .query('fnbSales')
      .withIndex('by_date', (q) => q.gte('soldAt', todayMs))
      .collect();

    // Join with menu items
    const menuItems = await ctx.db.query('psMenuItems').collect();
    const menuItemMap = new Map(menuItems.map((m) => [m._id, m]));

    return sales.map((sale) => ({
      ...sale,
      menuItem: menuItemMap.get(sale.menuItemId) ?? null,
    }));
  },
});

/**
 * Create a new F&B sale record (looks up menu item price automatically)
 */
export const recordSale = mutation({
  args: {
    menuItemId: v.id('psMenuItems'),
    quantity: v.number(),
  },
  handler: async (ctx, { menuItemId, quantity }) => {
    const menuItem = await ctx.db.get(menuItemId);
    if (!menuItem) throw new Error('Menu item not found');
    if (!menuItem.isAvailable) throw new Error('Menu item is not available');

    return await ctx.db.insert('fnbSales', {
      menuItemId,
      quantity,
      priceSnapshot: menuItem.price,
      soldAt: Date.now(),
    });
  },
});

/**
 * Create a new F&B sale record (with explicit price)
 */
export const create = mutation({
  args: {
    menuItemId: v.id('psMenuItems'),
    quantity: v.number(),
    priceSnapshot: v.number(),
  },
  handler: async (ctx, { menuItemId, quantity, priceSnapshot }) => {
    return await ctx.db.insert('fnbSales', {
      menuItemId,
      quantity,
      priceSnapshot,
      soldAt: Date.now(),
    });
  },
});

/**
 * Delete a F&B sale
 */
export const remove = mutation({
  args: { id: v.id('fnbSales') },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
    return id;
  },
});
