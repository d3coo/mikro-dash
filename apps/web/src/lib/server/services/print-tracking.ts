import { getDb } from '$lib/server/db';
import { printedVouchers } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Mark vouchers as printed
 */
export async function markVouchersAsPrinted(voucherCodes: string[]): Promise<void> {
	if (voucherCodes.length === 0) return;
	const db = getDb();
	const now = Date.now();
	for (const code of voucherCodes) {
		db.insert(printedVouchers)
			.values({ voucherCode: code, printedAt: now })
			.onConflictDoUpdate({ target: printedVouchers.voucherCode, set: { printedAt: now } })
			.run();
	}
}

/**
 * Check if a voucher has been printed
 */
export async function isVoucherPrinted(voucherCode: string): Promise<boolean> {
	const db = getDb();
	const row = db.select().from(printedVouchers)
		.where(eq(printedVouchers.voucherCode, voucherCode)).get();
	return !!row;
}

/**
 * Get print status for multiple vouchers
 */
export async function getVouchersPrintStatus(voucherCodes: string[]): Promise<Map<string, number | undefined>> {
	const result = new Map<string, number | undefined>();
	if (voucherCodes.length === 0) return result;
	const db = getDb();
	const rows = db.select().from(printedVouchers).all();
	const codeSet = new Set(voucherCodes);
	for (const row of rows) {
		if (codeSet.has(row.voucherCode)) {
			result.set(row.voucherCode, row.printedAt);
		}
	}
	return result;
}

/**
 * Get all printed voucher codes
 */
export async function getAllPrintedVoucherCodes(): Promise<Set<string>> {
	const db = getDb();
	const rows = db.select({ voucherCode: printedVouchers.voucherCode }).from(printedVouchers).all();
	return new Set(rows.map(r => r.voucherCode));
}

/**
 * Remove print tracking for deleted vouchers
 */
export async function removePrintTracking(voucherCodes: string[]): Promise<void> {
	if (voucherCodes.length === 0) return;
	const db = getDb();
	for (const code of voucherCodes) {
		db.delete(printedVouchers).where(eq(printedVouchers.voucherCode, code)).run();
	}
}

/**
 * Get count of printed and unprinted vouchers
 */
export async function getPrintedCounts(allVoucherCodes: string[]): Promise<{ printed: number; unprinted: number }> {
	const printedCodes = await getAllPrintedVoucherCodes();
	const printed = allVoucherCodes.filter(c => printedCodes.has(c)).length;
	return { printed, unprinted: allVoucherCodes.length - printed };
}
