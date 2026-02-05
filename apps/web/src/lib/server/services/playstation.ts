import { db, syncAfterWrite } from '$lib/server/db';
import { psStations, psSessions, psDailyStats, psMenuItems, psSessionOrders, psSessionCharges, psSessionTransfers, psSessionSegments } from '$lib/server/db/schema';
import type { PsStation, NewPsStation, PsSession, NewPsSession, PsDailyStat, PsMenuItem, NewPsMenuItem, PsSessionOrder, NewPsSessionOrder, PsSessionCharge, NewPsSessionCharge, PsSessionTransfer, NewPsSessionTransfer, PsSessionSegment, NewPsSessionSegment } from '$lib/server/db/schema';
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

// Cache for online status (updated by background sync, used by page loads)
let cachedOnlineMap: Map<string, boolean> = new Map();
let cachedOnlineMapTime = 0;
const ONLINE_CACHE_TTL_MS = 10000; // Use cached data for 10 seconds

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

export async function getStations(): Promise<PsStation[]> {
  return await db.select().from(psStations).orderBy(psStations.id);
}

export async function getStationById(id: string): Promise<PsStation | undefined> {
  const results = await db.select().from(psStations).where(eq(psStations.id, id));
  return results[0];
}

export async function createStation(data: {
  id: string;
  name: string;
  nameAr: string;
  macAddress: string;
  hourlyRate: number;
  hourlyRateMulti?: number | null;
  monitorIp?: string | null;
  monitorPort?: number | null;
  monitorType?: string | null;
  timerEndAction?: string | null;
  hdmiInput?: number | null;
  sortOrder?: number;
}): Promise<PsStation> {
  const now = Date.now();
  const station: NewPsStation = {
    id: data.id,
    name: data.name,
    nameAr: data.nameAr,
    macAddress: data.macAddress.toUpperCase().replace(/-/g, ':'),
    hourlyRate: data.hourlyRate,
    hourlyRateMulti: data.hourlyRateMulti ?? null,
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

  await db.insert(psStations).values(station);
  syncAfterWrite();
  const result = await getStationById(data.id);
  return result!;
}

export async function updateStation(id: string, updates: Partial<{
  name: string;
  nameAr: string;
  macAddress: string;
  hourlyRate: number;
  hourlyRateMulti: number | null;
  status: string;
  monitorIp: string | null;
  monitorPort: number | null;
  monitorType: string | null;
  timerEndAction: string | null;
  hdmiInput: number | null;
  sortOrder: number;
}>): Promise<void> {
  const station = await getStationById(id);
  if (!station) throw new Error(`Station ${id} not found`);

  const updateData: Partial<PsStation> = { updatedAt: Date.now() };
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.nameAr !== undefined) updateData.nameAr = updates.nameAr;
  if (updates.macAddress !== undefined) updateData.macAddress = updates.macAddress.toUpperCase().replace(/-/g, ':');
  if (updates.hourlyRate !== undefined) updateData.hourlyRate = updates.hourlyRate;
  if (updates.hourlyRateMulti !== undefined) updateData.hourlyRateMulti = updates.hourlyRateMulti;
  if (updates.status !== undefined) updateData.status = updates.status;
  if (updates.monitorIp !== undefined) updateData.monitorIp = updates.monitorIp;
  if (updates.monitorPort !== undefined) updateData.monitorPort = updates.monitorPort;
  if (updates.monitorType !== undefined) updateData.monitorType = updates.monitorType;
  if (updates.timerEndAction !== undefined) updateData.timerEndAction = updates.timerEndAction;
  if (updates.hdmiInput !== undefined) updateData.hdmiInput = updates.hdmiInput;
  if (updates.sortOrder !== undefined) updateData.sortOrder = updates.sortOrder;

  await db.update(psStations).set(updateData).where(eq(psStations.id, id));
  syncAfterWrite();
}

export async function deleteStation(id: string): Promise<void> {
  // End any active session first
  const activeSession = await getActiveSessionForStation(id);
  if (activeSession) {
    await endSession(activeSession.id);
  }

  await db.delete(psStations).where(eq(psStations.id, id));
  syncAfterWrite();
}

// ===== SESSION MANAGEMENT =====

export async function startSession(
  stationId: string,
  startedBy: 'manual' | 'auto' = 'manual',
  timerMinutes?: number,
  costLimitPiasters?: number,
  customStartTime?: number // Optional custom start time (timestamp in ms)
): Promise<PsSession> {
  const station = await getStationById(stationId);
  if (!station) throw new Error(`Station ${stationId} not found`);

  // Check if already has active session
  const existing = await getActiveSessionForStation(stationId);
  if (existing) throw new Error(`Station ${stationId} already has an active session`);

  const now = Date.now();
  const startTime = customStartTime || now;

  const session: NewPsSession = {
    stationId,
    startedAt: startTime,
    endedAt: null,
    hourlyRateSnapshot: station.hourlyRate,
    totalCost: null,
    ordersCost: 0,
    extraCharges: 0,
    transferredCost: 0,
    currentMode: 'single',
    startedBy,
    timerMinutes: timerMinutes || null,
    timerNotified: 0,
    costLimitPiasters: costLimitPiasters || null,
    costLimitNotified: 0,
    notes: null,
    createdAt: now
  };

  const result = await db.insert(psSessions).values(session).returning({ id: psSessions.id });
  const sessionId = result[0].id;

  // Create initial segment for the session
  await db.insert(psSessionSegments).values({
    sessionId,
    mode: 'single',
    startedAt: startTime,
    endedAt: null,
    hourlyRateSnapshot: station.hourlyRate,
    createdAt: now
  });

  // Update station status
  await updateStation(stationId, { status: 'occupied' });

  // Clear grace period if any
  gracePeriodTracker.delete(stationId);

  syncAfterWrite();
  const sessions = await db.select().from(psSessions).where(eq(psSessions.id, sessionId));
  return sessions[0]!;
}

