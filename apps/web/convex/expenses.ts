/**
 * Convex queries and mutations for expenses
 */

import { query, mutation } from './_generated/server';
import { v } from 'convex/values';

/**
 * List all expenses
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query('expenses').collect();
  },
});

/**
 * List only active expenses
 */
export const listActive = query({
  args: {},
  handler: async (ctx) => {
    const expenses = await ctx.db.query('expenses').collect();
    return expenses.filter((expense) => expense.isActive);
  },
});

/**
 * Create a new expense
 */
export const create = mutation({
  args: {
    type: v.string(),
    category: v.string(),
    name: v.string(),
    nameAr: v.string(),
    amount: v.number(),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('expenses', {
      type: args.type,
      category: args.category,
      name: args.name,
      nameAr: args.nameAr,
      amount: args.amount,
      isActive: args.isActive,
    });
  },
});

/**
 * Update an existing expense
 */
export const update = mutation({
  args: {
    id: v.id('expenses'),
    type: v.optional(v.string()),
    category: v.optional(v.string()),
    name: v.optional(v.string()),
    nameAr: v.optional(v.string()),
    amount: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
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
 * Toggle the isActive status of an expense
 */
export const toggleActive = mutation({
  args: { id: v.id('expenses') },
  handler: async (ctx, { id }) => {
    const expense = await ctx.db.get(id);
    if (!expense) {
      throw new Error('Expense not found');
    }

    await ctx.db.patch(id, { isActive: !expense.isActive });
    return id;
  },
});
