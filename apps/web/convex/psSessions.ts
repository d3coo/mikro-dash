/**
 * Convex queries and mutations for PlayStation sessions
 */

import { query, mutation } from './_generated/server';
import { v } from 'convex/values';
import type { Id } from './_generated/dataModel';
import { getBusinessDayStartMs } from './lib/dateUtils';

// ============= COMPREHENSIVE QUERIES FOR PS PAGE =============

/**
 * Get full station statuses with active sessions, orders, charges, etc.
 * This is the main query for the PlayStation page - returns everything needed for the UI.
 * Uses Convex caching for offline support.
 */
export const getStationStatuses = query({
  args: {},
  handler: async (ctx) => {
    // Get all stations sorted by sortOrder
    const stations = await ctx.db.query('psStations').collect();
    const sortedStations = stations.sort((a, b) => a.sortOrder - b.sortOrder);

    // Get all active sessions
    const activeSessions = await ctx.db
      .query('psSessions')
      .withIndex('by_active', (q) => q.eq('endedAt', undefined))
      .collect();

    // Create map of stationId -> active session
    const activeSessionMap = new Map<Id<'psStations'>, typeof activeSessions[0]>();
    for (const session of activeSessions) {
      activeSessionMap.set(session.stationId, session);
    }

    // Get recent ended sessions for showing last session info
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recentSessions = await ctx.db
      .query('psSessions')
      .collect();
    const recentEndedSessions = recentSessions
      .filter(s => s.endedAt !== undefined && s.startedAt >= thirtyDaysAgo)
      .sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0));

    // Map stationId -> last ended session
    const lastSessionMap = new Map<Id<'psStations'>, typeof recentSessions[0]>();
    for (const session of recentEndedSessions) {
      if (!lastSessionMap.has(session.stationId)) {
        lastSessionMap.set(session.stationId, session);
      }
    }

    // Get all session orders for active sessions
    const allOrders = await ctx.db.query('psSessionOrders').collect();

    // Get all session charges for active sessions
    const allCharges = await ctx.db.query('psSessionCharges').collect();

    // Get all session transfers
    const allTransfers = await ctx.db.query('psSessionTransfers').collect();

    // Get all session segments for active sessions
    const allSegments = await ctx.db.query('psSessionSegments').collect();

    // Get all menu items for order details
    const menuItems = await ctx.db.query('psMenuItems').collect();
    const menuItemMap = new Map(menuItems.map(m => [m._id, m]));

    // Build result
    const result = [];
    for (const station of sortedStations) {
      const activeSession = activeSessionMap.get(station._id) ?? null;
      const lastSession = !activeSession ? (lastSessionMap.get(station._id) ?? null) : null;

      // Get session-specific data
      let orders: Array<typeof allOrders[0] & { menuItem: typeof menuItems[0] | null }> = [];
      let charges: typeof allCharges = [];
      let transfers: typeof allTransfers = [];
      let segments: typeof allSegments = [];
      let lastSessionOrders: typeof orders = [];
      let lastSessionCharges: typeof allCharges = [];
      let lastSessionTransfers: typeof allTransfers = [];
      let lastSessionSegments: typeof allSegments = [];

      if (activeSession) {
        orders = allOrders
          .filter(o => o.sessionId === activeSession._id)
          .map(o => ({ ...o, menuItem: menuItemMap.get(o.menuItemId) ?? null }));
        charges = allCharges.filter(c => c.sessionId === activeSession._id);
        transfers = allTransfers.filter(t => t.toSessionId === activeSession._id);
        segments = allSegments.filter(s => s.sessionId === activeSession._id);
      } else if (lastSession) {
        lastSessionOrders = allOrders
          .filter(o => o.sessionId === lastSession._id)
          .map(o => ({ ...o, menuItem: menuItemMap.get(o.menuItemId) ?? null }));
        lastSessionCharges = allCharges.filter(c => c.sessionId === lastSession._id);
        lastSessionTransfers = allTransfers.filter(t => t.toSessionId === lastSession._id);
        lastSessionSegments = allSegments.filter(s => s.sessionId === lastSession._id);
      }

      // Calculate elapsed time and current cost for active session
      const now = Date.now();
      let elapsedMinutes = 0;
      let currentCost = 0;

      if (activeSession) {
        let elapsedMs = now - activeSession.startedAt;
        const totalPausedMs = activeSession.totalPausedMs || 0;
        const currentlyPausedMs = activeSession.pausedAt ? (now - activeSession.pausedAt) : 0;
        elapsedMs -= (totalPausedMs + currentlyPausedMs);
        if (elapsedMs < 0) elapsedMs = 0;

        elapsedMinutes = Math.floor(elapsedMs / (1000 * 60));
        // Calculate cost using segments or simple calculation
        if (segments.length > 0) {
          for (const segment of segments) {
            const segmentEnd = segment.endedAt ?? now;
            const segmentMs = segmentEnd - segment.startedAt;
            const segmentMinutes = Math.ceil(segmentMs / (1000 * 60));
            currentCost += Math.round((segment.hourlyRateSnapshot * segmentMinutes) / 60);
          }
        } else {
          const minutes = Math.ceil(elapsedMs / (1000 * 60));
          currentCost = Math.round((activeSession.hourlyRateSnapshot * minutes) / 60);
        }
      }

      result.push({
        station,
        activeSession,
        lastSession,
        orders,
        charges,
        transfers,
        segments,
        lastSessionOrders,
        lastSessionCharges,
        lastSessionTransfers,
        lastSessionSegments,
        elapsedMinutes,
        currentCost,
        isPaused: !!activeSession?.pausedAt,
      });
    }

    return result;
  },
});

