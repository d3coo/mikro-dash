/**
 * Convex mutations for importing SQLite data
 * These are public mutations called by the migration runner script
 * After migration, these can be deleted or converted to mutation
 */

import { mutation } from '../_generated/server';
import { v } from 'convex/values';

// ============= PHASE 1: Independent tables =============

export const insertSettings = mutation({
  args: { items: v.array(v.any()) },
  handler: async (ctx, { items }) => {
    for (const item of items) {
      await ctx.db.insert('settings', {
        key: item.key,
        value: item.value,
      });
    }
    return { inserted: items.length };
  },
});

export const insertPackages = mutation({
  args: { items: v.array(v.any()) },
  handler: async (ctx, { items }) => {
    const idMap: Record<string, string> = {};
    for (const item of items) {
      const id = await ctx.db.insert('packages', {
        name: item.name,
        nameAr: item.name_ar,
        priceLE: item.price_le,
        bytesLimit: item.bytes_limit || 0,
        timeLimit: item.time_limit || '1d',
        profile: item.profile,
        server: item.server || undefined,
        sortOrder: item.sort_order || 0,
      });
      idMap[item.id] = id;
    }
    return { inserted: items.length, idMap };
  },
});

export const insertPsStations = mutation({
  args: { items: v.array(v.any()) },
  handler: async (ctx, { items }) => {
    const idMap: Record<string, string> = {};
    for (const item of items) {
      const id = await ctx.db.insert('psStations', {
        name: item.name,
        nameAr: item.name_ar,
        macAddress: item.mac_address,
        hourlyRate: item.hourly_rate,
        hourlyRateMulti: item.hourly_rate_multi || undefined,
        status: item.status || 'available',
        monitorIp: item.monitor_ip || undefined,
        monitorPort: item.monitor_port || 8080,
        monitorType: item.monitor_type || 'tcl',
        timerEndAction: item.timer_end_action || 'notify',
        hdmiInput: item.hdmi_input || 2,
        sortOrder: item.sort_order || 0,
      });
      idMap[item.id] = id;
    }
    return { inserted: items.length, idMap };
  },
});

export const insertPsMenuItems = mutation({
  args: { items: v.array(v.any()) },
  handler: async (ctx, { items }) => {
    const idMap: Record<number, string> = {};
    for (const item of items) {
      const id = await ctx.db.insert('psMenuItems', {
        name: item.name,
        nameAr: item.name_ar,
        category: item.category,
        price: item.price,
        isAvailable: item.is_available === 1,
        sortOrder: item.sort_order || 0,
      });
      idMap[item.id] = id;
    }
    return { inserted: items.length, idMap };
  },
});

export const insertExpenses = mutation({
  args: { items: v.array(v.any()) },
  handler: async (ctx, { items }) => {
    for (const item of items) {
      await ctx.db.insert('expenses', {
        type: item.type,
        category: item.category || 'general',
        name: item.name,
        nameAr: item.name_ar,
        amount: item.amount,
        isActive: item.is_active === 1,
      });
    }
    return { inserted: items.length };
  },
});

export const insertPrintedVouchers = mutation({
  args: { items: v.array(v.any()) },
  handler: async (ctx, { items }) => {
    for (const item of items) {
      await ctx.db.insert('printedVouchers', {
        voucherCode: item.voucher_code,
        printedAt: item.printed_at,
      });
    }
    return { inserted: items.length };
  },
});

export const insertVoucherUsage = mutation({
  args: { items: v.array(v.any()) },
  handler: async (ctx, { items }) => {
    for (const item of items) {
      await ctx.db.insert('voucherUsage', {
        voucherCode: item.voucher_code,
        macAddress: item.mac_address,
        deviceName: item.device_name || undefined,
        ipAddress: item.ip_address || undefined,
        firstConnectedAt: item.first_connected_at,
        lastConnectedAt: item.last_connected_at,
        totalBytes: item.total_bytes || 0,
      });
    }
    return { inserted: items.length };
  },
});

export const insertUnifiedDailyStats = mutation({
  args: { items: v.array(v.any()) },
  handler: async (ctx, { items }) => {
    for (const item of items) {
      await ctx.db.insert('unifiedDailyStats', {
        date: item.date,
        wifiRevenue: item.wifi_revenue || 0,
        wifiVouchersSold: item.wifi_vouchers_sold || 0,
        wifiDataSold: item.wifi_data_sold || 0,
        wifiDataUsed: item.wifi_data_used || 0,
        psGamingRevenue: item.ps_gaming_revenue || 0,
        psSessions: item.ps_sessions || 0,
        psMinutes: item.ps_minutes || 0,
        psOrdersRevenue: item.ps_orders_revenue || 0,
        fnbRevenue: item.fnb_revenue || 0,
        fnbItemsSold: item.fnb_items_sold || 0,
      });
    }
    return { inserted: items.length };
  },
});

// ============= PHASE 2: Dependent tables =============

