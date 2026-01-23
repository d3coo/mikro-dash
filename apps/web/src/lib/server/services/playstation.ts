import { db } from '$lib/server/db';
import { psStations, psSessions, psDailyStats, psMenuItems, psSessionOrders } from '$lib/server/db/schema';
import type { PsStation, NewPsStation, PsSession, NewPsSession, PsDailyStat, PsMenuItem, NewPsMenuItem, PsSessionOrder, NewPsSessionOrder } from '$lib/server/db/schema';
import { eq, desc, and, isNull, gte, lte, sql } from 'drizzle-orm';
import { getMikroTikClient } from './mikrotik';

// PlayStation MAC address prefixes (common OUI prefixes for Sony PlayStation)
export const PS_MAC_PREFIXES = [
  '00:1A:7D', // Sony older
  '00:1F:A7', // Sony
  '00:24:8D', // Sony
  '00:26:43', // Sony
  '28:0D:FC', // Sony
  '2C:CC:44', // Sony
  '38:0C:26', // Sony
  '40:B8:9A', // Sony
  '44:1E:A1', // Sony
  '4C:0B:BE', // Sony
  '54:A5:11', // Sony
  '5C:BA:37', // Sony
  '60:5B:B4', // Sony
  '70:9E:29', // Sony
  '78:C8:81', // Sony
  '7C:5A:1C', // Sony
  '8C:84:01', // Sony
  '90:34:FC', // Sony
  '98:22:EF', // Sony
  'A8:E3:EE', // Sony
  'AC:E4:B5', // Sony
  'B0:05:94', // Sony
  'BC:60:A7', // Sony
  'C8:63:F1', // Sony
  'D4:4B:5E', // Sony
  'D8:30:62', // Sony
  'FC:0F:E6', // Sony
  '00:D9:D1', // Sony PS5
  '08:5A:92', // Sony
];

/**
 * Check if a MAC address belongs to a PlayStation device
 */
export function isPlayStationMac(mac: string): boolean {
  const normalizedMac = mac.toUpperCase().replace(/-/g, ':');
  const prefix = normalizedMac.substring(0, 8);
  return PS_MAC_PREFIXES.includes(prefix);
}

// Grace period tracking (in-memory)
const gracePeriodTracker = new Map<string, number>(); // stationId -> disconnectTime

// Track the last known online state of each station (by MAC address)
// This prevents auto-starting sessions when device is already online
const stationOnlineStates = new Map<string, 'up' | 'down'>();

// Track manually ended sessions to prevent auto-restart
// Maps stationId -> timestamp when manually ended
const manualEndCooldown = new Map<string, number>();
const MANUAL_END_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes cooldown after manual end

/**
 * Get the last known online state of a station by MAC address
 */
export function getStationOnlineState(mac: string): 'up' | 'down' | undefined {
  const normalizedMac = mac.toUpperCase().replace(/-/g, ':');
  return stationOnlineStates.get(normalizedMac);
}

/**
 * Set the online state of a station by MAC address
 */
export function setStationOnlineState(mac: string, state: 'up' | 'down'): void {
  const normalizedMac = mac.toUpperCase().replace(/-/g, ':');
  stationOnlineStates.set(normalizedMac, state);
  console.log(`[State] ${normalizedMac} -> ${state}`);
}

/**
 * Check if a station is in manual-end cooldown (shouldn't auto-start)
 */
export function isInManualEndCooldown(stationId: string): boolean {
  const endTime = manualEndCooldown.get(stationId);
  if (!endTime) return false;

  const elapsed = Date.now() - endTime;
  if (elapsed >= MANUAL_END_COOLDOWN_MS) {
    // Cooldown expired, remove from map
    manualEndCooldown.delete(stationId);
    return false;
  }

  console.log(`[Cooldown] Station ${stationId} in manual-end cooldown (${Math.round((MANUAL_END_COOLDOWN_MS - elapsed) / 1000)}s remaining)`);
  return true;
}

/**
 * Set manual-end cooldown for a station (called when session is manually ended)
 */