/**
 * Get today's PS analytics summary
 */
export const getTodayAnalytics = query({
  args: {},
  handler: async (ctx) => {
    const todayMs = getBusinessDayStartMs();

    // Get all sessions that started today
    const sessions = await ctx.db.query('psSessions').collect();
    const todaySessions = sessions.filter(s => s.startedAt >= todayMs);

    let totalRevenue = 0;
    let totalMinutes = 0;
    let totalSessions = todaySessions.length;

    const now = Date.now();
    for (const session of todaySessions) {
      const endTime = session.endedAt ?? now;
      const durationMs = endTime - session.startedAt - (session.totalPausedMs || 0);
      totalMinutes += Math.floor(durationMs / (1000 * 60));

      if (session.endedAt) {
        totalRevenue += (session.totalCost || 0) + (session.ordersCost || 0) + (session.extraCharges || 0);
      } else {
        // Active session - estimate current cost
        const minutes = Math.ceil(durationMs / (1000 * 60));
        const gamingCost = Math.round((session.hourlyRateSnapshot * minutes) / 60);
        totalRevenue += gamingCost + (session.ordersCost || 0) + (session.extraCharges || 0);
      }
    }

    return {
      totalSessions,
      totalMinutes,
      totalRevenue,
    };
  },
});

// ============= QUERIES =============

/**
 * Get all active sessions (endedAt is undefined)
 */
export const getActive = query({
  args: {},
  handler: async (ctx) => {
    const sessions = await ctx.db
      .query('psSessions')
      .withIndex('by_active', (q) => q.eq('endedAt', undefined))
      .collect();
    return sessions;
  },
});

/**
 * Get sessions for a specific station
 */
export const getByStation = query({
  args: { stationId: v.id('psStations') },
  handler: async (ctx, { stationId }) => {
    const sessions = await ctx.db
      .query('psSessions')
      .withIndex('by_station', (q) => q.eq('stationId', stationId))
      .collect();
    return sessions;
  },
});

/**
 * Get a single session by ID
 */
