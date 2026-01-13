import { db } from '$lib/server/db';
import { vouchers, type Voucher, type NewVoucher } from '$lib/server/db/schema';
import { eq, like } from 'drizzle-orm';
import { getMikroTikClient, getSetting } from './settings';
import { getPackageById, type VoucherPackage } from '$lib/voucher-packages';

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

  const client = await getMikroTikClient();
  const created: Voucher[] = [];
  const now = new Date().toISOString();

  for (let i = 0; i < quantity; i++) {
    const id = await generateVoucherId(pkg);
    const password = generatePassword();

    const newVoucher: NewVoucher = {
      id,
      password,
      package: pkg.id,
      priceLE: pkg.priceLE,
      bytesLimit: pkg.bytes,
      status: 'available',
      createdAt: now
    };

    // Insert into local DB
    db.insert(vouchers).values(newVoucher).run();

    // Sync to MikroTik
    try {
      await client.createHotspotUser(id, password, pkg.profile, pkg.bytes);
    } catch (error) {
      console.error(`Failed to sync voucher ${id} to MikroTik:`, error);
      // Continue anyway - voucher exists locally
    }

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