export function setManualEndCooldown(stationId: string): void {
  manualEndCooldown.set(stationId, Date.now());
  console.log(`[Cooldown] Station ${stationId} entering 5-minute auto-start cooldown`);
}

/**
 * Clear manual-end cooldown (called when device actually disconnects)
 */
export function clearManualEndCooldown(stationId: string): void {
  if (manualEndCooldown.has(stationId)) {
    manualEndCooldown.delete(stationId);
    console.log(`[Cooldown] Station ${stationId} cooldown cleared (device disconnected)`);
  }
}
const GRACE_PERIOD_MS = 1 * 60 * 1000; // 1 minute grace period before auto-ending

// ===== STATION CRUD =====

export function getStations(): PsStation[] {
  return db.select().from(psStations).orderBy(psStations.id).all();
}

export function getStationById(id: string): PsStation | undefined {
  return db.select().from(psStations).where(eq(psStations.id, id)).get();
}

export function createStation(data: {
  id: string;
  name: string;
  nameAr: string;
  macAddress: string;
  hourlyRate: number;
  monitorIp?: string | null;
  monitorPort?: number | null;
  monitorType?: string | null;
  timerEndAction?: string | null;
  hdmiInput?: number | null;
  sortOrder?: number;
}): PsStation {
  const now = Date.now();
  const station: NewPsStation = {
    id: data.id,
    name: data.name,
    nameAr: data.nameAr,
    macAddress: data.macAddress.toUpperCase().replace(/-/g, ':'),
    hourlyRate: data.hourlyRate,
    status: 'available',
    monitorIp: data.monitorIp ?? null,
    monitorPort: data.monitorPort ?? 8080,
    monitorType: data.monitorType ?? 'tcl',
    timerEndAction: data.timerEndAction ?? 'notify',
    hdmiInput: data.hdmiInput ?? 2,
    sortOrder: data.sortOrder ?? 0,
    createdAt: now,
    updatedAt: now
  };

  db.insert(psStations).values(station).run();
  return getStationById(data.id)!;
}

export function updateStation(id: string, updates: Partial<{
  name: string;
  nameAr: string;
  macAddress: string;
  hourlyRate: number;
  status: string;
  monitorIp: string | null;
  monitorPort: number | null;
  monitorType: string | null;
  timerEndAction: string | null;
  hdmiInput: number | null;
  sortOrder: number;
}>): void {
  const station = getStationById(id);
  if (!station) throw new Error(`Station ${id} not found`);

  const updateData: Partial<PsStation> = { updatedAt: Date.now() };
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.nameAr !== undefined) updateData.nameAr = updates.nameAr;
  if (updates.macAddress !== undefined) updateData.macAddress = updates.macAddress.toUpperCase().replace(/-/g, ':');
  if (updates.hourlyRate !== undefined) updateData.hourlyRate = updates.hourlyRate;
  if (updates.status !== undefined) updateData.status = updates.status;
  if (updates.monitorIp !== undefined) updateData.monitorIp = updates.monitorIp;
  if (updates.monitorPort !== undefined) updateData.monitorPort = updates.monitorPort;
  if (updates.monitorType !== undefined) updateData.monitorType = updates.monitorType;
  if (updates.timerEndAction !== undefined) updateData.timerEndAction = updates.timerEndAction;
  if (updates.hdmiInput !== undefined) updateData.hdmiInput = updates.hdmiInput;
  if (updates.sortOrder !== undefined) updateData.sortOrder = updates.sortOrder;

  db.update(psStations).set(updateData).where(eq(psStations.id, id)).run();
}

export function deleteStation(id: string): void {
  // End any active session first
  const activeSession = getActiveSessionForStation(id);
  if (activeSession) {
    endSession(activeSession.id);
  }

  db.delete(psStations).where(eq(psStations.id, id)).run();
}

// ===== SESSION MANAGEMENT =====

