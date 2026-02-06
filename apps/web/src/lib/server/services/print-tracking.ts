import {
	markVouchersAsPrinted as _markVouchersAsPrinted,
	isVoucherPrinted as _isVoucherPrinted,
	getVouchersPrintStatus as _getVouchersPrintStatus,
	getAllPrintedVoucherCodes as _getAllPrintedVoucherCodes,
	removePrintTracking as _removePrintTracking,
	getPrintedCounts as _getPrintedCounts,
} from '$lib/server/convex';

/**
 * Mark vouchers as printed
 */
export async function markVouchersAsPrinted(voucherCodes: string[]): Promise<void> {
	return _markVouchersAsPrinted(voucherCodes);
}

/**
 * Check if a voucher has been printed
 */
export async function isVoucherPrinted(voucherCode: string): Promise<boolean> {
	return _isVoucherPrinted(voucherCode);
}

/**
 * Get print status for multiple vouchers
 * Returns a Map of voucherCode -> printedAt timestamp (or undefined if not printed)
 */
export async function getVouchersPrintStatus(voucherCodes: string[]): Promise<Map<string, number | undefined>> {
	return _getVouchersPrintStatus(voucherCodes);
}

/**
 * Get all printed voucher codes
 */
export async function getAllPrintedVoucherCodes(): Promise<Set<string>> {
	return _getAllPrintedVoucherCodes();
}

/**
 * Remove print tracking for deleted vouchers
 */
export async function removePrintTracking(voucherCodes: string[]): Promise<void> {
	return _removePrintTracking(voucherCodes);
}

/**
 * Get count of printed and unprinted vouchers
 */
export async function getPrintedCounts(allVoucherCodes: string[]): Promise<{ printed: number; unprinted: number }> {
	return _getPrintedCounts(allVoucherCodes);
}
