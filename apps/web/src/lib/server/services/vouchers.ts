import { db } from '$lib/server/db';
import { vouchers, type Voucher, type NewVoucher, type VoucherPackage } from '$lib/server/db/schema';
import { eq, like } from 'drizzle-orm';
import { getMikroTikClient, getSetting } from './settings';
import { getPackageById } from './packages';

/**
 * Generates a random password excluding confusing characters.
 * Excludes: 0, O, 1, l, I (to avoid confusion when reading)
 */
function generatePassword(length = 8): string {
  // Excluding confusing characters: 0, O, 1, l, I
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function generateVoucherId(pkg: VoucherPackage): Promise<string> {
  const prefix = await getSetting('voucher_prefix');
  const pkgCode = pkg.id.replace('.', '').replace('GB', 'G');

  // Find the highest existing number for this prefix+package
  const existing = db
    .select()
    .from(vouchers)
    .where(like(vouchers.id, `${prefix}-${pkgCode}-%`))
    .all();

  let maxNum = 0;
  for (const v of existing) {
    const parts = v.id.split('-');
    const num = parseInt(parts[parts.length - 1], 10);
    if (num > maxNum) maxNum = num;
  }

  const nextNum = (maxNum + 1).toString().padStart(3, '0');
  return `${prefix}-${pkgCode}-${nextNum}`;
}

export async function createVouchers(
  packageId: string,
  quantity: number
): Promise<Voucher[]> {
  const pkg = getPackageById(packageId);
  if (!pkg) throw new Error(`Invalid package: ${packageId}`);

  let client;
  try {
    client = await getMikroTikClient();
  } catch {
    client = null;
  }

  const created: Voucher[] = [];
  const now = new Date().toISOString();

  for (let i = 0; i < quantity; i++) {
    const id = await generateVoucherId(pkg);
    const password = generatePassword();
    let synced = false;

    // Try to sync to MikroTik first
    if (client) {
      try {
        await client.createHotspotUser(id, password, pkg.profile, {
          limitBytes: pkg.bytes,
          server: pkg.server || undefined,
          comment: `${pkg.nameAr} - ${pkg.priceLE} LE`
        });
        synced = true;
      } catch (error) {
        console.error(`Failed to sync voucher ${id} to MikroTik:`, error);
      }
    }

    const newVoucher: NewVoucher = {
      id,
      password,
      package: pkg.id,
      priceLE: pkg.priceLE,
      bytesLimit: pkg.bytes,
      status: 'available',
      synced,
      createdAt: now
    };

    // Insert into local DB
    db.insert(vouchers).values(newVoucher).run();
    created.push(newVoucher as Voucher);
  }

  return created;
}

export function getVouchers(status?: string): Voucher[] {
  if (status) {
    return db.select().from(vouchers).where(eq(vouchers.status, status)).all();
  }
  return db.select().from(vouchers).all();
}

export function getVoucherById(id: string): Voucher | undefined {
  return db.select().from(vouchers).where(eq(vouchers.id, id)).get();
}

export async function deleteVoucher(id: string): Promise<void> {
  const voucher = getVoucherById(id);
  if (!voucher) return;

  // Delete from MikroTik
  try {
    const client = await getMikroTikClient();
    const users = await client.getHotspotUsers();
    const user = users.find(u => u.name === id);
    if (user) {
      await client.deleteHotspotUser(user['.id']);
    }
  } catch (error) {
    console.error(`Failed to delete voucher ${id} from MikroTik:`, error);
  }

  // Delete from local DB
  db.delete(vouchers).where(eq(vouchers.id, id)).run();
}

export async function deleteVouchers(ids: string[]): Promise<void> {
  for (const id of ids) {
    await deleteVoucher(id);
  }
}

export function getUnsyncedVouchers(): Voucher[] {
  return db.select().from(vouchers).where(eq(vouchers.synced, false)).all();
}

export async function syncVoucher(id: string): Promise<boolean> {
  const voucher = getVoucherById(id);
  if (!voucher || voucher.synced) return false;

  const pkg = getPackageById(voucher.package);
  if (!pkg) return false;

  try {
    const client = await getMikroTikClient();
    await client.createHotspotUser(voucher.id, voucher.password, pkg.profile, {
      limitBytes: pkg.bytes,
      server: pkg.server || undefined,
      comment: `${pkg.nameAr} - ${pkg.priceLE} LE`
    });

    // Update sync status in DB
    db.update(vouchers).set({ synced: true }).where(eq(vouchers.id, id)).run();
    return true;
  } catch (error) {
    console.error(`Failed to sync voucher ${id}:`, error);
    return false;
  }
}

export async function syncAllVouchers(): Promise<{ synced: number; failed: number }> {
  const unsynced = getUnsyncedVouchers();
  let synced = 0;
  let failed = 0;

  for (const voucher of unsynced) {
    const success = await syncVoucher(voucher.id);
    if (success) synced++;
    else failed++;
  }

  return { synced, failed };
}
