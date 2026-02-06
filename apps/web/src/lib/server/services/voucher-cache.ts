/**
 * Voucher Cache Service
 *
 * Provides in-memory caching for MikroTik vouchers.
 * Data is transient - sourced from the router on each server restart.
 */

import type { Voucher } from './vouchers';

// Cache configuration
const DEFAULT_CACHE_MAX_AGE_SECONDS = 60; // 1 minute

export interface CachedVoucher {
  id: string;
  code: string;
  password: string;
  status: 'available' | 'used' | 'exhausted';
  packageId: string | null;
  profile: string | null;
  bytesLimit: number | null;
  bytesUsed: number;
  timeLimit: string | null;
  uptime: string | null;
  macAddress: string | null;
  deviceName: string | null;
  isOnline: boolean;
  comment: string | null;
  createdAt: string | null;
  lastSeenAt: string | null;
  syncedAt: string;
}

export interface CachedSession {
  id: string;
  voucherCode: string;
  macAddress: string | null;
  ipAddress: string | null;
  bytesIn: number;
  bytesOut: number;
  uptime: string | null;
  startedAt: string | null;
  syncedAt: string;
}

export interface VoucherCacheResult {
  vouchers: CachedVoucher[];
  source: 'router' | 'cache';
  syncedAt: string | null;
  isStale: boolean;
}

// In-memory cache storage
let cachedVouchers: CachedVoucher[] = [];
let cachedSessions: CachedSession[] = [];
let lastSyncTime: string | null = null;

/**
 * Sync vouchers from router to local cache
 */
export async function syncVouchersToCache(vouchers: Voucher[]): Promise<void> {
  const now = new Date().toISOString();

  cachedVouchers = vouchers.map(v => ({
    id: v.id,
    code: v.name,
    password: v.password || v.name,
    status: v.status,
    packageId: v.packageId || null,
    profile: v.profile || null,
    bytesLimit: v.bytesLimit || null,
    bytesUsed: v.bytesTotal || 0,
    timeLimit: null,
    uptime: v.uptime || null,
    macAddress: v.macAddress || null,
    deviceName: v.deviceName || null,
    isOnline: v.isOnline,
    comment: v.comment || null,
    createdAt: null,
    lastSeenAt: v.isOnline ? now : null,
    syncedAt: now,
  }));

  lastSyncTime = now;
  console.log(`[VoucherCache] Synced ${vouchers.length} vouchers to cache`);
}

/**
 * Sync active sessions to cache
 */
export async function syncSessionsToCache(sessions: Array<{
  id: string;
  user: string;
  macAddress?: string;
  address?: string;
  bytesIn?: number;
  bytesOut?: number;
  uptime?: string;
}>): Promise<void> {
  const now = new Date().toISOString();

  cachedSessions = sessions.map(s => ({
    id: s.id,
    voucherCode: s.user,
    macAddress: s.macAddress || null,
    ipAddress: s.address || null,
    bytesIn: s.bytesIn || 0,
    bytesOut: s.bytesOut || 0,
    uptime: s.uptime || null,
    startedAt: null,
    syncedAt: now,
  }));

  console.log(`[VoucherCache] Synced ${sessions.length} sessions to cache`);
}

/**
 * Get the last sync timestamp
 */
export async function getLastSyncTime(): Promise<string | null> {
  return lastSyncTime;
}

/**
 * Check if cache is stale
 */
export async function isCacheStale(maxAgeSeconds: number = DEFAULT_CACHE_MAX_AGE_SECONDS): Promise<boolean> {
  if (!lastSyncTime) return true;

  const syncedAt = new Date(lastSyncTime).getTime();
  const now = Date.now();
  const ageSeconds = (now - syncedAt) / 1000;

  return ageSeconds > maxAgeSeconds;
}

/**
 * Get vouchers from cache
 */
export async function getCachedVouchers(): Promise<CachedVoucher[] | null> {
  if (cachedVouchers.length === 0) return null;
  return [...cachedVouchers];
}

/**
 * Get cached sessions
 */
export async function getCachedSessions(): Promise<CachedSession[] | null> {
  if (cachedSessions.length === 0) return null;
  return [...cachedSessions];
}

/**
 * Get voucher count from cache (fast stats)
 */
export async function getCachedVoucherStats(): Promise<{
  total: number;
  available: number;
  used: number;
  exhausted: number;
  online: number;
} | null> {
  if (cachedVouchers.length === 0) return null;

  return {
    total: cachedVouchers.length,
    available: cachedVouchers.filter(v => v.status === 'available').length,
    used: cachedVouchers.filter(v => v.status === 'used').length,
    exhausted: cachedVouchers.filter(v => v.status === 'exhausted').length,
    online: cachedVouchers.filter(v => v.isOnline).length,
  };
}

/**
 * Update a single voucher in cache after mutation
 */
export async function updateCachedVoucher(voucher: Voucher): Promise<void> {
  const now = new Date().toISOString();
  const index = cachedVouchers.findIndex(v => v.id === voucher.id);

  if (index !== -1) {
    cachedVouchers[index] = {
      ...cachedVouchers[index],
      code: voucher.name,
      status: voucher.status,
      packageId: voucher.packageId || null,
      profile: voucher.profile || null,
      bytesLimit: voucher.bytesLimit || null,
      bytesUsed: voucher.bytesTotal || 0,
      uptime: voucher.uptime || null,
      macAddress: voucher.macAddress || null,
      deviceName: voucher.deviceName || null,
      isOnline: voucher.isOnline,
      lastSeenAt: voucher.isOnline ? now : null,
      syncedAt: now,
    };
  }
}

/**
 * Remove a voucher from cache
 */
export async function removeCachedVoucher(id: string): Promise<void> {
  cachedVouchers = cachedVouchers.filter(v => v.id !== id);
}

/**
 * Remove multiple vouchers from cache
 */
export async function removeCachedVouchers(ids: string[]): Promise<void> {
  const idSet = new Set(ids);
  cachedVouchers = cachedVouchers.filter(v => !idSet.has(v.id));
}

/**
 * Add new vouchers to cache (after creation)
 */
export async function addVouchersToCache(vouchers: Voucher[]): Promise<void> {
  const now = new Date().toISOString();

  const newEntries: CachedVoucher[] = vouchers.map(v => ({
    id: v.id,
    code: v.name,
    password: v.password || v.name,
    status: v.status,
    packageId: v.packageId || null,
    profile: v.profile || null,
    bytesLimit: v.bytesLimit || null,
    bytesUsed: 0,
    timeLimit: null,
    uptime: null,
    macAddress: null,
    deviceName: null,
    isOnline: false,
    comment: v.comment || null,
    createdAt: now,
    lastSeenAt: null,
    syncedAt: now,
  }));

  cachedVouchers.push(...newEntries);
}

/**
 * Clear all cache (for full refresh)
 */
export async function clearVoucherCache(): Promise<void> {
  cachedVouchers = [];
  cachedSessions = [];
  lastSyncTime = null;
  console.log('[VoucherCache] Cache cleared');
}
