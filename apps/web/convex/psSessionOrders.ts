/**
 * Convex queries and mutations for session orders
 */

import { query, mutation } from './_generated/server';
import { v } from 'convex/values';

/**
 * Get all orders for a specific session
 */
export const getBySession = query({
  args: { sessionId: v.id('psSessions') },
  handler: async (ctx, { sessionId }) => {
    return await ctx.db
      .query('psSessionOrders')
      .withIndex('by_session', (q) => q.eq('sessionId', sessionId))
      .collect();
  },
});

/**
 * Add an order to a session
 * Also updates the session's ordersCost
 */
export const add = mutation({
  args: {
    sessionId: v.id('psSessions'),
    menuItemId: v.id('psMenuItems'),
    quantity: v.number(),
    priceSnapshot: v.number(),
  },
  handler: async (ctx, { sessionId, menuItemId, quantity, priceSnapshot }) => {
    // Insert the order
    const orderId = await ctx.db.insert('psSessionOrders', {
      sessionId,
      menuItemId,
      quantity,
      priceSnapshot,
      createdAt: Date.now(),
    });

    // Update session's ordersCost
    const session = await ctx.db.get(sessionId);
    if (session) {
      const orderTotal = quantity * priceSnapshot;
      await ctx.db.patch(sessionId, {
        ordersCost: session.ordersCost + orderTotal,
      });
    }

    return orderId;
  },
});

/**
 * Remove an order from a session
 * Also updates the session's ordersCost
 */
export const remove = mutation({
  args: { id: v.id('psSessionOrders') },
  handler: async (ctx, { id }) => {
    const order = await ctx.db.get(id);
    if (!order) {
      throw new Error('Order not found');
    }

    // Update session's ordersCost before deleting the order
    const session = await ctx.db.get(order.sessionId);
    if (session) {
      const orderTotal = order.quantity * order.priceSnapshot;
      await ctx.db.patch(order.sessionId, {
        ordersCost: Math.max(0, session.ordersCost - orderTotal),
      });
    }

    // Delete the order
    await ctx.db.delete(id);
    return id;
  },
});