export const getById = query({
  args: { id: v.id('psSessions') },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

// ============= MUTATIONS =============

/**
 * Start a new session
 * - Creates the session record
 * - Updates station status to 'occupied'
 * - Creates initial segment
 */
export const start = mutation({
  args: {
    stationId: v.id('psStations'),
    mode: v.optional(v.union(v.literal('single'), v.literal('multi'))),
    startedBy: v.optional(v.union(v.literal('manual'), v.literal('auto'))),
    timerMinutes: v.optional(v.number()),
    costLimitPiasters: v.optional(v.number()),
    notes: v.optional(v.string()),
    customStartTime: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const startTime = args.customStartTime ?? now;
    const mode = args.mode ?? 'single';
    const startedBy = args.startedBy ?? 'manual';

    // Get station to retrieve hourly rate
    const station = await ctx.db.get(args.stationId);
    if (!station) {
      throw new Error('Station not found');
    }

    // Determine hourly rate based on mode
    const hourlyRate =
      mode === 'multi' && station.hourlyRateMulti
        ? station.hourlyRateMulti
        : station.hourlyRate;

    // Check if already has active session
    const activeSessions = await ctx.db
      .query('psSessions')
      .withIndex('by_station', (q) => q.eq('stationId', args.stationId))
      .collect();
    const existing = activeSessions.find((s) => s.endedAt === undefined);
    if (existing) {
      throw new Error('Station already has an active session');
    }

    // Create the session
    const sessionId = await ctx.db.insert('psSessions', {
      stationId: args.stationId,
      startedAt: startTime,
      endedAt: undefined,
      hourlyRateSnapshot: hourlyRate,
      totalCost: undefined,
      ordersCost: 0,
      extraCharges: 0,
      transferredCost: 0,
      currentMode: mode,
      startedBy,
      timerMinutes: args.timerMinutes,
      timerNotified: false,
      costLimitPiasters: args.costLimitPiasters,
      costLimitNotified: false,
      pausedAt: undefined,
      totalPausedMs: 0,
      notes: args.notes,
    });

    // Update station status to 'occupied'
    await ctx.db.patch(args.stationId, { status: 'occupied' });

    // Create initial segment
    await ctx.db.insert('psSessionSegments', {
      sessionId,
      mode,
      startedAt: startTime,
      endedAt: undefined,
      hourlyRateSnapshot: hourlyRate,
    });

    return sessionId;
  },
});

/**
 * End a session
 * - Sets endedAt and totalCost
 * - Updates station status to 'available'
 * - Ends current segment
 */
export const end = mutation({
  args: {
    id: v.id('psSessions'),
    customTotalCost: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { id, customTotalCost, notes }) => {
    const now = Date.now();

    // Get the session
    const session = await ctx.db.get(id);
    if (!session) {
      throw new Error('Session not found');
    }

    if (session.endedAt) {
      throw new Error('Session already ended');
    }

    // End current segment (find the one without endedAt)
    const segments = await ctx.db
      .query('psSessionSegments')
      .withIndex('by_session', (q) => q.eq('sessionId', id))
      .collect();

    const activeSegment = segments.find((s) => s.endedAt === undefined);
    if (activeSegment) {
      await ctx.db.patch(activeSegment._id, { endedAt: now });
    }

    // Calculate gaming cost from segments
    let calculatedGamingCost = 0;
    const allSegments = segments.map((s) =>
      s._id === activeSegment?._id ? { ...s, endedAt: now } : s
    );
    for (const seg of allSegments) {
      const segEnd = seg.endedAt ?? now;
      const segMs = segEnd - seg.startedAt;
      const segMinutes = Math.ceil(segMs / (1000 * 60));
      calculatedGamingCost += Math.round((seg.hourlyRateSnapshot * segMinutes) / 60);
    }

    const ordersCost = session.ordersCost || 0;
    const extraCharges = session.extraCharges || 0;
    const transferredCost = session.transferredCost || 0;

    let gamingCostToStore: number;
    if (customTotalCost !== undefined) {
      // Custom amount specified - back-calculate gaming cost
      gamingCostToStore = Math.max(0, customTotalCost - ordersCost - extraCharges - transferredCost);
    } else {
      gamingCostToStore = calculatedGamingCost;
    }

    // Update the session
    await ctx.db.patch(id, {
      endedAt: now,
      totalCost: gamingCostToStore,
      pausedAt: undefined,
      notes: notes || session.notes,
    });

    // Update station status to 'available'
    await ctx.db.patch(session.stationId, { status: 'available' });

    return {
      _id: id,
      stationId: session.stationId,
      totalCost: gamingCostToStore,
      ordersCost,
      extraCharges,
      transferredCost,
    };
  },
});

/**
 * Switch between 'single' and 'multi' mode
 * - Ends current segment
 * - Creates new segment with new mode
 * - Updates session currentMode and hourlyRateSnapshot
 */
export const switchMode = mutation({
  args: {
    id: v.id('psSessions'),
    newMode: v.union(v.literal('single'), v.literal('multi')),
  },
  handler: async (ctx, { id, newMode }) => {
    const now = Date.now();

    // Get the session
    const session = await ctx.db.get(id);
    if (!session) {
      throw new Error('Session not found');
    }

    if (session.endedAt) {
      throw new Error('Cannot switch mode on ended session');
    }

    if (session.currentMode === newMode) {
      return { success: true, message: 'Already in this mode' };
    }

    // Get station to retrieve hourly rate for new mode
    const station = await ctx.db.get(session.stationId);
    if (!station) {
      throw new Error('Station not found');
    }

    // Determine new hourly rate based on mode
    const newHourlyRate =
      newMode === 'multi' && station.hourlyRateMulti
        ? station.hourlyRateMulti
        : station.hourlyRate;

    // End current segment
    const segments = await ctx.db
      .query('psSessionSegments')
      .withIndex('by_session', (q) => q.eq('sessionId', id))
      .collect();

    const activeSegment = segments.find((s) => s.endedAt === undefined);
    if (activeSegment) {
      await ctx.db.patch(activeSegment._id, { endedAt: now });
    }

    // Create new segment
    await ctx.db.insert('psSessionSegments', {
      sessionId: id,
      mode: newMode,
      startedAt: now,
      endedAt: undefined,
      hourlyRateSnapshot: newHourlyRate,
    });

    // Update session
    await ctx.db.patch(id, {
      currentMode: newMode,
      hourlyRateSnapshot: newHourlyRate,
    });

    return { success: true };
  },
});

/**
 * Pause a session
 * - Sets pausedAt timestamp
 */
export const pause = mutation({
  args: { id: v.id('psSessions') },
  handler: async (ctx, { id }) => {
    const now = Date.now();

    const session = await ctx.db.get(id);
    if (!session) {
      throw new Error('Session not found');
    }

    if (session.endedAt) {
      throw new Error('Cannot pause ended session');
    }

    if (session.pausedAt) {
      return { success: true, message: 'Session already paused' };
    }

    await ctx.db.patch(id, { pausedAt: now });

    return { success: true };
  },
});

/**
 * Resume a paused session
 * - Clears pausedAt
 * - Adds paused duration to totalPausedMs
 */
export const resume = mutation({
  args: { id: v.id('psSessions') },
  handler: async (ctx, { id }) => {
    const now = Date.now();

    const session = await ctx.db.get(id);
    if (!session) {
      throw new Error('Session not found');
    }

    if (session.endedAt) {
      throw new Error('Cannot resume ended session');
    }

    if (!session.pausedAt) {
      return { success: true, message: 'Session not paused' };
    }

    // Calculate paused duration and add to total
    const pausedDuration = now - session.pausedAt;
    const newTotalPausedMs = session.totalPausedMs + pausedDuration;

    await ctx.db.patch(id, {
      pausedAt: undefined,
      totalPausedMs: newTotalPausedMs,
    });

    return { success: true, pausedDuration };
  },
});

/**
 * Update timer settings
 */
export const updateTimer = mutation({
  args: {
    id: v.id('psSessions'),
    timerMinutes: v.optional(v.number()),
    timerNotified: v.optional(v.boolean()),
  },
  handler: async (ctx, { id, timerMinutes, timerNotified }) => {
    const session = await ctx.db.get(id);
    if (!session) {
      throw new Error('Session not found');
    }

    const updates: { timerMinutes?: number; timerNotified?: boolean } = {};

    if (timerMinutes !== undefined) {
      updates.timerMinutes = timerMinutes;
    }

    if (timerNotified !== undefined) {
      updates.timerNotified = timerNotified;
    }

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(id, updates);
    }

    return { success: true };
  },
});

/**
 * Update cost limit settings
 */
export const updateCostLimit = mutation({
  args: {
    id: v.id('psSessions'),
    costLimitPiasters: v.optional(v.number()),
    costLimitNotified: v.optional(v.boolean()),
  },
  handler: async (ctx, { id, costLimitPiasters, costLimitNotified }) => {
    const session = await ctx.db.get(id);
    if (!session) {
      throw new Error('Session not found');
    }

    const updates: { costLimitPiasters?: number; costLimitNotified?: boolean } = {};

    if (costLimitPiasters !== undefined) {
      updates.costLimitPiasters = costLimitPiasters;
    }

    if (costLimitNotified !== undefined) {
      updates.costLimitNotified = costLimitNotified;
    }

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(id, updates);
    }

    return { success: true };
  },
});

