import { db } from '$lib/server/db';
import { settings } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { MikroTikClient } from '$lib/server/mikrotik';

export type SettingsKey =
  | 'mikrotik_host'
  | 'mikrotik_user'
  | 'mikrotik_pass'
  | 'hotspot_server'
  | 'voucher_prefix'
  | 'business_name'
  | 'language'
  | 'theme';

export async function getSetting(key: SettingsKey): Promise<string> {
  const result = db.select().from(settings).where(eq(settings.key, key)).get();
  return result?.value ?? '';
}

export async function setSetting(key: SettingsKey, value: string): Promise<void> {
  db.insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } })
    .run();
}

export async function getAllSettings(): Promise<Record<SettingsKey, string>> {
  const rows = db.select().from(settings).all();
  const result: Record<string, string> = {};
  for (const row of rows) {
    result[row.key] = row.value;
  }
  return result as Record<SettingsKey, string>;
}

export async function getMikroTikClient(): Promise<MikroTikClient> {
  const host = await getSetting('mikrotik_host');
  const user = await getSetting('mikrotik_user');
  const pass = await getSetting('mikrotik_pass');

  return new MikroTikClient({
    host,
    username: user,
    password: pass
  });
}