export function startSession(
  stationId: string,
  startedBy: 'manual' | 'auto' = 'manual',
  timerMinutes?: number,
  costLimitPiasters?: number
): PsSession {
  const station = getStationById(stationId);
  if (!station) throw new Error(`Station ${stationId} not found`);

  // Check if already has active session
  const existing = getActiveSessionForStation(stationId);
  if (existing) throw new Error(`Station ${stationId} already has an active session`);

  const now = Date.now();
  const session: NewPsSession = {
    stationId,
    startedAt: now,
    endedAt: null,
    hourlyRateSnapshot: station.hourlyRate,
    totalCost: null,
    ordersCost: 0,
    startedBy,
    timerMinutes: timerMinutes || null,
    timerNotified: 0,
    costLimitPiasters: costLimitPiasters || null,
    costLimitNotified: 0,
    notes: null,
    createdAt: now
  };

  const result = db.insert(psSessions).values(session).run();

  // Update station status
  updateStation(stationId, { status: 'occupied' });

  // Clear grace period if any
  gracePeriodTracker.delete(stationId);

  return db.select().from(psSessions).where(eq(psSessions.id, result.lastInsertRowid as number)).get()!;
}

export function endSession(sessionId: number, notes?: string, customTotalCost?: number): PsSession {
  const session = db.select().from(psSessions).where(eq(psSessions.id, sessionId)).get();
  if (!session) throw new Error(`Session ${sessionId} not found`);
  if (session.endedAt) throw new Error(`Session ${sessionId} already ended`);

  const now = Date.now();
  const calculatedGamingCost = calculateSessionCost(session, now);
  const ordersCost = session.ordersCost || 0;

  // Use custom total cost if provided, otherwise calculate normally
  let finalTotalCost: number;
  let gamingCostToStore: number;

  if (customTotalCost !== undefined) {
    // Custom amount specified - this is the final total (gaming + orders)
    finalTotalCost = customTotalCost;
    // Store gaming cost as: custom total - orders cost (can be negative if custom is less than orders)
    gamingCostToStore = Math.max(0, customTotalCost - ordersCost);
  } else {
    // Normal calculation
    gamingCostToStore = calculatedGamingCost;
    finalTotalCost = calculatedGamingCost + ordersCost;
  }

  db.update(psSessions).set({
    endedAt: now,
    totalCost: gamingCostToStore, // Gaming cost only (orders tracked separately)
    notes: notes || session.notes
  }).where(eq(psSessions.id, sessionId)).run();

  // Update station status
  updateStation(session.stationId, { status: 'available' });

  // Update daily stats with the final total cost
  updateDailyStats(session.stationId, session.startedAt, now, finalTotalCost);

  // Clear grace period
  gracePeriodTracker.delete(session.stationId);

  // If session was manual or has custom cost, set cooldown to prevent auto-restart
  // (auto sessions ended by webhook don't need cooldown as device already disconnected)
  if (session.startedBy === 'manual' || customTotalCost !== undefined) {
    setManualEndCooldown(session.stationId);
  }

  return db.select().from(psSessions).where(eq(psSessions.id, sessionId)).get()!;
}

export function calculateSessionCost(session: PsSession, endTime?: number): number {
  const end = endTime || session.endedAt || Date.now();
  let durationMs = end - session.startedAt;

  // Subtract paused time
  const totalPausedMs = session.totalPausedMs || 0;
  // If currently paused, also subtract time since pausedAt
  const currentlyPausedMs = session.pausedAt ? (Date.now() - session.pausedAt) : 0;
  durationMs -= (totalPausedMs + currentlyPausedMs);

  // Ensure duration is never negative
  if (durationMs < 0) durationMs = 0;

  // Rate is in piasters (100 piasters = 1 EGP)
  // Round up to nearest minute
  const durationMinutes = Math.ceil(durationMs / (1000 * 60));
  const cost = Math.round((session.hourlyRateSnapshot * durationMinutes) / 60);

  return cost;
}

export function getActiveSessionForStation(stationId: string): PsSession | undefined {
  return db.select()
    .from(psSessions)
    .where(and(
      eq(psSessions.stationId, stationId),
      isNull(psSessions.endedAt)
    ))
    .get();
}