// ============= SESSION ORDERS =============

/**
 * Add an order to a session
 */
export const addOrder = mutation({
  args: {
    sessionId: v.id('psSessions'),
    menuItemId: v.id('psMenuItems'),
    quantity: v.optional(v.number()),
  },
  handler: async (ctx, { sessionId, menuItemId, quantity = 1 }) => {
    const now = Date.now();

    // Validate session
    const session = await ctx.db.get(sessionId);
    if (!session) throw new Error('Session not found');
    if (session.endedAt) throw new Error('Cannot add order to ended session');

    // Get menu item
    const menuItem = await ctx.db.get(menuItemId);
    if (!menuItem) throw new Error('Menu item not found');
    if (!menuItem.isAvailable) throw new Error('Menu item is not available');

    const orderCost = menuItem.price * quantity;

    // Check if order for this item already exists
    const existingOrders = await ctx.db
      .query('psSessionOrders')
      .withIndex('by_session', (q) => q.eq('sessionId', sessionId))
      .collect();

    const existing = existingOrders.find(o => o.menuItemId === menuItemId);

    if (existing) {
      // Update existing order quantity
      await ctx.db.patch(existing._id, { quantity: existing.quantity + quantity });
    } else {
      // Create new order
      await ctx.db.insert('psSessionOrders', {
        sessionId,
        menuItemId,
        quantity,
        priceSnapshot: menuItem.price,
        createdAt: now,
      });
    }

    // Update session's ordersCost
    await ctx.db.patch(sessionId, {
      ordersCost: session.ordersCost + orderCost,
    });

    return { success: true };
  },
});

