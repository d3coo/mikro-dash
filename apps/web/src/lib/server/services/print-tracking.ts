import { db } from '$lib/server/db';
import { printedVouchers } from '$lib/server/db/schema';
import { eq, inArray } from 'drizzle-orm';

/**
 * Mark vouchers as printed
 */
export async function markVouchersAsPrinted(voucherCodes: string[]): Promise<void> {
  if (voucherCodes.length === 0) return;

  const now = Date.now();
  for (const code of voucherCodes) {
    await db.insert(printedVouchers)
      .values({ voucherCode: code, printedAt: now })
      .onConflictDoUpdate({
        target: printedVouchers.voucherCode,
        set: { printedAt: now }
      });
  }
}

/**
 * Check if a voucher has been printed
 */
export async function isVoucherPrinted(voucherCode: string): Promise<boolean> {
  const results = await db
    .select()
    .from(printedVouchers)
    .where(eq(printedVouchers.voucherCode, voucherCode));
  return results.length > 0;
}

/**
 * Get print status for multiple vouchers
 * Returns a Map of voucherCode -> printedAt timestamp (or undefined if not printed)
 */
export async function getVouchersPrintStatus(voucherCodes: string[]): Promise<Map<string, number | undefined>> {
  const result = new Map<string, number | undefined>();

  if (voucherCodes.length === 0) return result;

  const printed = await db
    .select()
    .from(printedVouchers)
    .where(inArray(printedVouchers.voucherCode, voucherCodes));

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
export async function getAllPrintedVoucherCodes(): Promise<Set<string>> {
  const printed = await db.select().from(printedVouchers);
  return new Set(printed.map(p => p.voucherCode));
}

/**
 * Remove print tracking for deleted vouchers
 */
export async function removePrintTracking(voucherCodes: string[]): Promise<void> {
  if (voucherCodes.length === 0) return;

  for (const code of voucherCodes) {
    await db.delete(printedVouchers)
      .where(eq(printedVouchers.voucherCode, code));
  }
}

/**
 * Get count of printed and unprinted vouchers
 */
export async function getPrintedCounts(allVoucherCodes: string[]): Promise<{ printed: number; unprinted: number }> {
  const printedSet = await getAllPrintedVoucherCodes();
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
