import { query, mutation } from './_generated/server';
import { v } from 'convex/values';

/**
 * List all PlayStation stations sorted by sortOrder
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const stations = await ctx.db.query('psStations').collect();
    return stations.sort((a, b) => a.sortOrder - b.sortOrder);
  },
});

/**
 * Get a single station by ID
 */
export const getById = query({
  args: { id: v.id('psStations') },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

/**
 * Get all stations with their active session (if any)
 * Active session = session where endedAt is undefined
 */
export const getWithActiveSession = query({
  args: {},
  handler: async (ctx) => {
    const stations = await ctx.db.query('psStations').collect();
    const sortedStations = stations.sort((a, b) => a.sortOrder - b.sortOrder);

    // Get all active sessions (endedAt is undefined)
    const activeSessions = await ctx.db
      .query('psSessions')
      .withIndex('by_active', (q) => q.eq('endedAt', undefined))
      .collect();

    // Create a map of stationId -> active session
    const sessionByStation = new Map(
      activeSessions.map((session) => [session.stationId, session])
    );

    // Join stations with their active sessions
    return sortedStations.map((station) => ({
      ...station,
      activeSession: sessionByStation.get(station._id) ?? null,
    }));
  },
});

/**
 * Create a new PlayStation station
 */
export const create = mutation({
  args: {
    name: v.string(),
    nameAr: v.string(),
    macAddress: v.string(),
    hourlyRate: v.number(),
    hourlyRateMulti: v.optional(v.number()),
    status: v.string(),
    monitorIp: v.optional(v.string()),
    monitorPort: v.number(),
    monitorType: v.string(),
    timerEndAction: v.string(),
    hdmiInput: v.number(),
    sortOrder: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('psStations', {
      name: args.name,
      nameAr: args.nameAr,
      macAddress: args.macAddress,
      hourlyRate: args.hourlyRate,
      hourlyRateMulti: args.hourlyRateMulti,
      status: args.status,
      monitorIp: args.monitorIp,
      monitorPort: args.monitorPort,
      monitorType: args.monitorType,
      timerEndAction: args.timerEndAction,
      hdmiInput: args.hdmiInput,
      sortOrder: args.sortOrder,
    });
  },
});

/**
 * Update an existing PlayStation station
 */
export const update = mutation({
  args: {
    id: v.id('psStations'),
    name: v.optional(v.string()),
    nameAr: v.optional(v.string()),
    macAddress: v.optional(v.string()),
    hourlyRate: v.optional(v.number()),
    hourlyRateMulti: v.optional(v.number()),
    status: v.optional(v.string()),
    monitorIp: v.optional(v.string()),
    monitorPort: v.optional(v.number()),
    monitorType: v.optional(v.string()),
    timerEndAction: v.optional(v.string()),
    hdmiInput: v.optional(v.number()),
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
 * Update only the status field of a station
 */
export const updateStatus = mutation({
  args: {
    id: v.id('psStations'),
    status: v.string(),
  },
  handler: async (ctx, { id, status }) => {
    await ctx.db.patch(id, { status });
    return id;
  },
});

/**
 * Delete a PlayStation station
 */
export const remove = mutation({
  args: { id: v.id('psStations') },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
    return id;
  },
});
