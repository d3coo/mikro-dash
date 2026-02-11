/**
 * Convex queries and mutations for print tracking
 */

import { query, mutation } from './_generated/server';
import { v } from 'convex/values';

/**
 * Mark vouchers as printed (upsert - update timestamp if already exists)
 */
export const markAsPrinted = mutation({
	args: { voucherCodes: v.array(v.string()) },
	handler: async (ctx, { voucherCodes }) => {
		const now = Date.now();
		for (const code of voucherCodes) {
			const existing = await ctx.db
				.query('printedVouchers')
				.withIndex('by_code', (q) => q.eq('voucherCode', code))
				.unique();

			if (existing) {
				await ctx.db.patch(existing._id, { printedAt: now });
			} else {
				await ctx.db.insert('printedVouchers', { voucherCode: code, printedAt: now });
			}
		}
	},
});

/**
 * Check if a single voucher has been printed
 */
export const isPrinted = query({
	args: { voucherCode: v.string() },
	handler: async (ctx, { voucherCode }) => {
		const result = await ctx.db
			.query('printedVouchers')
			.withIndex('by_code', (q) => q.eq('voucherCode', voucherCode))
			.unique();
		return result !== null;
	},
});

/**
 * Get print status for multiple vouchers
 * Returns array of { voucherCode, printedAt: number | null }
 */
export const getPrintStatus = query({
	args: { voucherCodes: v.array(v.string()) },
	handler: async (ctx, { voucherCodes }) => {
		const results: Array<{ voucherCode: string; printedAt: number | null }> = [];
		for (const code of voucherCodes) {
			const record = await ctx.db
				.query('printedVouchers')
				.withIndex('by_code', (q) => q.eq('voucherCode', code))
				.unique();
			results.push({ voucherCode: code, printedAt: record?.printedAt ?? null });
		}
		return results;
	},
});

/**
 * Get all printed voucher codes
 */
export const getAllPrintedCodes = query({
	args: {},
	handler: async (ctx) => {
		const all = await ctx.db.query('printedVouchers').collect();
		return all.map((r) => r.voucherCode);
	},
});

/**
 * Remove print tracking for given voucher codes
 */
export const removePrintTracking = mutation({
	args: { voucherCodes: v.array(v.string()) },
	handler: async (ctx, { voucherCodes }) => {
		for (const code of voucherCodes) {
			const existing = await ctx.db
				.query('printedVouchers')
				.withIndex('by_code', (q) => q.eq('voucherCode', code))
				.unique();
			if (existing) {
				await ctx.db.delete(existing._id);
			}
		}
	},
});

/**
 * Get printed/unprinted counts for a set of voucher codes
 */
export const getPrintedCounts = query({
	args: { allVoucherCodes: v.array(v.string()) },
	handler: async (ctx, { allVoucherCodes }) => {
		let printed = 0;
		let unprinted = 0;
		for (const code of allVoucherCodes) {
			const record = await ctx.db
				.query('printedVouchers')
				.withIndex('by_code', (q) => q.eq('voucherCode', code))
				.unique();
			if (record) {
				printed++;
			} else {
				unprinted++;
			}
		}
		return { printed, unprinted };
	},
});