export const insertPsSessions = mutation({
  args: {
    items: v.array(v.any()),
    stationIdMap: v.any(),
  },
  handler: async (ctx, { items, stationIdMap }) => {
    const idMap: Record<number, string> = {};
    let skipped = 0;

    for (const item of items) {
      const stationId = stationIdMap[item.station_id];
      if (!stationId) {
        console.warn(`[Migration] Station not found: ${item.station_id}`);
        skipped++;
        continue;
      }

      const id = await ctx.db.insert('psSessions', {
        stationId,
        startedAt: item.started_at,
        endedAt: item.ended_at || undefined,
        hourlyRateSnapshot: item.hourly_rate_snapshot,
        totalCost: item.total_cost || undefined,
        ordersCost: item.orders_cost || 0,
        extraCharges: item.extra_charges || 0,
        transferredCost: item.transferred_cost || 0,
        currentMode: item.current_mode || 'single',
        startedBy: item.started_by || 'manual',
        timerMinutes: item.timer_minutes || undefined,
        timerNotified: item.timer_notified === 1,
        costLimitPiasters: item.cost_limit_piasters || undefined,
        costLimitNotified: item.cost_limit_notified === 1,
        pausedAt: item.paused_at || undefined,
        totalPausedMs: item.total_paused_ms || 0,
        notes: item.notes || undefined,
      });
      idMap[item.id] = id;
    }
    return { inserted: items.length - skipped, skipped, idMap };
  },
});

export const insertPsSessionOrders = mutation({
  args: {
    items: v.array(v.any()),
    sessionIdMap: v.any(),
    menuItemIdMap: v.any(),
  },
  handler: async (ctx, { items, sessionIdMap, menuItemIdMap }) => {
    let inserted = 0;
    let skipped = 0;

    for (const item of items) {
      const sessionId = sessionIdMap[item.session_id];
      const menuItemId = menuItemIdMap[item.menu_item_id];

      if (!sessionId || !menuItemId) {
        skipped++;
        continue;
      }

      await ctx.db.insert('psSessionOrders', {
        sessionId,
        menuItemId,
        quantity: item.quantity || 1,
        priceSnapshot: item.price_snapshot,
        createdAt: item.created_at,
      });
      inserted++;
    }
    return { inserted, skipped };
  },
});

export const insertPsSessionCharges = mutation({
  args: {
    items: v.array(v.any()),
    sessionIdMap: v.any(),
  },
  handler: async (ctx, { items, sessionIdMap }) => {
    let inserted = 0;
    let skipped = 0;

    for (const item of items) {
      const sessionId = sessionIdMap[item.session_id];
      if (!sessionId) {
        skipped++;
        continue;
      }

      await ctx.db.insert('psSessionCharges', {
        sessionId,
        amount: item.amount,
        reason: item.reason || undefined,
        createdAt: item.created_at,
      });
      inserted++;
    }
    return { inserted, skipped };
  },
});

export const insertPsSessionSegments = mutation({
  args: {
    items: v.array(v.any()),
    sessionIdMap: v.any(),
  },
  handler: async (ctx, { items, sessionIdMap }) => {
    let inserted = 0;
    let skipped = 0;

    for (const item of items) {
      const sessionId = sessionIdMap[item.session_id];
      if (!sessionId) {
        skipped++;
        continue;
      }

      await ctx.db.insert('psSessionSegments', {
        sessionId,
        mode: item.mode,
        startedAt: item.started_at,
        endedAt: item.ended_at || undefined,
        hourlyRateSnapshot: item.hourly_rate_snapshot,
      });
      inserted++;
    }
    return { inserted, skipped };
  },
});

export const insertPsSessionTransfers = mutation({
  args: {
    items: v.array(v.any()),
    sessionIdMap: v.any(),
    stationIdMap: v.any(),
  },
  handler: async (ctx, { items, sessionIdMap, stationIdMap }) => {
    let inserted = 0;
    let skipped = 0;

    for (const item of items) {
      const fromSessionId = sessionIdMap[item.from_session_id];
      const toSessionId = sessionIdMap[item.to_session_id];
      const fromStationId = stationIdMap[item.from_station_id];

      if (!fromSessionId || !toSessionId || !fromStationId) {
        skipped++;
        continue;
      }

      await ctx.db.insert('psSessionTransfers', {
        fromSessionId,
        toSessionId,
        fromStationId,
        gamingAmount: item.gaming_amount,
        ordersAmount: item.orders_amount,
        totalAmount: item.total_amount,
        createdAt: item.created_at,
      });
      inserted++;
    }
    return { inserted, skipped };
  },
});

export const insertFnbSales = mutation({
  args: {
    items: v.array(v.any()),
    menuItemIdMap: v.any(),
  },
  handler: async (ctx, { items, menuItemIdMap }) => {
    let inserted = 0;
    let skipped = 0;

    for (const item of items) {
      const menuItemId = menuItemIdMap[item.menu_item_id];
      if (!menuItemId) {
        skipped++;
        continue;
      }

      await ctx.db.insert('fnbSales', {
        menuItemId,
        quantity: item.quantity || 1,
        priceSnapshot: item.price_snapshot,
        soldAt: item.sold_at,
      });
      inserted++;
    }
    return { inserted, skipped };
  },
});
