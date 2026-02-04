import { db, syncAfterWrite } from '$lib/server/db';
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
export async function getSetting(key: string): Promise<string | undefined> {
  const results = await db.select().from(settings).where(eq(settings.key, key));
  return results[0]?.value;
}

// Set a single setting
export async function setSetting(key: string, value: string): Promise<void> {
  await db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } });
  syncAfterWrite();
}

// Get all settings as structured object
export async function getSettings(): Promise<Settings> {
  return {
    mikrotik: {
      host: (await getSetting('mikrotik_host')) || '192.168.1.109',
      user: (await getSetting('mikrotik_user')) || 'admin',
      pass: (await getSetting('mikrotik_pass')) || ''
    },
    business: {
      name: (await getSetting('business_name')) || 'AboYassen WiFi'
    },
    wifi: {
      ssid: (await getSetting('wifi_ssid')) || 'AboYassen'
    }
  };
}

// Update settings from structured object
export async function updateSettings(updates: Partial<Settings>): Promise<void> {
  if (updates.mikrotik) {
    if (updates.mikrotik.host !== undefined) await setSetting('mikrotik_host', updates.mikrotik.host);
    if (updates.mikrotik.user !== undefined) await setSetting('mikrotik_user', updates.mikrotik.user);
    if (updates.mikrotik.pass !== undefined) await setSetting('mikrotik_pass', updates.mikrotik.pass);
  }
  if (updates.business) {
    if (updates.business.name !== undefined) await setSetting('business_name', updates.business.name);
  }
  if (updates.wifi) {
    if (updates.wifi.ssid !== undefined) await setSetting('wifi_ssid', updates.wifi.ssid);
  }
}

// Package functions
export async function getPackages(): Promise<Package[]> {
  return await db.select().from(packages).orderBy(asc(packages.sortOrder));
}

export async function getPackageById(id: string): Promise<Package | undefined> {
  const results = await db.select().from(packages).where(eq(packages.id, id));
  return results[0];
}

/**
 * Get package from voucher comment field
 * Comment format: "pkg:PACKAGE_ID|Name - Price LE"
 * Falls back to profile matching if no package ID found
 */
export async function getPackageFromComment(comment: string, profile?: string): Promise<Package | undefined> {
  const allPackages = await getPackages();

  // Try to extract package ID from comment (format: pkg:ID|...)
  const match = comment.match(/^pkg:([^|]+)\|/);
  if (match) {
    const pkg = allPackages.find((p) => p.id === match[1]);
    if (pkg) return pkg;
  }

  // Fallback: match by profile name
  if (profile) {
    return allPackages.find((p) => p.profile === profile);
  }

  return undefined;
}

// Legacy: Get package by code prefix (for backward compatibility with old vouchers)
export async function getPackageByCodePrefix(voucherName: string): Promise<Package | undefined> {
  const allPackages = await getPackages();
  // Sort by prefix length descending to match longer prefixes first (G10 before G1)
  const sorted = [...allPackages].sort((a, b) => b.codePrefix.length - a.codePrefix.length);
  return sorted.find((p) => voucherName.startsWith(p.codePrefix));
}

export async function createPackage(pkg: NewPackage): Promise<void> {
  await db.insert(packages).values(pkg);
  syncAfterWrite();
}

export async function updatePackage(id: string, updates: Partial<Omit<Package, 'id'>>): Promise<void> {
  const setData: Record<string, unknown> = {};
  if (updates.name !== undefined) setData.name = updates.name;
  if (updates.nameAr !== undefined) setData.nameAr = updates.nameAr;
  if (updates.priceLE !== undefined) setData.priceLE = updates.priceLE;
  if (updates.bytesLimit !== undefined) setData.bytesLimit = updates.bytesLimit;
  if (updates.profile !== undefined) setData.profile = updates.profile;
  if (updates.server !== undefined) setData.server = updates.server;
  if (updates.sortOrder !== undefined) setData.sortOrder = updates.sortOrder;
  // codePrefix is deprecated but keep for backward compatibility
  if (updates.codePrefix !== undefined) setData.codePrefix = updates.codePrefix;

  await db.update(packages).set(setData).where(eq(packages.id, id));
  syncAfterWrite();
}

export async function deletePackage(id: string): Promise<void> {
  await db.delete(packages).where(eq(packages.id, id));
  syncAfterWrite();
}