/**
 * Get the most recently ended session for a station (for showing final cost)
 */
export function getLastSessionForStation(stationId: string): PsSession | null {
  const session = db.select()
    .from(psSessions)
    .where(and(
      eq(psSessions.stationId, stationId),
      sql`${psSessions.endedAt} IS NOT NULL`
    ))
    .orderBy(desc(psSessions.endedAt))
    .limit(1)
    .get();
  return session || null;
}

export function getActiveSessions(): PsSession[] {
  return db.select()
    .from(psSessions)
    .where(isNull(psSessions.endedAt))
    .all();
}

export function getSessionHistory(options?: {
  stationId?: string;
  startDate?: number;
  endDate?: number;
  limit?: number;
}): PsSession[] {
  let query = db.select().from(psSessions);

  const conditions = [];
  if (options?.stationId) {
    conditions.push(eq(psSessions.stationId, options.stationId));
  }
  if (options?.startDate) {
    conditions.push(gte(psSessions.startedAt, options.startDate));
  }
  if (options?.endDate) {
    conditions.push(lte(psSessions.startedAt, options.endDate));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }

  const sessions = query.orderBy(desc(psSessions.startedAt)).all();

  if (options?.limit) {
    return sessions.slice(0, options.limit);
  }
  return sessions;
}

// ===== AUTO-DETECTION =====

export interface StationStatus {
  station: PsStation;
  isOnline: boolean;
  activeSession: PsSession | null | undefined;
  lastSession: PsSession | null;  // Most recent ended session (for showing final cost)
  elapsedMinutes: number;
  currentCost: number;
  isOfflineWithSession: boolean;  // Device offline but session still running - show RED card
  isPaused: boolean;              // Session timer is paused (PS offline)
}

/**
 * Detect online stations by querying MikroTik wireless registration table
 */
export async function detectOnlineStations(): Promise<Map<string, boolean>> {
  const client = getMikroTikClient();
  const registrations = await client.getWirelessRegistrations();

  // Get all stations
  const stations = getStations();

  // Create MAC to online map
  const onlineMap = new Map<string, boolean>();
  const connectedMacs = new Set(
    registrations.map(r => r['mac-address'].toUpperCase().replace(/-/g, ':'))
  );

  for (const station of stations) {
    const normalizedMac = station.macAddress.toUpperCase().replace(/-/g, ':');
    onlineMap.set(station.id, connectedMacs.has(normalizedMac));
  }

  return onlineMap;
}

/**
 * Sync station status with router and auto-start/end sessions
 */
export async function syncStationStatus(): Promise<{
  started: string[];
  ended: string[];
}> {
  const onlineMap = await detectOnlineStations();
  const stations = getStations();
  const now = Date.now();

  const started: string[] = [];
  const ended: string[] = [];

  for (const station of stations) {
    // Skip stations in maintenance
    if (station.status === 'maintenance') continue;

    const isOnline = onlineMap.get(station.id) ?? false;
    const activeSession = getActiveSessionForStation(station.id);

    const normalizedMac = station.macAddress.toUpperCase().replace(/-/g, ':');
    const previousState = stationOnlineStates.get(normalizedMac);

    if (isOnline) {
      // Clear grace period
      gracePeriodTracker.delete(station.id);

      // Check if this is a state transition (first connect)
      const isFirstConnect = previousState !== 'up';
      stationOnlineStates.set(normalizedMac, 'up');

      // Resume paused session if exists
      if (activeSession && activeSession.pausedAt) {
        resumeSession(activeSession.id);
        console.log(`[Sync] Resumed paused session for ${station.id}`);
      }

      // Auto-start only on first connect (state transition) and not in cooldown
      if (!activeSession && isFirstConnect) {
        // Check cooldown
        if (isInManualEndCooldown(station.id)) {
          console.log(`[Sync] Station ${station.id} in cooldown - not auto-starting`);
        } else {
          try {
            startSession(station.id, 'auto');
            started.push(station.id);
            console.log(`[Sync] Auto-started session for ${station.id} - first connect`);
          } catch (e) {
            console.error(`Failed to auto-start session for ${station.id}:`, e);
          }
        }
      }
    } else {
      // Device is offline - just update state, NEVER auto-end
      stationOnlineStates.set(normalizedMac, 'down');
      clearManualEndCooldown(station.id);

      // Pause the session timer if PS goes offline
      if (activeSession && !activeSession.pausedAt) {
        pauseSession(activeSession.id);
        console.log(`[Sync] Paused session for ${station.id} - PS went offline`);
      }
    }
  }

  return { started, ended };
}

