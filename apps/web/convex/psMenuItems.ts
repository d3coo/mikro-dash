/**
 * Convex queries and mutations for PlayStation menu items (food/drinks)
 */

import { query, mutation } from './_generated/server';
import { v } from 'convex/values';

// ============= Queries =============

/**
 * List all menu items sorted by sortOrder
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const items = await ctx.db.query('psMenuItems').collect();
    return items.sort((a, b) => a.sortOrder - b.sortOrder);
  },
});

/**
 * List menu items filtered by category
 */
export const listByCategory = query({
  args: { category: v.string() },
  handler: async (ctx, { category }) => {
    const items = await ctx.db.query('psMenuItems').collect();
    return items
      .filter((item) => item.category === category)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  },
});

/**
 * List only available menu items (isAvailable === true)
 */
export const listAvailable = query({
  args: {},
  handler: async (ctx) => {
    const items = await ctx.db.query('psMenuItems').collect();
    return items
      .filter((item) => item.isAvailable)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  },
});

/**
 * Get a single menu item by ID
 */
export const getById = query({
  args: { id: v.id('psMenuItems') },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

// ============= Mutations =============

/**
 * Create a new menu item
 */
export const create = mutation({
  args: {
    name: v.string(),
    nameAr: v.string(),
    category: v.string(),
    price: v.number(),
    isAvailable: v.boolean(),
    sortOrder: v.number(),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert('psMenuItems', {
      name: args.name,
      nameAr: args.nameAr,
      category: args.category,
      price: args.price,
      isAvailable: args.isAvailable,
      sortOrder: args.sortOrder,
    });
    return id;
  },
});

/**
 * Update an existing menu item
 */
export const update = mutation({
  args: {
    id: v.id('psMenuItems'),
    name: v.optional(v.string()),
    nameAr: v.optional(v.string()),
    category: v.optional(v.string()),
    price: v.optional(v.number()),
    isAvailable: v.optional(v.boolean()),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, { id, ...updates }) => {
    const existing = await ctx.db.get(id);
    if (!existing) {
      throw new Error(`Menu item not found: ${id}`);
    }

    // Filter out undefined values
    const patch: Partial<{
      name: string;
      nameAr: string;
      category: string;
      price: number;
      isAvailable: boolean;
      sortOrder: number;
    }> = {};

    if (updates.name !== undefined) patch.name = updates.name;
    if (updates.nameAr !== undefined) patch.nameAr = updates.nameAr;
    if (updates.category !== undefined) patch.category = updates.category;
    if (updates.price !== undefined) patch.price = updates.price;
    if (updates.isAvailable !== undefined) patch.isAvailable = updates.isAvailable;
    if (updates.sortOrder !== undefined) patch.sortOrder = updates.sortOrder;

    await ctx.db.patch(id, patch);
    return id;
  },
});

/**
 * Toggle the isAvailable status of a menu item
 */
export const toggleAvailable = mutation({
  args: { id: v.id('psMenuItems') },
  handler: async (ctx, { id }) => {
    const existing = await ctx.db.get(id);
    if (!existing) {
      throw new Error(`Menu item not found: ${id}`);
    }

    await ctx.db.patch(id, { isAvailable: !existing.isAvailable });
    return { id, isAvailable: !existing.isAvailable };
  },
});

/**
 * Delete a menu item
 */
export const remove = mutation({
  args: { id: v.id('psMenuItems') },
  handler: async (ctx, { id }) => {
    const existing = await ctx.db.get(id);
    if (!existing) {
      throw new Error(`Menu item not found: ${id}`);
    }

    await ctx.db.delete(id);
    return id;
  },
});
