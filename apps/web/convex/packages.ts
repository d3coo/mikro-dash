/**
 * Convex queries and mutations for WiFi packages
 */

import { query, mutation } from './_generated/server';
import { v } from 'convex/values';

/**
 * List all packages sorted by sortOrder
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const packages = await ctx.db.query('packages').collect();
    return packages.sort((a, b) => a.sortOrder - b.sortOrder);
  },
});

/**
 * Get a single package by its ID
 */
export const getById = query({
  args: { id: v.id('packages') },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

/**
 * Create a new package
 */
export const create = mutation({
  args: {
    name: v.string(),
    nameAr: v.string(),
    priceLE: v.number(),
    bytesLimit: v.number(),
    timeLimit: v.string(),
    profile: v.string(),
    server: v.optional(v.string()),
    sortOrder: v.number(),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert('packages', {
      name: args.name,
      nameAr: args.nameAr,
      priceLE: args.priceLE,
      bytesLimit: args.bytesLimit,
      timeLimit: args.timeLimit,
      profile: args.profile,
      server: args.server,
      sortOrder: args.sortOrder,
    });
    return id;
  },
});

/**
 * Update an existing package
 */
export const update = mutation({
  args: {
    id: v.id('packages'),
    name: v.optional(v.string()),
    nameAr: v.optional(v.string()),
    priceLE: v.optional(v.number()),
    bytesLimit: v.optional(v.number()),
    timeLimit: v.optional(v.string()),
    profile: v.optional(v.string()),
    server: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, { id, ...updates }) => {
    // Filter out undefined values
    const filteredUpdates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        filteredUpdates[key] = value;
      }
    }

    if (Object.keys(filteredUpdates).length === 0) {
      return id;
    }

    await ctx.db.patch(id, filteredUpdates);
    return id;
  },
});

/**
 * Delete a package
 */
export const remove = mutation({
  args: { id: v.id('packages') },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
    return id;
  },
});
