import { db } from '$lib/server/db';
import { printedVouchers } from '$lib/server/db/schema';
import { eq, inArray } from 'drizzle-orm';

/**
 * Mark vouchers as printed
 */
export function markVouchersAsPrinted(voucherCodes: string[]): void {
  if (voucherCodes.length === 0) return;

  const now = Date.now();
  for (const code of voucherCodes) {
    db.insert(printedVouchers)
      .values({ voucherCode: code, printedAt: now })
      .onConflictDoUpdate({
        target: printedVouchers.voucherCode,
        set: { printedAt: now }
      })
      .run();
  }
}

/**
 * Check if a voucher has been printed
 */
export function isVoucherPrinted(voucherCode: string): boolean {
  const result = db
    .select()
    .from(printedVouchers)
    .where(eq(printedVouchers.voucherCode, voucherCode))
    .get();
  return !!result;
}

/**
 * Get print status for multiple vouchers
 * Returns a Map of voucherCode -> printedAt timestamp (or undefined if not printed)
 */
export function getVouchersPrintStatus(voucherCodes: string[]): Map<string, number | undefined> {
  const result = new Map<string, number | undefined>();

  if (voucherCodes.length === 0) return result;

  const printed = db
    .select()
    .from(printedVouchers)
    .where(inArray(printedVouchers.voucherCode, voucherCodes))
    .all();

  // Initialize all as not printed
  for (const code of voucherCodes) {
    result.set(code, undefined);
  }

  // Mark printed ones
  for (const p of printed) {
    result.set(p.voucherCode, p.printedAt);
  }

  return result;
}

/**
 * Get all printed voucher codes
 */
export function getAllPrintedVoucherCodes(): Set<string> {
  const printed = db.select().from(printedVouchers).all();
  return new Set(printed.map(p => p.voucherCode));
}

/**
 * Remove print tracking for deleted vouchers
 */
export function removePrintTracking(voucherCodes: string[]): void {
  if (voucherCodes.length === 0) return;

  for (const code of voucherCodes) {
    db.delete(printedVouchers)
      .where(eq(printedVouchers.voucherCode, code))
      .run();
  }
}

/**
 * Get count of printed and unprinted vouchers
 */
export function getPrintedCounts(allVoucherCodes: string[]): { printed: number; unprinted: number } {
  const printedSet = getAllPrintedVoucherCodes();
  let printed = 0;
  let unprinted = 0;

  for (const code of allVoucherCodes) {
    if (printedSet.has(code)) {
      printed++;
    } else {
      unprinted++;
    }
  }

  return { printed, unprinted };
}