/**
 * Update the start time of an existing session
 * Useful for correcting session times retroactively
 */
export async function updateSessionStartTime(sessionId: number, newStartTime: number): Promise<PsSession> {
  const sessions = await db.select().from(psSessions).where(eq(psSessions.id, sessionId));
  const session = sessions[0];
  if (!session) throw new Error(`Session ${sessionId} not found`);

  // Update session start time
  await db.update(psSessions).set({
    startedAt: newStartTime,
    updatedAt: Date.now()
  }).where(eq(psSessions.id, sessionId));

  // Also update the first segment's start time
  const segments = await db.select()
    .from(psSessionSegments)
    .where(eq(psSessionSegments.sessionId, sessionId))
    .orderBy(psSessionSegments.startedAt);

  if (segments.length > 0) {
    await db.update(psSessionSegments).set({
      startedAt: newStartTime
    }).where(eq(psSessionSegments.id, segments[0].id));
  }

  syncAfterWrite();
  const updatedSessions = await db.select().from(psSessions).where(eq(psSessions.id, sessionId));
  return updatedSessions[0]!;
}

export async function endSession(sessionId: number, notes?: string, customTotalCost?: number): Promise<PsSession> {
  const sessions = await db.select().from(psSessions).where(eq(psSessions.id, sessionId));
  const session = sessions[0];
  if (!session) throw new Error(`Session ${sessionId} not found`);
  if (session.endedAt) throw new Error(`Session ${sessionId} already ended`);

  const now = Date.now();

  // End any active segment
  const activeSegments = await db.select()
    .from(psSessionSegments)
    .where(and(
      eq(psSessionSegments.sessionId, sessionId),
      isNull(psSessionSegments.endedAt)
    ));
  const activeSegment = activeSegments[0];

  if (activeSegment) {
    await db.update(psSessionSegments).set({
      endedAt: now
    }).where(eq(psSessionSegments.id, activeSegment.id));
  }

  // Calculate gaming cost using segments
  const { total: calculatedGamingCost } = await calculateSessionCostWithSegments(session, now);
  const ordersCost = session.ordersCost || 0;
  const extraCharges = session.extraCharges || 0;
  const transferredCost = session.transferredCost || 0;

  // Use custom total cost if provided, otherwise calculate normally
  let finalTotalCost: number;
  let gamingCostToStore: number;

  if (customTotalCost !== undefined) {
    // Custom amount specified - this is the final total (includes everything)
    finalTotalCost = customTotalCost;
    // Store gaming cost as: custom total minus other costs
    gamingCostToStore = Math.max(0, customTotalCost - ordersCost - extraCharges - transferredCost);
  } else {
    // Normal calculation: gaming + orders + extraCharges + transferredCost
    gamingCostToStore = calculatedGamingCost;
    finalTotalCost = calculatedGamingCost + ordersCost + extraCharges + transferredCost;
  }

  await db.update(psSessions).set({
    endedAt: now,
    totalCost: gamingCostToStore, // Gaming cost only (others tracked separately)
    notes: notes || session.notes
  }).where(eq(psSessions.id, sessionId));

  // Update station status
  await updateStation(session.stationId, { status: 'available' });

  // Update daily stats with the final total cost
  await updateDailyStats(session.stationId, session.startedAt, now, finalTotalCost);

  // Clear grace period
  gracePeriodTracker.delete(session.stationId);

  // If session was manual or has custom cost, set cooldown to prevent auto-restart
  // (auto sessions ended by webhook don't need cooldown as device already disconnected)
  if (session.startedBy === 'manual' || customTotalCost !== undefined) {
    setManualEndCooldown(session.stationId);
  }

  syncAfterWrite();
  const updatedSessions = await db.select().from(psSessions).where(eq(psSessions.id, sessionId));
  return updatedSessions[0]!;
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

export async function getActiveSessionForStation(stationId: string): Promise<PsSession | undefined> {
  const sessions = await db.select()
    .from(psSessions)
    .where(and(
      eq(psSessions.stationId, stationId),
      isNull(psSessions.endedAt)
    ));
  return sessions[0];
}

/**
 * Get the most recently ended session for a station (for showing final cost)
 */
export async function getLastSessionForStation(stationId: string): Promise<PsSession | null> {
  const sessions = await db.select()
    .from(psSessions)
    .where(and(
      eq(psSessions.stationId, stationId),
      sql`${psSessions.endedAt} IS NOT NULL`
    ))
    .orderBy(desc(psSessions.endedAt))
    .limit(1);
  return sessions[0] || null;
}

export async function getActiveSessions(): Promise<PsSession[]> {
  return await db.select()
    .from(psSessions)
    .where(isNull(psSessions.endedAt));
}

export async function getSessionHistory(options?: {
  stationId?: string;
  startDate?: number;
  endDate?: number;
  limit?: number;
}): Promise<PsSession[]> {
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

  let query = db.select().from(psSessions);
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }

  const sessions = await query.orderBy(desc(psSessions.startedAt));

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
 * Uses cache to avoid hitting router on every page load
 */
export async function detectOnlineStations(forceRefresh = false): Promise<Map<string, boolean>> {
  const now = Date.now();

  // Return cached data if still fresh (unless force refresh)
  if (!forceRefresh && cachedOnlineMapTime > 0 && (now - cachedOnlineMapTime) < ONLINE_CACHE_TTL_MS) {
    return cachedOnlineMap;
  }

  try {
    const client = await getMikroTikClient();
    const registrations = await client.getWirelessRegistrations();

    // Get all stations
    const stations = await getStations();

    // Create MAC to online map
    const onlineMap = new Map<string, boolean>();
    const connectedMacs = new Set(
      registrations.map(r => r['mac-address'].toUpperCase().replace(/-/g, ':'))
    );

    for (const station of stations) {
      const normalizedMac = station.macAddress.toUpperCase().replace(/-/g, ':');
      onlineMap.set(station.id, connectedMacs.has(normalizedMac));
    }

    // Update cache
    cachedOnlineMap = onlineMap;
    cachedOnlineMapTime = now;

    return onlineMap;
  } catch (e) {
    // On error, return cached data if available, otherwise empty map
    if (cachedOnlineMap.size > 0) {
      console.warn('[PS] Router query failed, using cached online status');
      return cachedOnlineMap;
    }
    throw e;
  }
}

/**
 * Sync station status with router and auto-start/end sessions
 * This is called by the background sync service every 5 seconds
 */
export async function syncStationStatus(): Promise<{
  started: string[];
  ended: string[];
}> {
  // Force refresh from router (this is the background sync)
  const onlineMap = await detectOnlineStations(true);
  const stations = await getStations();
  const now = Date.now();

  const started: string[] = [];
  const ended: string[] = [];

  for (const station of stations) {
    // Skip stations in maintenance
    if (station.status === 'maintenance') continue;

    const isOnline = onlineMap.get(station.id) ?? false;
    const activeSession = await getActiveSessionForStation(station.id);

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
        await resumeSession(activeSession.id);
        console.log(`[Sync] Resumed paused session for ${station.id}`);
      }

      // Auto-start only on first connect (state transition) and not in cooldown
      if (!activeSession && isFirstConnect) {
        // Check cooldown
        if (isInManualEndCooldown(station.id)) {
          console.log(`[Sync] Station ${station.id} in cooldown - not auto-starting`);
        } else {
          try {
            await startSession(station.id, 'auto');
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
        await pauseSession(activeSession.id);
        console.log(`[Sync] Paused session for ${station.id} - PS went offline`);
      }
    }
  }

  return { started, ended };
}

/**
 * Get full station status with session info
 * Optimized: batch queries instead of N+1
 */
export async function getStationStatuses(): Promise<StationStatus[]> {
  const stations = await getStations();
  const now = Date.now();

  // Batch query: get ALL active sessions (no endedAt)
  const allActiveSessions = await db.select()
    .from(psSessions)
    .where(isNull(psSessions.endedAt));

  // Batch query: get recent sessions for stations without active sessions
  // Get last 30 days of sessions ordered by startedAt desc
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  const recentSessions = await db.select()
    .from(psSessions)
    .where(gte(psSessions.startedAt, thirtyDaysAgo))
    .orderBy(desc(psSessions.startedAt));

  // Create maps for quick lookup
  const activeSessionMap = new Map<string, PsSession>();
  for (const session of allActiveSessions) {
    activeSessionMap.set(session.stationId, session);
  }

  const lastSessionMap = new Map<string, PsSession>();
  for (const session of recentSessions) {
    // Only store the first (most recent) completed session per station
    if (session.endedAt && !lastSessionMap.has(session.stationId)) {
      lastSessionMap.set(session.stationId, session);
    }
  }

  const statuses: StationStatus[] = [];
  for (const station of stations) {
    const activeSession = activeSessionMap.get(station.id) || null;
    const lastSession = !activeSession ? (lastSessionMap.get(station.id) || null) : null;

    // Use the stored online state from webhook instead of polling router
    const normalizedMac = station.macAddress.toUpperCase().replace(/-/g, ':');
    const storedState = stationOnlineStates.get(normalizedMac);
    const isOnline = storedState === 'up';

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

    statuses.push({
      station,
      isOnline,
      activeSession,
      lastSession,
      elapsedMinutes,
      currentCost,
      isOfflineWithSession: !isOnline && !!activeSession,  // RED card when offline but session running
      isPaused: !!activeSession?.pausedAt                   // Timer is paused
    });
  }

  return statuses;
}

// ===== DAILY STATS =====

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

async function updateDailyStats(stationId: string, startedAt: number, endedAt: number, cost: number): Promise<void> {
  const date = new Date(endedAt).toISOString().split('T')[0];
  const durationMinutes = Math.floor((endedAt - startedAt) / (1000 * 60));

  const statsResults = await db.select().from(psDailyStats).where(eq(psDailyStats.date, date));
  const stats = statsResults[0];

  if (!stats) {
    const now = Date.now();
    await db.insert(psDailyStats).values({
      date,
      totalSessions: 1,
      totalMinutes: durationMinutes,
      totalRevenue: cost,
      sessionsByStation: JSON.stringify({ [stationId]: 1 }),
      createdAt: now,
      updatedAt: now
    });
  } else {
    const sessionsByStation = JSON.parse(stats.sessionsByStation) as Record<string, number>;
    sessionsByStation[stationId] = (sessionsByStation[stationId] || 0) + 1;

    await db.update(psDailyStats).set({
      totalSessions: stats.totalSessions + 1,
      totalMinutes: stats.totalMinutes + durationMinutes,
      totalRevenue: stats.totalRevenue + cost,
      sessionsByStation: JSON.stringify(sessionsByStation),
      updatedAt: Date.now()
    }).where(eq(psDailyStats.id, stats.id));
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

export async function getPsAnalytics(period: 'today' | 'week' | 'month'): Promise<PsAnalyticsSummary> {
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

  const stats = await db.select()
    .from(psDailyStats)
    .where(gte(psDailyStats.date, startDate))
    .orderBy(desc(psDailyStats.date));

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
export async function getTodayPsRevenue(): Promise<number> {
  const today = getToday();
  const statsResult = await db.select().from(psDailyStats).where(eq(psDailyStats.date, today));
  const stats = statsResult[0];

  // Also count active sessions' current cost
  const activeSessions = await getActiveSessions();
  let activeRevenue = 0;
  for (const session of activeSessions) {
    activeRevenue += calculateSessionCost(session);
    activeRevenue += session.ordersCost || 0;
  }

  return (stats?.totalRevenue || 0) + activeRevenue;
}

// ===== MENU ITEMS =====

export async function getMenuItems(): Promise<PsMenuItem[]> {
  return await db.select().from(psMenuItems).orderBy(psMenuItems.sortOrder);
}

export async function getMenuItemById(id: number): Promise<PsMenuItem | undefined> {
  const results = await db.select().from(psMenuItems).where(eq(psMenuItems.id, id));
  return results[0];
}

export async function getMenuItemsByCategory(category: string): Promise<PsMenuItem[]> {
  return await db.select()
    .from(psMenuItems)
    .where(eq(psMenuItems.category, category))
    .orderBy(psMenuItems.sortOrder);
}

export async function createMenuItem(data: {
  name: string;
  nameAr: string;
  category: string;
  price: number;
  sortOrder?: number;
}): Promise<PsMenuItem> {
  const now = Date.now();
  const items = await getMenuItems();

  const result = await db.insert(psMenuItems).values({
    name: data.name,
    nameAr: data.nameAr,
    category: data.category,
    price: data.price,
    isAvailable: 1,
    sortOrder: data.sortOrder ?? items.length,
    createdAt: now,
    updatedAt: now
  }).returning({ id: psMenuItems.id });

  const menuItem = await getMenuItemById(result[0].id);
  return menuItem!;
}

export async function updateMenuItem(id: number, updates: Partial<{
  name: string;
  nameAr: string;
  category: string;
  price: number;
  isAvailable: number;
  sortOrder: number;
}>): Promise<void> {
  const item = await getMenuItemById(id);
  if (!item) throw new Error(`Menu item ${id} not found`);

  const updateData: Record<string, unknown> = { updatedAt: Date.now() };
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.nameAr !== undefined) updateData.nameAr = updates.nameAr;
  if (updates.category !== undefined) updateData.category = updates.category;
  if (updates.price !== undefined) updateData.price = updates.price;
  if (updates.isAvailable !== undefined) updateData.isAvailable = updates.isAvailable;
  if (updates.sortOrder !== undefined) updateData.sortOrder = updates.sortOrder;

  await db.update(psMenuItems).set(updateData).where(eq(psMenuItems.id, id));
}

export async function deleteMenuItem(id: number): Promise<void> {
  await db.delete(psMenuItems).where(eq(psMenuItems.id, id));
}

// ===== SESSION ORDERS =====

export interface SessionOrderWithItem extends PsSessionOrder {
  menuItem: PsMenuItem | null;
}

export async function getSessionOrders(sessionId: number): Promise<SessionOrderWithItem[]> {
  const orders = await db.select()
    .from(psSessionOrders)
    .where(eq(psSessionOrders.sessionId, sessionId))
    .orderBy(desc(psSessionOrders.createdAt));

  const ordersWithItems: SessionOrderWithItem[] = [];
  for (const order of orders) {
    const menuItem = await getMenuItemById(order.menuItemId);
    ordersWithItems.push({
      ...order,
      menuItem: menuItem || null
    });
  }

  return ordersWithItems;
}

export async function addOrderToSession(sessionId: number, menuItemId: number, quantity: number = 1): Promise<PsSessionOrder> {
  const sessions = await db.select().from(psSessions).where(eq(psSessions.id, sessionId));
  const session = sessions[0];
  if (!session) throw new Error(`Session ${sessionId} not found`);
  if (session.endedAt) throw new Error(`Session ${sessionId} already ended`);

  const menuItem = await getMenuItemById(menuItemId);
  if (!menuItem) throw new Error(`Menu item ${menuItemId} not found`);
  if (!menuItem.isAvailable) throw new Error(`Menu item ${menuItem.nameAr} is not available`);

  const orderCost = menuItem.price * quantity;

  // Check if this item already exists in the session's orders
  const existingOrders = await db.select()
    .from(psSessionOrders)
    .where(and(
      eq(psSessionOrders.sessionId, sessionId),
      eq(psSessionOrders.menuItemId, menuItemId)
    ));
  const existingOrder = existingOrders[0];

  if (existingOrder) {
    // Update existing order quantity
    const newQuantity = existingOrder.quantity + quantity;
    await db.update(psSessionOrders).set({
      quantity: newQuantity
    }).where(eq(psSessionOrders.id, existingOrder.id));

    // Update session's orders cost
    const currentOrdersCost = session.ordersCost || 0;
    await db.update(psSessions).set({
      ordersCost: currentOrdersCost + orderCost
    }).where(eq(psSessions.id, sessionId));

    const updated = await db.select().from(psSessionOrders).where(eq(psSessionOrders.id, existingOrder.id));
    return updated[0]!;
  }

  // Insert new order
  const now = Date.now();
  const result = await db.insert(psSessionOrders).values({
    sessionId,
    menuItemId,
    quantity,
    priceSnapshot: menuItem.price,
    createdAt: now
  }).returning({ id: psSessionOrders.id });

  // Update session's orders cost
  const currentOrdersCost = session.ordersCost || 0;
  await db.update(psSessions).set({
    ordersCost: currentOrdersCost + orderCost
  }).where(eq(psSessions.id, sessionId));

  const newOrder = await db.select().from(psSessionOrders).where(eq(psSessionOrders.id, result[0].id));
  return newOrder[0]!;
}

export async function removeOrderFromSession(orderId: number): Promise<void> {
  const orders = await db.select().from(psSessionOrders).where(eq(psSessionOrders.id, orderId));
  const order = orders[0];
  if (!order) throw new Error(`Order ${orderId} not found`);

  const sessions = await db.select().from(psSessions).where(eq(psSessions.id, order.sessionId));
  const session = sessions[0];
  if (!session) throw new Error(`Session not found`);
  if (session.endedAt) throw new Error(`Cannot modify ended session`);

  const orderCost = order.priceSnapshot * order.quantity;

  // Remove order
  await db.delete(psSessionOrders).where(eq(psSessionOrders.id, orderId));

  // Update session's orders cost
  const currentOrdersCost = session.ordersCost || 0;
  await db.update(psSessions).set({
    ordersCost: Math.max(0, currentOrdersCost - orderCost)
  }).where(eq(psSessions.id, order.sessionId));
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

export async function getTimerAlerts(): Promise<TimerAlert[]> {
  const activeSessions = await getActiveSessions();
  const alerts: TimerAlert[] = [];
  const now = Date.now();

  for (const session of activeSessions) {
    if (session.timerMinutes && !session.timerNotified) {
      const elapsedMinutes = Math.floor((now - session.startedAt) / (1000 * 60));
      const isExpired = elapsedMinutes >= session.timerMinutes;

      if (isExpired) {
        const station = await getStationById(session.stationId);
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

export async function markTimerNotified(sessionId: number): Promise<void> {
  await db.update(psSessions).set({
    timerNotified: 1
  }).where(eq(psSessions.id, sessionId));
}

export async function setSessionTimer(sessionId: number, timerMinutes: number | null): Promise<void> {
  const sessions = await db.select().from(psSessions).where(eq(psSessions.id, sessionId));
  const session = sessions[0];
  if (!session) throw new Error(`Session ${sessionId} not found`);
  if (session.endedAt) throw new Error(`Session ${sessionId} already ended`);

  await db.update(psSessions).set({
    timerMinutes,
    timerNotified: 0
  }).where(eq(psSessions.id, sessionId));
}

/**
 * Pause a session (when PS goes offline)
 * Sets pausedAt to current time if not already paused
 */
export async function pauseSession(sessionId: number): Promise<void> {
  const sessions = await db.select().from(psSessions).where(eq(psSessions.id, sessionId));
  const session = sessions[0];
  if (!session) return;
  if (session.endedAt) return; // Session already ended
  if (session.pausedAt) return; // Already paused

  await db.update(psSessions).set({
    pausedAt: Date.now()
  }).where(eq(psSessions.id, sessionId));

  console.log(`[Session] Paused session ${sessionId} - PS went offline`);
}

/**
 * Resume a session (when PS comes back online)
 * Adds paused duration to totalPausedMs and clears pausedAt
 */
export async function resumeSession(sessionId: number): Promise<void> {
  const sessions = await db.select().from(psSessions).where(eq(psSessions.id, sessionId));
  const session = sessions[0];
  if (!session) return;
  if (session.endedAt) return; // Session already ended
  if (!session.pausedAt) return; // Not paused

  const pausedDuration = Date.now() - session.pausedAt;
  const newTotalPaused = (session.totalPausedMs || 0) + pausedDuration;

  await db.update(psSessions).set({
    pausedAt: null,
    totalPausedMs: newTotalPaused
  }).where(eq(psSessions.id, sessionId));

  console.log(`[Session] Resumed session ${sessionId} - was paused for ${Math.round(pausedDuration / 1000)}s, total paused: ${Math.round(newTotalPaused / 1000)}s`);
}

/**
 * Check if a session is currently paused
 */
export async function isSessionPaused(sessionId: number): Promise<boolean> {
  const sessions = await db.select().from(psSessions).where(eq(psSessions.id, sessionId));
  const session = sessions[0];
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

export async function getStationEarnings(): Promise<StationEarnings[]> {
  const stations = await getStations();
  const today = getToday();
  const statsResults = await db.select().from(psDailyStats).where(eq(psDailyStats.date, today));
  const stats = statsResults[0];

  const sessionsByStation = stats
    ? JSON.parse(stats.sessionsByStation) as Record<string, number>
    : {};

  // Batch query: Get ALL today's sessions in one query
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const allTodaySessions = await db.select()
    .from(psSessions)
    .where(gte(psSessions.startedAt, todayStart.getTime()));

  // Group sessions by station
  const sessionsByStationId = new Map<string, PsSession[]>();
  for (const session of allTodaySessions) {
    const existing = sessionsByStationId.get(session.stationId) || [];
    existing.push(session);
    sessionsByStationId.set(session.stationId, existing);
  }

  const earnings: StationEarnings[] = [];
  for (const station of stations) {
    const sessions = sessionsByStationId.get(station.id) || [];
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

    earnings.push({
      stationId: station.id,
      stationName: station.nameAr,
      todayEarnings,
      totalSessions: sessionsByStation[station.id] || 0,
      totalMinutes
    });
  }

  return earnings;
}

// ===== SWITCH STATION =====

/**
 * Switch/move an active session from one station to another
 * The session continues on the new station with the same start time, orders, etc.
 */
export async function switchStation(sessionId: number, newStationId: string): Promise<PsSession> {
  const sessions = await db.select().from(psSessions).where(eq(psSessions.id, sessionId));
  const session = sessions[0];
  if (!session) throw new Error(`Session ${sessionId} not found`);
  if (session.endedAt) throw new Error(`Session ${sessionId} already ended`);

  const oldStationId = session.stationId;
  if (oldStationId === newStationId) throw new Error(`Session already on station ${newStationId}`);

  const newStation = await getStationById(newStationId);
  if (!newStation) throw new Error(`Station ${newStationId} not found`);
  if (newStation.status === 'occupied') throw new Error(`Station ${newStationId} is already occupied`);
  if (newStation.status === 'maintenance') throw new Error(`Station ${newStationId} is in maintenance`);

  // Check if new station already has an active session
  const existingSession = await getActiveSessionForStation(newStationId);
  if (existingSession) throw new Error(`Station ${newStationId} already has an active session`);

  const oldStation = await getStationById(oldStationId);
  const now = Date.now();

  // Update session to new station
  const existingNotes = session.notes || '';
  const switchNote = `Switched from ${oldStationId} at ${new Date(now).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
  const newNotes = existingNotes ? `${existingNotes}\n${switchNote}` : switchNote;

  await db.update(psSessions).set({
    stationId: newStationId
  }).where(eq(psSessions.id, sessionId));

  // Update old station status to available
  if (oldStation) {
    await updateStation(oldStationId, { status: 'available' });
  }

  // Update new station status to occupied
  await updateStation(newStationId, { status: 'occupied' });

  // Clear any grace periods
  gracePeriodTracker.delete(oldStationId);
  gracePeriodTracker.delete(newStationId);

  console.log(`[Session] Switched session ${sessionId} from ${oldStationId} to ${newStationId}`);

  const updated = await db.select().from(psSessions).where(eq(psSessions.id, sessionId));
  return updated[0]!;
}

// ===== SESSION CHARGES =====

/**
 * Add an extra charge to a session
 */
export async function addCharge(sessionId: number, amount: number, reason?: string): Promise<PsSessionCharge> {
  const sessions = await db.select().from(psSessions).where(eq(psSessions.id, sessionId));
  const session = sessions[0];
  if (!session) throw new Error(`Session ${sessionId} not found`);
  if (session.endedAt) throw new Error(`Session ${sessionId} already ended`);

  const now = Date.now();
  const result = await db.insert(psSessionCharges).values({
    sessionId,
    amount,
    reason: reason || null,
    createdAt: now,
    updatedAt: now
  }).returning({ id: psSessionCharges.id });

  // Update session's extraCharges total
  const currentCharges = session.extraCharges || 0;
  await db.update(psSessions).set({
    extraCharges: currentCharges + amount
  }).where(eq(psSessions.id, sessionId));

  const charges = await db.select().from(psSessionCharges).where(eq(psSessionCharges.id, result[0].id));
  return charges[0]!;
}

/**
 * Update an existing charge
 */
export async function updateCharge(chargeId: number, amount: number, reason?: string): Promise<PsSessionCharge> {
  const charges = await db.select().from(psSessionCharges).where(eq(psSessionCharges.id, chargeId));
  const charge = charges[0];
  if (!charge) throw new Error(`Charge ${chargeId} not found`);

  const sessions = await db.select().from(psSessions).where(eq(psSessions.id, charge.sessionId));
  const session = sessions[0];
  if (!session) throw new Error(`Session not found`);
  if (session.endedAt) throw new Error(`Cannot modify charge on ended session`);

  const amountDiff = amount - charge.amount;
  const now = Date.now();

  await db.update(psSessionCharges).set({
    amount,
    reason: reason !== undefined ? (reason || null) : charge.reason,
    updatedAt: now
  }).where(eq(psSessionCharges.id, chargeId));

  // Update session's extraCharges total
  const currentCharges = session.extraCharges || 0;
  await db.update(psSessions).set({
    extraCharges: currentCharges + amountDiff
  }).where(eq(psSessions.id, charge.sessionId));

  const updated = await db.select().from(psSessionCharges).where(eq(psSessionCharges.id, chargeId));
  return updated[0]!;
}

/**
 * Delete a charge
 */
export async function deleteCharge(chargeId: number): Promise<void> {
  const charges = await db.select().from(psSessionCharges).where(eq(psSessionCharges.id, chargeId));
  const charge = charges[0];
  if (!charge) throw new Error(`Charge ${chargeId} not found`);

  const sessions = await db.select().from(psSessions).where(eq(psSessions.id, charge.sessionId));
  const session = sessions[0];
  if (!session) throw new Error(`Session not found`);
  if (session.endedAt) throw new Error(`Cannot delete charge from ended session`);

  // Remove charge
  await db.delete(psSessionCharges).where(eq(psSessionCharges.id, chargeId));

  // Update session's extraCharges total
  const currentCharges = session.extraCharges || 0;
  await db.update(psSessions).set({
    extraCharges: Math.max(0, currentCharges - charge.amount)
  }).where(eq(psSessions.id, charge.sessionId));
}

/**
 * Get all charges for a session
 */
export async function getSessionCharges(sessionId: number): Promise<PsSessionCharge[]> {
  return await db.select()
    .from(psSessionCharges)
    .where(eq(psSessionCharges.sessionId, sessionId))
    .orderBy(desc(psSessionCharges.createdAt));
}

// ===== SESSION TRANSFERS =====

/**
 * Transfer a session's cost to another session and end the source session
 */
export async function transferSession(fromSessionId: number, toSessionId: number, includeOrders: boolean): Promise<PsSessionTransfer> {
  const fromSessions = await db.select().from(psSessions).where(eq(psSessions.id, fromSessionId));
  const fromSession = fromSessions[0];
  if (!fromSession) throw new Error(`Source session ${fromSessionId} not found`);
  if (fromSession.endedAt) throw new Error(`Source session already ended`);

  const toSessions = await db.select().from(psSessions).where(eq(psSessions.id, toSessionId));
  const toSession = toSessions[0];
  if (!toSession) throw new Error(`Target session ${toSessionId} not found`);
  if (toSession.endedAt) throw new Error(`Target session already ended`);
  if (fromSessionId === toSessionId) throw new Error(`Cannot transfer to same session`);

  const fromStation = await getStationById(fromSession.stationId);
  if (!fromStation) throw new Error(`Station not found`);

  const now = Date.now();

  // Calculate costs using segments if available, otherwise simple calculation
  const gamingAmount = calculateSessionCost(fromSession, now);
  const ordersAmount = includeOrders ? (fromSession.ordersCost || 0) : 0;
  const totalAmount = gamingAmount + ordersAmount + (fromSession.extraCharges || 0);

  // Create transfer record
  const result = await db.insert(psSessionTransfers).values({
    fromSessionId,
    toSessionId,
    fromStationId: fromSession.stationId,
    gamingAmount,
    ordersAmount,
    totalAmount,
    createdAt: now
  }).returning({ id: psSessionTransfers.id });

  // Update target session's transferred cost
  const currentTransferred = toSession.transferredCost || 0;
  await db.update(psSessions).set({
    transferredCost: currentTransferred + totalAmount
  }).where(eq(psSessions.id, toSessionId));

  // End source session with 0 cost (or only the orders cost if not transferred)
  const remainingOrdersCost = includeOrders ? 0 : (fromSession.ordersCost || 0);
  await db.update(psSessions).set({
    endedAt: now,
    totalCost: 0, // Gaming cost transferred
    notes: `Transferred to ${toSession.stationId}${includeOrders ? ' (with orders)' : ''}`
  }).where(eq(psSessions.id, fromSessionId));

  // Update source station status
  await updateStation(fromSession.stationId, { status: 'available' });

  // Clear grace period and set cooldown
  setManualEndCooldown(fromSession.stationId);

  const transfers = await db.select().from(psSessionTransfers).where(eq(psSessionTransfers.id, result[0].id));
  return transfers[0]!;
}

/**
 * Get transfers TO a session (incoming transfers)
 */
export async function getSessionTransfers(sessionId: number): Promise<PsSessionTransfer[]> {
  return await db.select()
    .from(psSessionTransfers)
    .where(eq(psSessionTransfers.toSessionId, sessionId))
    .orderBy(desc(psSessionTransfers.createdAt));
}

// ===== SESSION SEGMENTS (Single/Multi Player Mode) =====

/**
 * Create initial segment when session starts
 */
export async function createInitialSegment(sessionId: number, hourlyRate: number): Promise<PsSessionSegment> {
  const now = Date.now();
  const result = await db.insert(psSessionSegments).values({
    sessionId,
    mode: 'single',
    startedAt: now,
    endedAt: null,
    hourlyRateSnapshot: hourlyRate,
    createdAt: now
  }).returning({ id: psSessionSegments.id });

  const segments = await db.select().from(psSessionSegments).where(eq(psSessionSegments.id, result[0].id));
  return segments[0]!;
}

/**
 * Switch session between single/multi player mode
 */
export async function switchMode(sessionId: number, newMode: 'single' | 'multi'): Promise<void> {
  const sessions = await db.select().from(psSessions).where(eq(psSessions.id, sessionId));
  const session = sessions[0];
  if (!session) throw new Error(`Session ${sessionId} not found`);
  if (session.endedAt) throw new Error(`Session ${sessionId} already ended`);

  // Don't switch if already in that mode
  if (session.currentMode === newMode) return;

  const station = await getStationById(session.stationId);
  if (!station) throw new Error(`Station not found`);

  const now = Date.now();

  // End current segment
  const currentSegments = await db.select()
    .from(psSessionSegments)
    .where(and(
      eq(psSessionSegments.sessionId, sessionId),
      isNull(psSessionSegments.endedAt)
    ));
  const currentSegment = currentSegments[0];

  if (currentSegment) {
    await db.update(psSessionSegments).set({
      endedAt: now
    }).where(eq(psSessionSegments.id, currentSegment.id));
  }

  // Get the appropriate rate for the new mode
  const newRate = newMode === 'multi'
    ? (station.hourlyRateMulti || station.hourlyRate)
    : station.hourlyRate;

  // Create new segment
  await db.insert(psSessionSegments).values({
    sessionId,
    mode: newMode,
    startedAt: now,
    endedAt: null,
    hourlyRateSnapshot: newRate,
    createdAt: now
  });

  // Update session's current mode
  await db.update(psSessions).set({
    currentMode: newMode
  }).where(eq(psSessions.id, sessionId));

  console.log(`[Session] Switched session ${sessionId} to ${newMode} mode (rate: ${newRate} piasters/hr)`);
}

/**
 * Get all segments for a session
 */
export async function getSessionSegments(sessionId: number): Promise<PsSessionSegment[]> {
  return await db.select()
    .from(psSessionSegments)
    .where(eq(psSessionSegments.sessionId, sessionId))
    .orderBy(psSessionSegments.startedAt);
}

/**
 * Calculate session cost using segments (if available) or simple calculation
 * This replaces/enhances the existing calculateSessionCost for segment-aware billing
 */
export async function calculateSessionCostWithSegments(session: PsSession, endTime?: number): Promise<{ total: number; breakdown: Array<{ mode: string; minutes: number; cost: number }> }> {
  const end = endTime || session.endedAt || Date.now();
  const segments = await getSessionSegments(session.id);

  // If no segments, use simple calculation (backward compatibility)
  if (segments.length === 0) {
    const cost = calculateSessionCost(session, end);
    const durationMs = end - session.startedAt - (session.totalPausedMs || 0);
    const minutes = Math.ceil(durationMs / (1000 * 60));
    return {
      total: cost,
      breakdown: [{ mode: session.currentMode || 'single', minutes, cost }]
    };
  }

  // Calculate cost per segment
  const breakdown: Array<{ mode: string; minutes: number; cost: number }> = [];
  let totalCost = 0;
  const totalPausedMs = session.totalPausedMs || 0;

  // Calculate total active time to distribute paused time proportionally
  let totalActiveMs = 0;
  for (const segment of segments) {
    const segmentEnd = segment.endedAt || end;
    totalActiveMs += segmentEnd - segment.startedAt;
  }

  for (const segment of segments) {
    const segmentEnd = segment.endedAt || end;
    let segmentDurationMs = segmentEnd - segment.startedAt;

    // Distribute paused time proportionally across segments
    if (totalActiveMs > 0 && totalPausedMs > 0) {
      const pausedProportion = segmentDurationMs / totalActiveMs;
      segmentDurationMs -= Math.round(totalPausedMs * pausedProportion);
    }

    if (segmentDurationMs < 0) segmentDurationMs = 0;

    const minutes = Math.ceil(segmentDurationMs / (1000 * 60));
    const cost = Math.round((segment.hourlyRateSnapshot * minutes) / 60);

    breakdown.push({
      mode: segment.mode,
      minutes,
      cost
    });
    totalCost += cost;
  }

  return { total: totalCost, breakdown };
}