/**
 * Remove an order from a session
 */
export const removeOrder = mutation({
  args: { orderId: v.id('psSessionOrders') },
  handler: async (ctx, { orderId }) => {
    const order = await ctx.db.get(orderId);
    if (!order) throw new Error('Order not found');

    const session = await ctx.db.get(order.sessionId);
    if (!session) throw new Error('Session not found');
    if (session.endedAt) throw new Error('Cannot remove order from ended session');

    const orderCost = order.priceSnapshot * order.quantity;

    // Delete order
    await ctx.db.delete(orderId);

    // Update session's ordersCost
    await ctx.db.patch(order.sessionId, {
      ordersCost: Math.max(0, session.ordersCost - orderCost),
    });

    return { success: true };
  },
});

// ============= SESSION CHARGES =============

/**
 * Add an extra charge to a session
 */
export const addCharge = mutation({
  args: {
    sessionId: v.id('psSessions'),
    amount: v.number(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { sessionId, amount, reason }) => {
    const now = Date.now();

    const session = await ctx.db.get(sessionId);
    if (!session) throw new Error('Session not found');
    if (session.endedAt) throw new Error('Cannot add charge to ended session');

    // Create charge
    await ctx.db.insert('psSessionCharges', {
      sessionId,
      amount,
      reason,
      createdAt: now,
    });

    // Update session's extraCharges
    await ctx.db.patch(sessionId, {
      extraCharges: session.extraCharges + amount,
    });

    return { success: true };
  },
});

/**
 * Update a charge
 */
export const updateCharge = mutation({
  args: {
    chargeId: v.id('psSessionCharges'),
    amount: v.number(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { chargeId, amount, reason }) => {
    const charge = await ctx.db.get(chargeId);
    if (!charge) throw new Error('Charge not found');

    const session = await ctx.db.get(charge.sessionId);
    if (!session) throw new Error('Session not found');
    if (session.endedAt) throw new Error('Cannot update charge on ended session');

    const amountDiff = amount - charge.amount;

    // Update charge
    await ctx.db.patch(chargeId, { amount, reason });

    // Update session's extraCharges
    await ctx.db.patch(charge.sessionId, {
      extraCharges: session.extraCharges + amountDiff,
    });

    return { success: true };
  },
});

/**
 * Delete a charge
 */
export const deleteCharge = mutation({
  args: { chargeId: v.id('psSessionCharges') },
  handler: async (ctx, { chargeId }) => {
    const charge = await ctx.db.get(chargeId);
    if (!charge) throw new Error('Charge not found');

    const session = await ctx.db.get(charge.sessionId);
    if (!session) throw new Error('Session not found');
    if (session.endedAt) throw new Error('Cannot delete charge from ended session');

    // Delete charge
    await ctx.db.delete(chargeId);

    // Update session's extraCharges
    await ctx.db.patch(charge.sessionId, {
      extraCharges: Math.max(0, session.extraCharges - charge.amount),
    });

    return { success: true };
  },
});

// ============= UPDATE START TIME =============

/**
 * Update the start time of a session (for corrections)
 */
export const updateStartTime = mutation({
  args: {
    id: v.id('psSessions'),
    newStartTime: v.number(),
  },
  handler: async (ctx, { id, newStartTime }) => {
    const session = await ctx.db.get(id);
    if (!session) throw new Error('Session not found');

    // Update session start time
    await ctx.db.patch(id, { startedAt: newStartTime });

    // Update first segment's start time
    const segments = await ctx.db
      .query('psSessionSegments')
      .withIndex('by_session', (q) => q.eq('sessionId', id))
      .collect();

    const sortedSegments = segments.sort((a, b) => a.startedAt - b.startedAt);
    if (sortedSegments.length > 0) {
      await ctx.db.patch(sortedSegments[0]._id, { startedAt: newStartTime });
    }

    return { success: true };
  },
});

// ============= SWITCH STATION =============

/**
 * Move an active session from one station to another
 */
export const switchStation = mutation({
  args: {
    id: v.id('psSessions'),
    newStationId: v.id('psStations'),
  },
  handler: async (ctx, { id, newStationId }) => {
    const session = await ctx.db.get(id);
    if (!session) throw new Error('Session not found');
    if (session.endedAt) throw new Error('Session already ended');

    const oldStationId = session.stationId;
    if (oldStationId === newStationId) throw new Error('Session already on this station');

    const newStation = await ctx.db.get(newStationId);
    if (!newStation) throw new Error('New station not found');
    if (newStation.status === 'occupied') throw new Error('Target station is already occupied');
    if (newStation.status === 'maintenance') throw new Error('Target station is in maintenance');

    // Check if new station already has an active session
    const activeSessions = await ctx.db
      .query('psSessions')
      .withIndex('by_station', (q) => q.eq('stationId', newStationId))
      .collect();
    const existingActive = activeSessions.find((s) => s.endedAt === undefined);
    if (existingActive) throw new Error('Target station already has an active session');

    const now = Date.now();
    const switchNote = `Switched from station at ${new Date(now).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
    const newNotes = session.notes ? `${session.notes}\n${switchNote}` : switchNote;

    // Update session to new station
    await ctx.db.patch(id, { stationId: newStationId, notes: newNotes });

    // Update old station status to available
    await ctx.db.patch(oldStationId, { status: 'available' });

    // Update new station status to occupied
    await ctx.db.patch(newStationId, { status: 'occupied' });

    return { success: true };
  },
});

// ============= TRANSFER SESSION =============

/**
 * Transfer cost from one session to another (end source, add to target)
 */
export const transferSession = mutation({
  args: {
    fromSessionId: v.id('psSessions'),
    toSessionId: v.id('psSessions'),
    includeOrders: v.boolean(),
  },
  handler: async (ctx, { fromSessionId, toSessionId, includeOrders }) => {
    if (fromSessionId === toSessionId) throw new Error('Cannot transfer to same session');

    const fromSession = await ctx.db.get(fromSessionId);
    if (!fromSession) throw new Error('Source session not found');
    if (fromSession.endedAt) throw new Error('Source session already ended');

    const toSession = await ctx.db.get(toSessionId);
    if (!toSession) throw new Error('Target session not found');
    if (toSession.endedAt) throw new Error('Target session already ended');

    const now = Date.now();

    // Calculate gaming cost from segments
    const segments = await ctx.db
      .query('psSessionSegments')
      .withIndex('by_session', (q) => q.eq('sessionId', fromSessionId))
      .collect();

    let gamingAmount = 0;
    for (const seg of segments) {
      const segEnd = seg.endedAt ?? now;
      const segMs = segEnd - seg.startedAt;
      const segMinutes = Math.ceil(segMs / (1000 * 60));
      gamingAmount += Math.round((seg.hourlyRateSnapshot * segMinutes) / 60);
    }

    const ordersAmount = includeOrders ? (fromSession.ordersCost || 0) : 0;
    const totalAmount = gamingAmount + ordersAmount + (fromSession.extraCharges || 0);

    // Create transfer record
    const transferId = await ctx.db.insert('psSessionTransfers', {
      fromSessionId,
      toSessionId,
      fromStationId: fromSession.stationId,
      gamingAmount,
      ordersAmount,
      totalAmount,
      createdAt: now,
    });

    // Update target session's transferred cost
    await ctx.db.patch(toSessionId, {
      transferredCost: (toSession.transferredCost || 0) + totalAmount,
    });

    // End active segment on source
    const activeSegment = segments.find((s) => s.endedAt === undefined);
    if (activeSegment) {
      await ctx.db.patch(activeSegment._id, { endedAt: now });
    }

    // End source session with 0 gaming cost (transferred)
    await ctx.db.patch(fromSessionId, {
      endedAt: now,
      totalCost: 0,
      pausedAt: undefined,
      notes: `Transferred to target${includeOrders ? ' (with orders)' : ''}`,
    });

    // Update source station status
    await ctx.db.patch(fromSession.stationId, { status: 'available' });

    return { transferId, gamingAmount, ordersAmount, totalAmount };
  },
});

// ============= TIMER ALERTS =============

/**
 * Get active sessions with expired timers
 */
export const getTimerAlerts = query({
  args: {},
  handler: async (ctx) => {
    const activeSessions = await ctx.db
      .query('psSessions')
      .withIndex('by_active', (q) => q.eq('endedAt', undefined))
      .collect();

    const now = Date.now();
    const alerts = [];

    for (const session of activeSessions) {
      if (session.timerMinutes && !session.timerNotified) {
        const totalPausedMs = session.totalPausedMs || 0;
        const currentlyPausedMs = session.pausedAt ? (now - session.pausedAt) : 0;
        const elapsedMs = now - session.startedAt - totalPausedMs - currentlyPausedMs;
        const elapsedMinutes = Math.floor(elapsedMs / (1000 * 60));

        if (elapsedMinutes >= session.timerMinutes) {
          const station = await ctx.db.get(session.stationId);
          alerts.push({
            sessionId: session._id,
            stationId: session.stationId,
            stationName: station?.nameAr || 'Unknown',
            timerMinutes: session.timerMinutes,
            elapsedMinutes,
            isExpired: true,
          });
        }
      }
    }

    return alerts;
  },
});

// ============= STATION EARNINGS =============

/**
 * Get today's earnings per station
 */
export const getStationEarnings = query({
  args: {},
  handler: async (ctx) => {
    const stations = await ctx.db.query('psStations').collect();
    const sortedStations = stations.sort((a, b) => a.sortOrder - b.sortOrder);

    const todayMs = getBusinessDayStartMs();
    const now = Date.now();

    // Get all sessions that started today
    const allSessions = await ctx.db.query('psSessions').collect();
    const todaySessions = allSessions.filter((s) => s.startedAt >= todayMs);

    // Group by station
    const sessionsByStation = new Map<string, typeof todaySessions>();
    for (const session of todaySessions) {
      const existing = sessionsByStation.get(session.stationId as string) || [];
      existing.push(session);
      sessionsByStation.set(session.stationId as string, existing);
    }

    const earnings = [];
    for (const station of sortedStations) {
      const sessions = sessionsByStation.get(station._id as string) || [];
      let todayEarnings = 0;
      let totalMinutes = 0;

      for (const session of sessions) {
        if (session.endedAt) {
          todayEarnings += (session.totalCost || 0) + (session.ordersCost || 0);
          totalMinutes += Math.floor((session.endedAt - session.startedAt) / (1000 * 60));
        } else {
          // Active session - estimate current cost
          const durationMs = now - session.startedAt - (session.totalPausedMs || 0);
          const minutes = Math.ceil(durationMs / (1000 * 60));
          todayEarnings += Math.round((session.hourlyRateSnapshot * minutes) / 60) + (session.ordersCost || 0);
          totalMinutes += Math.floor(durationMs / (1000 * 60));
        }
      }

      earnings.push({
        stationId: station._id,
        stationName: station.nameAr,
        todayEarnings,
        totalSessions: sessions.length,
        totalMinutes,
      });
    }

    return earnings;
  },
});

// ============= SESSION HISTORY =============

/**
 * Get session history with filters (for history page)
 * Returns ended sessions with station info, orders, and charges
 */
export const getHistory = query({
  args: {
    stationId: v.optional(v.id('psStations')),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { stationId, startDate, endDate, limit = 100 }) => {
    let sessions = await ctx.db.query('psSessions').collect();

    // Filter ended sessions only
    sessions = sessions.filter((s) => s.endedAt !== undefined);

    // Filter by station
    if (stationId) {
      sessions = sessions.filter((s) => s.stationId === stationId);
    }

    // Filter by date range
    if (startDate) {
      sessions = sessions.filter((s) => s.startedAt >= startDate);
    }
    if (endDate) {
      sessions = sessions.filter((s) => s.startedAt <= endDate);
    }

    // Sort by most recent first
    sessions.sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0));

    // Apply limit
    sessions = sessions.slice(0, limit);

    // Get station map for names
    const stations = await ctx.db.query('psStations').collect();
    const stationMap = new Map(stations.map((s) => [s._id, s]));

    // Get orders and charges for each session
    const allOrders = await ctx.db.query('psSessionOrders').collect();
    const allCharges = await ctx.db.query('psSessionCharges').collect();
    const allSegments = await ctx.db.query('psSessionSegments').collect();
    const menuItems = await ctx.db.query('psMenuItems').collect();
    const menuItemMap = new Map(menuItems.map((m) => [m._id, m]));

    return sessions.map((session) => {
      const station = stationMap.get(session.stationId);
      const orders = allOrders
        .filter((o) => o.sessionId === session._id)
        .map((o) => ({ ...o, menuItem: menuItemMap.get(o.menuItemId) ?? null }));
      const charges = allCharges.filter((c) => c.sessionId === session._id);
      const segments = allSegments.filter((s) => s.sessionId === session._id);

      const durationMs = (session.endedAt ?? 0) - session.startedAt - (session.totalPausedMs || 0);
      const durationMinutes = Math.floor(durationMs / (1000 * 60));
      const totalCostAll = (session.totalCost || 0) + (session.ordersCost || 0) + (session.extraCharges || 0) + (session.transferredCost || 0);

      return {
        ...session,
        station: station ?? null,
        orders,
        charges,
        segments,
        durationMinutes,
        totalCostAll,
      };
    });
  },
});

/**
 * Get PS analytics for a given period
 */
export const getAnalytics = query({
  args: {
    period: v.union(v.literal('today'), v.literal('week'), v.literal('month')),
  },
  handler: async (ctx, { period }) => {
    const now = Date.now();
    let startDate: number;

    if (period === 'today') {
      startDate = getBusinessDayStartMs();
    } else if (period === 'week') {
      startDate = now - 7 * 24 * 60 * 60 * 1000;
    } else {
      startDate = now - 30 * 24 * 60 * 60 * 1000;
    }

    const sessions = await ctx.db.query('psSessions').collect();
    const periodSessions = sessions.filter(
      (s) => s.endedAt !== undefined && s.startedAt >= startDate
    );

    let totalRevenue = 0;
    let totalMinutes = 0;
    let totalOrders = 0;

    for (const session of periodSessions) {
      const gamingCost = session.totalCost || 0;
      const ordersCost = session.ordersCost || 0;
      const extraCharges = session.extraCharges || 0;
      totalRevenue += gamingCost + ordersCost + extraCharges;
      totalOrders += ordersCost;

      const durationMs = (session.endedAt ?? 0) - session.startedAt - (session.totalPausedMs || 0);
      totalMinutes += Math.floor(durationMs / (1000 * 60));
    }

    return {
      totalSessions: periodSessions.length,
      totalMinutes,
      totalRevenue,
      totalOrders,
      avgSessionMinutes: periodSessions.length > 0 ? Math.round(totalMinutes / periodSessions.length) : 0,
      avgRevenue: periodSessions.length > 0 ? Math.round(totalRevenue / periodSessions.length) : 0,
    };
  },
});