/**
 * Get full station status with session info
 */
export async function getStationStatuses(): Promise<StationStatus[]> {
  const stations = getStations();
  let onlineMap: Map<string, boolean>;

  try {
    onlineMap = await detectOnlineStations();
  } catch (e) {
    console.error('Failed to detect online stations:', e);
    onlineMap = new Map();
  }

  const now = Date.now();

  return stations.map(station => {
    const activeSession = getActiveSessionForStation(station.id);
    const lastSession = !activeSession ? getLastSessionForStation(station.id) : null;
    const isOnline = onlineMap.get(station.id) ?? false;
    const graceStart = gracePeriodTracker.get(station.id);

    let elapsedMinutes = 0;
    let currentCost = 0;

    if (activeSession) {
      // Calculate elapsed time accounting for paused time
      let elapsedMs = now - activeSession.startedAt;
      const totalPausedMs = activeSession.totalPausedMs || 0;
      const currentlyPausedMs = activeSession.pausedAt ? (now - activeSession.pausedAt) : 0;
      elapsedMs -= (totalPausedMs + currentlyPausedMs);
      if (elapsedMs < 0) elapsedMs = 0;

      elapsedMinutes = Math.floor(elapsedMs / (1000 * 60));
      currentCost = calculateSessionCost(activeSession, now);
    }

    return {
      station,
      isOnline,
      activeSession,
      lastSession,
      elapsedMinutes,
      currentCost,
      isOfflineWithSession: !isOnline && !!activeSession,  // RED card when offline but session running
      isPaused: !!activeSession?.pausedAt                   // Timer is paused
    };
  });
}

// ===== DAILY STATS =====

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

function updateDailyStats(stationId: string, startedAt: number, endedAt: number, cost: number): void {
  const date = new Date(endedAt).toISOString().split('T')[0];
  const durationMinutes = Math.floor((endedAt - startedAt) / (1000 * 60));

  let stats = db.select().from(psDailyStats).where(eq(psDailyStats.date, date)).get();

  if (!stats) {
    const now = Date.now();
    db.insert(psDailyStats).values({
      date,
      totalSessions: 1,
      totalMinutes: durationMinutes,
      totalRevenue: cost,
      sessionsByStation: JSON.stringify({ [stationId]: 1 }),
      createdAt: now,
      updatedAt: now
    }).run();
  } else {
    const sessionsByStation = JSON.parse(stats.sessionsByStation) as Record<string, number>;
    sessionsByStation[stationId] = (sessionsByStation[stationId] || 0) + 1;

    db.update(psDailyStats).set({
      totalSessions: stats.totalSessions + 1,
      totalMinutes: stats.totalMinutes + durationMinutes,
      totalRevenue: stats.totalRevenue + cost,
      sessionsByStation: JSON.stringify(sessionsByStation),
      updatedAt: Date.now()
    }).where(eq(psDailyStats.id, stats.id)).run();
  }
}

// ===== ANALYTICS =====

export interface PsAnalyticsSummary {
  totalSessions: number;
  totalMinutes: number;
  totalRevenue: number;  // In piasters
  sessionsByStation: Record<string, number>;
  dailyStats: PsDailyStat[];
}

