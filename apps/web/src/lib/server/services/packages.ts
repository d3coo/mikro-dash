import { db } from '$lib/server/db';
import { voucherPackages } from '$lib/server/db/schema';
import { eq, asc } from 'drizzle-orm';
import type { VoucherPackage, NewVoucherPackage } from '$lib/server/db/schema';

export function getAllPackages(): VoucherPackage[] {
  return db.select().from(voucherPackages).orderBy(asc(voucherPackages.sortOrder)).all();
}

export function getPackageById(id: string): VoucherPackage | undefined {
  return db.select().from(voucherPackages).where(eq(voucherPackages.id, id)).get();
}

export function createPackage(pkg: NewVoucherPackage): void {
  db.insert(voucherPackages).values(pkg).run();
}

export function updatePackage(id: string, updates: Partial<Omit<VoucherPackage, 'id'>>): void {
  db.update(voucherPackages)
    .set(updates)
    .where(eq(voucherPackages.id, id))
    .run();
}

export function deletePackage(id: string): void {
  db.delete(voucherPackages).where(eq(voucherPackages.id, id)).run();
}

export function getPackageByCodePrefix(voucherName: string): VoucherPackage | undefined {
  const packages = db.select().from(voucherPackages).orderBy(asc(voucherPackages.sortOrder)).all();
  // Sort by prefix length descending to match longer prefixes first (G10 before G1)
  const sorted = [...packages].sort((a, b) => b.codePrefix.length - a.codePrefix.length);
  return sorted.find(p => voucherName.startsWith(p.codePrefix));
}
