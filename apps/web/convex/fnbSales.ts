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
 * Create a new F&B sale record
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