export function getPsAnalytics(period: 'today' | 'week' | 'month'): PsAnalyticsSummary {
  const now = new Date();
  let startDate: string;

  switch (period) {
    case 'today':
      startDate = now.toISOString().split('T')[0];
      break;
    case 'week':
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      startDate = weekAgo.toISOString().split('T')[0];
      break;
    case 'month':
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      startDate = monthAgo.toISOString().split('T')[0];
      break;
  }

  const stats = db.select()
    .from(psDailyStats)
    .where(gte(psDailyStats.date, startDate))
    .orderBy(desc(psDailyStats.date))
    .all();

  let totalSessions = 0;
  let totalMinutes = 0;
  let totalRevenue = 0;
  const sessionsByStation: Record<string, number> = {};

  for (const stat of stats) {
    totalSessions += stat.totalSessions;
    totalMinutes += stat.totalMinutes;
    totalRevenue += stat.totalRevenue;

    const byStation = JSON.parse(stat.sessionsByStation) as Record<string, number>;
    for (const [stationId, count] of Object.entries(byStation)) {
      sessionsByStation[stationId] = (sessionsByStation[stationId] || 0) + count;
    }
  }

  return {
    totalSessions,
    totalMinutes,
    totalRevenue,
    sessionsByStation,
    dailyStats: stats
  };
}

/**
 * Get today's PlayStation revenue in piasters (for dashboard)
 */
export function getTodayPsRevenue(): number {
  const today = getToday();
  const stats = db.select().from(psDailyStats).where(eq(psDailyStats.date, today)).get();

  // Also count active sessions' current cost
  const activeSessions = getActiveSessions();
  let activeRevenue = 0;
  for (const session of activeSessions) {
    activeRevenue += calculateSessionCost(session);
    activeRevenue += session.ordersCost || 0;
  }

  return (stats?.totalRevenue || 0) + activeRevenue;
}

// ===== MENU ITEMS =====

export function getMenuItems(): PsMenuItem[] {
  return db.select().from(psMenuItems).orderBy(psMenuItems.sortOrder).all();
}

export function getMenuItemById(id: number): PsMenuItem | undefined {
  return db.select().from(psMenuItems).where(eq(psMenuItems.id, id)).get();
}

export function getMenuItemsByCategory(category: string): PsMenuItem[] {
  return db.select()
    .from(psMenuItems)
    .where(eq(psMenuItems.category, category))
    .orderBy(psMenuItems.sortOrder)
    .all();
}

export function createMenuItem(data: {
  name: string;
  nameAr: string;
  category: string;
  price: number;
  sortOrder?: number;
}): PsMenuItem {
  const now = Date.now();
  const items = getMenuItems();

  const result = db.insert(psMenuItems).values({
    name: data.name,
    nameAr: data.nameAr,
    category: data.category,
    price: data.price,
    isAvailable: 1,
    sortOrder: data.sortOrder ?? items.length,
    createdAt: now,
    updatedAt: now
  }).run();

  return getMenuItemById(result.lastInsertRowid as number)!;
}

export function updateMenuItem(id: number, updates: Partial<{
  name: string;
  nameAr: string;
  category: string;
  price: number;
  isAvailable: number;
  sortOrder: number;
}>): void {
  const item = getMenuItemById(id);
  if (!item) throw new Error(`Menu item ${id} not found`);

  const updateData: Record<string, unknown> = { updatedAt: Date.now() };
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.nameAr !== undefined) updateData.nameAr = updates.nameAr;
  if (updates.category !== undefined) updateData.category = updates.category;
  if (updates.price !== undefined) updateData.price = updates.price;
  if (updates.isAvailable !== undefined) updateData.isAvailable = updates.isAvailable;
  if (updates.sortOrder !== undefined) updateData.sortOrder = updates.sortOrder;

  db.update(psMenuItems).set(updateData).where(eq(psMenuItems.id, id)).run();
}

export function deleteMenuItem(id: number): void {
  db.delete(psMenuItems).where(eq(psMenuItems.id, id)).run();
}

// ===== SESSION ORDERS =====

export interface SessionOrderWithItem extends PsSessionOrder {
  menuItem: PsMenuItem | null;
}

