/**
 * Convex queries and mutations for voucher usage tracking
 */

import { query, mutation } from './_generated/server';
import { v } from 'convex/values';

/**
 * Record or update voucher usage when a device connects (upsert)
 */
export const recordUsage = mutation({
  args: {
    voucherCode: v.string(),
    macAddress: v.string(),
    deviceName: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    totalBytes: v.optional(v.number()),
  },
  handler: async (ctx, { voucherCode, macAddress, deviceName, ipAddress, totalBytes }) => {
    const now = Date.now();
    const mac = macAddress.toUpperCase();

    // Check if record exists for this voucher+mac combo
    const existing = await ctx.db
      .query('voucherUsage')
      .withIndex('by_voucher', (q) => q.eq('voucherCode', voucherCode))
      .filter((q) => q.eq(q.field('macAddress'), mac))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        lastConnectedAt: now,
        deviceName: deviceName || existing.deviceName,
        ipAddress: ipAddress || existing.ipAddress,
        totalBytes: totalBytes ?? existing.totalBytes,
      });
    } else {
      await ctx.db.insert('voucherUsage', {
        voucherCode,
        macAddress: mac,
        deviceName: deviceName,
        ipAddress: ipAddress,
        firstConnectedAt: now,
        lastConnectedAt: now,
        totalBytes: totalBytes || 0,
      });
    }
  },
});

/**
 * Get usage history for a specific voucher
 */
export const getHistory = query({
  args: { voucherCode: v.string() },
  handler: async (ctx, { voucherCode }) => {
    return await ctx.db
      .query('voucherUsage')
      .withIndex('by_voucher', (q) => q.eq('voucherCode', voucherCode))
      .collect();
  },
});

/**
 * Delete all usage records for a voucher
 */
export const deleteHistory = mutation({
  args: { voucherCode: v.string() },
  handler: async (ctx, { voucherCode }) => {
    const records = await ctx.db
      .query('voucherUsage')
      .withIndex('by_voucher', (q) => q.eq('voucherCode', voucherCode))
      .collect();

    for (const record of records) {
      await ctx.db.delete(record._id);
    }
  },
});

/**
 * Get the most recently connected device for a voucher
 */
export const getLastDevice = query({
  args: { voucherCode: v.string() },
  handler: async (ctx, { voucherCode }) => {
    const records = await ctx.db
      .query('voucherUsage')
      .withIndex('by_voucher', (q) => q.eq('voucherCode', voucherCode))
      .collect();

    if (records.length === 0) return null;

    // Find the record with the highest lastConnectedAt
    return records.reduce((latest, record) =>
      record.lastConnectedAt > latest.lastConnectedAt ? record : latest
    );
  },
});

/**
 * Get all usage records
 */
export const getAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query('voucherUsage').collect();
  },
});

/**
 * Get device map: most recent device per voucher code
 * Returns array of {voucherCode, macAddress, deviceName}
 */
export const getDeviceMap = query({
  args: {},
  handler: async (ctx) => {
    const records = await ctx.db.query('voucherUsage').collect();

    // Group by voucherCode, keeping the most recent per voucher
    const map = new Map<string, { voucherCode: string; macAddress: string; deviceName?: string; lastConnectedAt: number }>();

    for (const record of records) {
      const existing = map.get(record.voucherCode);
      if (!existing || record.lastConnectedAt > existing.lastConnectedAt) {
        map.set(record.voucherCode, {
          voucherCode: record.voucherCode,
          macAddress: record.macAddress,
          deviceName: record.deviceName,
          lastConnectedAt: record.lastConnectedAt,
        });
      }
    }

    return Array.from(map.values()).map(({ voucherCode, macAddress, deviceName }) => ({
      voucherCode,
      macAddress,
      deviceName,
    }));
  },
});
