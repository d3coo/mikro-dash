import { getDb } from '$lib/server/db';
import { settings as settingsTable, packages as packagesTable } from '$lib/server/db/schema';
import { eq, asc } from 'drizzle-orm';

// Backward-compatible package type
export type PackageConfig = {
	_id: string;
	id: string;
	name: string;
	nameAr: string;
	priceLE: number;
	bytesLimit: number;
	timeLimit: string;
	profile: string;
	server?: string;
	sortOrder: number;
	codePrefix: string;
};

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

// ============= In-memory cache =============
let _settingsCache: Record<string, string> | null = null;
let _packagesCache: PackageConfig[] | null = null;

const DEFAULT_SETTINGS: Settings = {
	mikrotik: { host: '192.168.1.109', user: 'admin', pass: 'need4speed' },
	business: { name: 'AboYassen WiFi' },
	wifi: { ssid: 'AboYassen' }
};

function getRawSettings(): Record<string, string> {
	if (_settingsCache) return _settingsCache;
	const db = getDb();
	const rows = db.select().from(settingsTable).all();
	const result: Record<string, string> = {};
	for (const { key, value } of rows) {
		result[key] = value;
	}
	_settingsCache = result;
	return result;
}

export async function getSetting(key: string): Promise<string | undefined> {
	const all = getRawSettings();
	return all[key] ?? undefined;
}

export async function setSetting(key: string, value: string): Promise<void> {
	const db = getDb();
	db.insert(settingsTable)
		.values({ key, value })
		.onConflictDoUpdate({ target: settingsTable.key, set: { value } })
		.run();
	if (_settingsCache) {
		_settingsCache[key] = value;
	}
}

export async function getSettings(): Promise<Settings> {
	const raw = getRawSettings();
	return {
		mikrotik: {
			host: raw['mikrotik_host'] || DEFAULT_SETTINGS.mikrotik.host,
			user: raw['mikrotik_user'] || DEFAULT_SETTINGS.mikrotik.user,
			pass: raw['mikrotik_pass'] || DEFAULT_SETTINGS.mikrotik.pass
		},
		business: {
			name: raw['business_name'] || DEFAULT_SETTINGS.business.name
		},
		wifi: {
			ssid: raw['wifi_ssid'] || DEFAULT_SETTINGS.wifi.ssid
		}
	};
}

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

export function invalidateSettingsCache(): void {
	_settingsCache = null;
}

// ============= Packages (cached) =============

function toPackageConfig(row: any): PackageConfig {
	const id = String(row.id);
	return {
		_id: id,
		id,
		name: row.name,
		nameAr: row.nameAr,
		priceLE: row.priceLE,
		bytesLimit: row.bytesLimit,
		timeLimit: row.timeLimit,
		profile: row.profile,
		server: row.server ?? undefined,
		sortOrder: row.sortOrder,
		codePrefix: '',
	};
}

export async function getPackages(): Promise<PackageConfig[]> {
	if (_packagesCache) return _packagesCache;
	const db = getDb();
	const rows = db.select().from(packagesTable).orderBy(asc(packagesTable.sortOrder)).all();
	_packagesCache = rows.map(toPackageConfig);
	return _packagesCache;
}

export async function getPackageById(id: string): Promise<PackageConfig | undefined> {
	const packages = await getPackages();
	return packages.find((p) => p._id === id);
}

export async function getPackageFromComment(comment: string, profile?: string): Promise<PackageConfig | undefined> {
	const allPackages = await getPackages();
	const match = comment.match(/^pkg:([^|]+)\|/);
	if (match) {
		const pkg = allPackages.find((p) => p.id === match[1]);
		if (pkg) return pkg;
	}
	if (profile) {
		return allPackages.find((p) => p.profile === profile);
	}
	return undefined;
}

export async function getPackageByCodePrefix(voucherName: string): Promise<PackageConfig | undefined> {
	const allPackages = await getPackages();
	const sorted = [...allPackages].sort((a, b) => b.codePrefix.length - a.codePrefix.length);
	return sorted.find((p) => voucherName.startsWith(p.codePrefix));
}

function invalidatePackagesCache(): void {
	_packagesCache = null;
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
	id?: string;
	codePrefix?: string;
}): Promise<void> {
	const db = getDb();
	db.insert(packagesTable).values({
		name: pkg.name,
		nameAr: pkg.nameAr,
		priceLE: pkg.priceLE,
		bytesLimit: pkg.bytesLimit,
		timeLimit: pkg.timeLimit || '1d',
		profile: pkg.profile,
		server: pkg.server || null,
		sortOrder: pkg.sortOrder ?? 0,
	}).run();
	invalidatePackagesCache();
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
	codePrefix: string;
}>): Promise<void> {
	const db = getDb();
	const { codePrefix: _, ...dbUpdates } = updates;
	const cleanUpdates: Record<string, any> = {};
	for (const [key, value] of Object.entries(dbUpdates)) {
		if (value !== undefined) cleanUpdates[key] = value;
	}
	if (Object.keys(cleanUpdates).length > 0) {
		db.update(packagesTable).set(cleanUpdates).where(eq(packagesTable.id, parseInt(id, 10))).run();
	}
	invalidatePackagesCache();
}

export async function deletePackage(id: string): Promise<void> {
	const db = getDb();
	db.delete(packagesTable).where(eq(packagesTable.id, parseInt(id, 10))).run();
	invalidatePackagesCache();
}
