/**
 * Convex queries and mutations for settings (key-value store)
 */

import { query, mutation } from './_generated/server';
import { v } from 'convex/values';

/**
 * Get all settings
 */
export const getAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query('settings').collect();
  },
});

/**
 * Get a single setting by key
 */
export const get = query({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    return await ctx.db
      .query('settings')
      .withIndex('by_key', (q) => q.eq('key', key))
      .unique();
  },
});

/**
 * Set a setting (upsert - update if exists, insert if not)
 */
export const set = mutation({
  args: {
    key: v.string(),
    value: v.string(),
  },
  handler: async (ctx, { key, value }) => {
    const existing = await ctx.db
      .query('settings')
      .withIndex('by_key', (q) => q.eq('key', key))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { value });
      return { updated: true, id: existing._id };
    } else {
      const id = await ctx.db.insert('settings', { key, value });
      return { updated: false, id };
    }
  },
});

/**
 * Delete a setting by key
 */
export const remove = mutation({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const existing = await ctx.db
      .query('settings')
      .withIndex('by_key', (q) => q.eq('key', key))
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
      return { deleted: true };
    }
    return { deleted: false };
  },
});
