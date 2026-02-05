/**
 * Convex queries and mutations for PlayStation sessions
 */

import { query, mutation } from './_generated/server';
import { v } from 'convex/values';

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
  },
  handler: async (ctx, args) => {
    const now = Date.now();
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

    // Create the session
    const sessionId = await ctx.db.insert('psSessions', {
      stationId: args.stationId,
      startedAt: now,
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
      startedAt: now,
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
    totalCost: v.number(),
  },
  handler: async (ctx, { id, totalCost }) => {
    const now = Date.now();

    // Get the session
    const session = await ctx.db.get(id);
    if (!session) {
      throw new Error('Session not found');
    }

    if (session.endedAt) {
      throw new Error('Session already ended');
    }

    // Update the session
    await ctx.db.patch(id, {
      endedAt: now,
      totalCost,
      pausedAt: undefined, // Clear any pause state
    });

    // Update station status to 'available'
    await ctx.db.patch(session.stationId, { status: 'available' });

    // End current segment (find the one without endedAt)
    const segments = await ctx.db
      .query('psSessionSegments')
      .withIndex('by_session', (q) => q.eq('sessionId', id))
      .collect();

    const activeSegment = segments.find((s) => s.endedAt === undefined);
    if (activeSegment) {
      await ctx.db.patch(activeSegment._id, { endedAt: now });
    }

    return { success: true };
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
