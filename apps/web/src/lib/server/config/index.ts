import { db } from '$lib/server/db';
import { settings, packages } from '$lib/server/db/schema';
import { eq, asc } from 'drizzle-orm';
import type { Package, NewPackage } from '$lib/server/db/schema';

// Re-export types
export type { Package as PackageConfig };

// Settings interface for structured access
export interface Settings {
  mikrotik: {
    host: string;
    user: string;
    pass: string;
  };
  business: {
    name: string;
  };
  wifi: {
    ssid: string;
  };
}

// Get a single setting
export function getSetting(key: string): string | undefined {
  const result = db.select().from(settings).where(eq(settings.key, key)).get();
  return result?.value;
}

// Set a single setting
export function setSetting(key: string, value: string): void {
  db.insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } })
    .run();
}

// Get all settings as structured object
export function getSettings(): Settings {
  return {
    mikrotik: {
      host: getSetting('mikrotik_host') || '192.168.1.109',
      user: getSetting('mikrotik_user') || 'admin',
      pass: getSetting('mikrotik_pass') || ''
    },
    business: {
      name: getSetting('business_name') || 'AboYassen WiFi'
    },
    wifi: {
      ssid: getSetting('wifi_ssid') || 'AboYassen'
    }
  };
}

// Update settings from structured object
export function updateSettings(updates: Partial<Settings>): void {
  if (updates.mikrotik) {
    if (updates.mikrotik.host !== undefined) setSetting('mikrotik_host', updates.mikrotik.host);
    if (updates.mikrotik.user !== undefined) setSetting('mikrotik_user', updates.mikrotik.user);
    if (updates.mikrotik.pass !== undefined) setSetting('mikrotik_pass', updates.mikrotik.pass);
  }
  if (updates.business) {
    if (updates.business.name !== undefined) setSetting('business_name', updates.business.name);
  }
  if (updates.wifi) {
    if (updates.wifi.ssid !== undefined) setSetting('wifi_ssid', updates.wifi.ssid);
  }
}

// Package functions
export function getPackages(): Package[] {
  return db.select().from(packages).orderBy(asc(packages.sortOrder)).all();
}

export function getPackageById(id: string): Package | undefined {
  return db.select().from(packages).where(eq(packages.id, id)).get();
}

/**
 * Get package from voucher comment field
 * Comment format: "pkg:PACKAGE_ID|Name - Price LE"
 * Falls back to profile matching if no package ID found
 */
export function getPackageFromComment(comment: string, profile?: string): Package | undefined {
  const allPackages = getPackages();

  // Try to extract package ID from comment (format: pkg:ID|...)
  const match = comment.match(/^pkg:([^|]+)\|/);
  if (match) {
    const pkg = allPackages.find(p => p.id === match[1]);
    if (pkg) return pkg;
  }

  // Fallback: match by profile name
  if (profile) {
    return allPackages.find(p => p.profile === profile);
  }

  return undefined;
}

// Legacy: Get package by code prefix (for backward compatibility with old vouchers)
export function getPackageByCodePrefix(voucherName: string): Package | undefined {
  const allPackages = getPackages();
  // Sort by prefix length descending to match longer prefixes first (G10 before G1)
  const sorted = [...allPackages].sort((a, b) => b.codePrefix.length - a.codePrefix.length);
  return sorted.find(p => voucherName.startsWith(p.codePrefix));
}

export function createPackage(pkg: NewPackage): void {
  db.insert(packages).values(pkg).run();
}

export function updatePackage(id: string, updates: Partial<Omit<Package, 'id'>>): void {
  const setData: Record<string, unknown> = {};
  if (updates.name !== undefined) setData.name = updates.name;
  if (updates.nameAr !== undefined) setData.nameAr = updates.nameAr;
  if (updates.priceLE !== undefined) setData.priceLE = updates.priceLE;
  if (updates.profile !== undefined) setData.profile = updates.profile;
  if (updates.server !== undefined) setData.server = updates.server;
  if (updates.sortOrder !== undefined) setData.sortOrder = updates.sortOrder;
  // codePrefix is deprecated but keep for backward compatibility
  if (updates.codePrefix !== undefined) setData.codePrefix = updates.codePrefix;

  db.update(packages)
    .set(setData)
    .where(eq(packages.id, id))
    .run();
}

export function deletePackage(id: string): void {
  db.delete(packages).where(eq(packages.id, id)).run();
}
