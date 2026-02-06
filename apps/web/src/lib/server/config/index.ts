import {
  getSetting as convexGetSetting,
  setSetting as convexSetSetting,
  getPackages as convexGetPackages,
  createPackage as convexCreatePackage,
  updatePackage as convexUpdatePackage,
  deletePackage as convexDeletePackage,
  type Package as ConvexPackage
} from '$lib/server/convex';

// Backward-compatible package type: extends Convex Package with old SQLite fields
export type PackageConfig = ConvexPackage & {
  id: string;       // Alias for _id (old SQLite primary key)
  codePrefix: string; // Deprecated, always ''
};

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
  const value = await convexGetSetting(key);
  return value ?? undefined;
}

// Set a single setting
export async function setSetting(key: string, value: string): Promise<void> {
  await convexSetSetting(key, value);
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

// Map Convex package to backward-compatible PackageConfig
function toPackageConfig(pkg: ConvexPackage): PackageConfig {
  return {
    ...pkg,
    id: pkg._id,
    codePrefix: ''
  };
}

// Package functions
export async function getPackages(): Promise<PackageConfig[]> {
  const packages = await convexGetPackages();
  return packages.map(toPackageConfig);
}

export async function getPackageById(id: string): Promise<PackageConfig | undefined> {
  const packages = await getPackages();
  return packages.find((p) => p._id === id);
}

/**
 * Get package from voucher comment field
 * Comment format: "pkg:PACKAGE_ID|Name - Price LE"
 * Falls back to profile matching if no package ID found
 */
export async function getPackageFromComment(comment: string, profile?: string): Promise<PackageConfig | undefined> {
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
export async function getPackageByCodePrefix(voucherName: string): Promise<PackageConfig | undefined> {
  const allPackages = await getPackages();
  // Sort by prefix length descending to match longer prefixes first (G10 before G1)
  const sorted = [...allPackages].sort((a, b) => b.codePrefix.length - a.codePrefix.length);
  return sorted.find((p) => voucherName.startsWith(p.codePrefix));
}

export async function createPackage(pkg: {
  name: string;
  nameAr: string;
  priceLE: number;
  bytesLimit: number;
  timeLimit?: string;
  profile: string;
  server?: string | null;
  sortOrder?: number;
  // Accepted for backward compatibility but ignored
  id?: string;
  codePrefix?: string;
}): Promise<void> {
  await convexCreatePackage({
    name: pkg.name,
    nameAr: pkg.nameAr,
    priceLE: pkg.priceLE,
    bytesLimit: pkg.bytesLimit,
    timeLimit: pkg.timeLimit,
    profile: pkg.profile,
    server: pkg.server || undefined,
    sortOrder: pkg.sortOrder
  });
}

export async function updatePackage(id: string, updates: Partial<{
  name: string;
  nameAr: string;
  priceLE: number;
  bytesLimit: number;
  timeLimit: string;
  profile: string;
  server: string | null;
  sortOrder: number;
  codePrefix: string; // Accepted for backward compatibility but ignored
}>): Promise<void> {
  const { codePrefix: _, ...convexUpdates } = updates;
  await convexUpdatePackage(id, convexUpdates);
}

export async function deletePackage(id: string): Promise<void> {
  await convexDeletePackage(id);
}