export function getSessionOrders(sessionId: number): SessionOrderWithItem[] {
  const orders = db.select()
    .from(psSessionOrders)
    .where(eq(psSessionOrders.sessionId, sessionId))
    .orderBy(desc(psSessionOrders.createdAt))
    .all();

  return orders.map(order => ({
    ...order,
    menuItem: getMenuItemById(order.menuItemId) || null
  }));
}

export function addOrderToSession(sessionId: number, menuItemId: number, quantity: number = 1): PsSessionOrder {
  const session = db.select().from(psSessions).where(eq(psSessions.id, sessionId)).get();
  if (!session) throw new Error(`Session ${sessionId} not found`);
  if (session.endedAt) throw new Error(`Session ${sessionId} already ended`);

  const menuItem = getMenuItemById(menuItemId);
  if (!menuItem) throw new Error(`Menu item ${menuItemId} not found`);
  if (!menuItem.isAvailable) throw new Error(`Menu item ${menuItem.nameAr} is not available`);

  const orderCost = menuItem.price * quantity;

  // Check if this item already exists in the session's orders
  const existingOrder = db.select()
    .from(psSessionOrders)
    .where(and(
      eq(psSessionOrders.sessionId, sessionId),
      eq(psSessionOrders.menuItemId, menuItemId)
    ))
    .get();

  if (existingOrder) {
    // Update existing order quantity
    const newQuantity = existingOrder.quantity + quantity;
    db.update(psSessionOrders).set({
      quantity: newQuantity
    }).where(eq(psSessionOrders.id, existingOrder.id)).run();

    // Update session's orders cost
    const currentOrdersCost = session.ordersCost || 0;
    db.update(psSessions).set({
      ordersCost: currentOrdersCost + orderCost
    }).where(eq(psSessions.id, sessionId)).run();

    return db.select().from(psSessionOrders).where(eq(psSessionOrders.id, existingOrder.id)).get()!;
  }

  // Insert new order
  const now = Date.now();
  const result = db.insert(psSessionOrders).values({
    sessionId,
    menuItemId,
    quantity,
    priceSnapshot: menuItem.price,
    createdAt: now
  }).run();

  // Update session's orders cost
  const currentOrdersCost = session.ordersCost || 0;
  db.update(psSessions).set({
    ordersCost: currentOrdersCost + orderCost
  }).where(eq(psSessions.id, sessionId)).run();

  return db.select().from(psSessionOrders).where(eq(psSessionOrders.id, result.lastInsertRowid as number)).get()!;
}

export function removeOrderFromSession(orderId: number): void {
  const order = db.select().from(psSessionOrders).where(eq(psSessionOrders.id, orderId)).get();
  if (!order) throw new Error(`Order ${orderId} not found`);

  const session = db.select().from(psSessions).where(eq(psSessions.id, order.sessionId)).get();
  if (!session) throw new Error(`Session not found`);
  if (session.endedAt) throw new Error(`Cannot modify ended session`);

  const orderCost = order.priceSnapshot * order.quantity;

  // Remove order
  db.delete(psSessionOrders).where(eq(psSessionOrders.id, orderId)).run();

  // Update session's orders cost
  const currentOrdersCost = session.ordersCost || 0;
  db.update(psSessions).set({
    ordersCost: Math.max(0, currentOrdersCost - orderCost)
  }).where(eq(psSessions.id, order.sessionId)).run();
}

// ===== TIMER ALERTS =====

export interface TimerAlert {
  sessionId: number;
  stationId: string;
  stationName: string;
  timerMinutes: number;
  elapsedMinutes: number;
  isExpired: boolean;
}

export function getTimerAlerts(): TimerAlert[] {
  const activeSessions = getActiveSessions();
  const alerts: TimerAlert[] = [];
  const now = Date.now();

  for (const session of activeSessions) {
    if (session.timerMinutes && !session.timerNotified) {
      const elapsedMinutes = Math.floor((now - session.startedAt) / (1000 * 60));
      const isExpired = elapsedMinutes >= session.timerMinutes;

      if (isExpired) {
        const station = getStationById(session.stationId);
        alerts.push({
          sessionId: session.id,
          stationId: session.stationId,
          stationName: station?.nameAr || session.stationId,
          timerMinutes: session.timerMinutes,
          elapsedMinutes,
          isExpired
        });
      }
    }
  }

  return alerts;
}

