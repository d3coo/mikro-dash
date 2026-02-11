/**
 * Convex queries and mutations for unified daily statistics
 */

import { query, mutation } from './_generated/server';
import { v } from 'convex/values';

/**
 * Get stats for a specific date
 * Uses the by_date index
 */
export const getByDate = query({
  args: { date: v.string() },
  handler: async (ctx, { date }) => {
    return await ctx.db
      .query('unifiedDailyStats')
      .withIndex('by_date', (q) => q.eq('date', date))
      .unique();
  },
});

/**
 * Get stats for a date range
 * Returns all stats where date is between start and end (inclusive)
 */
export const getRange = query({
  args: {
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, { startDate, endDate }) => {
    return await ctx.db
      .query('unifiedDailyStats')
      .withIndex('by_date', (q) => q.gte('date', startDate).lte('date', endDate))
      .collect();
  },
});

/**
 * Upsert (create or update) stats for a specific date
 */
export const upsert = mutation({
  args: {
    date: v.string(),
    wifiRevenue: v.optional(v.number()),
    wifiVouchersSold: v.optional(v.number()),
    wifiDataSold: v.optional(v.number()),
    wifiDataUsed: v.optional(v.number()),
    psGamingRevenue: v.optional(v.number()),
    psSessions: v.optional(v.number()),
    psMinutes: v.optional(v.number()),
    psOrdersRevenue: v.optional(v.number()),
    fnbRevenue: v.optional(v.number()),
    fnbItemsSold: v.optional(v.number()),
  },
  handler: async (ctx, { date, ...stats }) => {
    // Check if stats for this date already exist
    const existing = await ctx.db
      .query('unifiedDailyStats')
      .withIndex('by_date', (q) => q.eq('date', date))
      .unique();

    if (existing) {
      // Update existing record - only update provided fields
      const updates: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(stats)) {
        if (value !== undefined) {
          updates[key] = value;
        }
      }

      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(existing._id, updates);
      }
      return existing._id;
    } else {
      // Create new record with defaults for unprovided fields
      return await ctx.db.insert('unifiedDailyStats', {
        date,
        wifiRevenue: stats.wifiRevenue ?? 0,
        wifiVouchersSold: stats.wifiVouchersSold ?? 0,
        wifiDataSold: stats.wifiDataSold ?? 0,
        wifiDataUsed: stats.wifiDataUsed ?? 0,
        psGamingRevenue: stats.psGamingRevenue ?? 0,
        psSessions: stats.psSessions ?? 0,
        psMinutes: stats.psMinutes ?? 0,
        psOrdersRevenue: stats.psOrdersRevenue ?? 0,
        fnbRevenue: stats.fnbRevenue ?? 0,
        fnbItemsSold: stats.fnbItemsSold ?? 0,
      });
    }
  },
});