export function markTimerNotified(sessionId: number): void {
  db.update(psSessions).set({
    timerNotified: 1
  }).where(eq(psSessions.id, sessionId)).run();
}

export function setSessionTimer(sessionId: number, timerMinutes: number | null): void {
  const session = db.select().from(psSessions).where(eq(psSessions.id, sessionId)).get();
  if (!session) throw new Error(`Session ${sessionId} not found`);
  if (session.endedAt) throw new Error(`Session ${sessionId} already ended`);

  db.update(psSessions).set({
    timerMinutes,
    timerNotified: 0
  }).where(eq(psSessions.id, sessionId)).run();
}

/**
 * Pause a session (when PS goes offline)
 * Sets pausedAt to current time if not already paused
 */
export function pauseSession(sessionId: number): void {
  const session = db.select().from(psSessions).where(eq(psSessions.id, sessionId)).get();
  if (!session) return;
  if (session.endedAt) return; // Session already ended
  if (session.pausedAt) return; // Already paused

  db.update(psSessions).set({
    pausedAt: Date.now()
  }).where(eq(psSessions.id, sessionId)).run();

  console.log(`[Session] Paused session ${sessionId} - PS went offline`);
}

/**
 * Resume a session (when PS comes back online)
 * Adds paused duration to totalPausedMs and clears pausedAt
 */
export function resumeSession(sessionId: number): void {
  const session = db.select().from(psSessions).where(eq(psSessions.id, sessionId)).get();
  if (!session) return;
  if (session.endedAt) return; // Session already ended
  if (!session.pausedAt) return; // Not paused

  const pausedDuration = Date.now() - session.pausedAt;
  const newTotalPaused = (session.totalPausedMs || 0) + pausedDuration;

  db.update(psSessions).set({
    pausedAt: null,
    totalPausedMs: newTotalPaused
  }).where(eq(psSessions.id, sessionId)).run();

  console.log(`[Session] Resumed session ${sessionId} - was paused for ${Math.round(pausedDuration / 1000)}s, total paused: ${Math.round(newTotalPaused / 1000)}s`);
}

/**
 * Check if a session is currently paused
 */
export function isSessionPaused(sessionId: number): boolean {
  const session = db.select().from(psSessions).where(eq(psSessions.id, sessionId)).get();
  return session?.pausedAt != null;
}

// ===== STATION EARNINGS =====

export interface StationEarnings {
  stationId: string;
  stationName: string;
  todayEarnings: number;
  totalSessions: number;
  totalMinutes: number;
}

export function getStationEarnings(): StationEarnings[] {
  const stations = getStations();
  const today = getToday();
  const stats = db.select().from(psDailyStats).where(eq(psDailyStats.date, today)).get();

  const sessionsByStation = stats
    ? JSON.parse(stats.sessionsByStation) as Record<string, number>
    : {};

  // Get today's sessions for each station
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  return stations.map(station => {
    // Get today's completed sessions for this station
    const sessions = db.select()
      .from(psSessions)
      .where(and(
        eq(psSessions.stationId, station.id),
        gte(psSessions.startedAt, todayStart.getTime())
      ))
      .all();

    let todayEarnings = 0;
    let totalMinutes = 0;

    for (const session of sessions) {
      if (session.endedAt) {
        todayEarnings += (session.totalCost || 0) + (session.ordersCost || 0);
        totalMinutes += Math.floor((session.endedAt - session.startedAt) / (1000 * 60));
      } else {
        // Active session - calculate current cost
        todayEarnings += calculateSessionCost(session) + (session.ordersCost || 0);
        totalMinutes += Math.floor((Date.now() - session.startedAt) / (1000 * 60));
      }
    }

    return {
      stationId: station.id,
      stationName: station.nameAr,
      todayEarnings,
      totalSessions: sessionsByStation[station.id] || 0,
      totalMinutes
    };
  });
}
