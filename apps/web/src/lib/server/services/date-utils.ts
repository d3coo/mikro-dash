/**
 * Business day utilities for Cairo time (UTC+2).
 * The business day resets at 10:00 AM Cairo time (08:00 UTC).
 *
 * If the current time is before 10:00 AM Cairo, we're still in yesterday's business day.
 * If the current time is at or after 10:00 AM Cairo, we're in today's business day.
 */

const CAIRO_OFFSET_HOURS = 2; // UTC+2 (Egypt Standard Time, no DST)
const RESET_HOUR_CAIRO = 10; // 10:00 AM Cairo
const RESET_HOUR_UTC = RESET_HOUR_CAIRO - CAIRO_OFFSET_HOURS; // 08:00 UTC

/**
 * Get the start timestamp (ms) of the current business day.
 * Business day starts at 10:00 AM Cairo (08:00 UTC).
 */
export function getBusinessDayStartMs(now?: Date): number {
	const current = now ?? new Date();
	const dayStart = new Date(current);
	dayStart.setUTCHours(RESET_HOUR_UTC, 0, 0, 0);

	if (current.getTime() < dayStart.getTime()) {
		dayStart.setUTCDate(dayStart.getUTCDate() - 1);
	}

	return dayStart.getTime();
}

/**
 * Get the YYYY-MM-DD date string for the current business day (Cairo time).
 */
export function getBusinessDayDate(now?: Date): string {
	const startMs = getBusinessDayStartMs(now);
	// Add Cairo offset to get the Cairo calendar date at the reset moment
	const cairoTime = new Date(startMs + CAIRO_OFFSET_HOURS * 60 * 60 * 1000);
	const year = cairoTime.getUTCFullYear();
	const month = String(cairoTime.getUTCMonth() + 1).padStart(2, '0');
	const day = String(cairoTime.getUTCDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

/**
 * Get the end timestamp (ms) of a business day that starts at the given date string.
 * End = next business day start - 1ms.
 */
export function getBusinessDayEndMs(dateStr: string): number {
	const [year, month, day] = dateStr.split('-').map(Number);
	// Business day starts at RESET_HOUR_UTC on the given Cairo date
	const start = new Date(Date.UTC(year, month - 1, day, RESET_HOUR_UTC, 0, 0, 0));
	// Ends 24 hours later
	return start.getTime() + 24 * 60 * 60 * 1000;
}

/**
 * Get the YYYY-MM-DD date string for N business days ago.
 */
export function getBusinessDayDaysAgo(days: number, now?: Date): string {
	const current = now ?? new Date();
	const shifted = new Date(current.getTime() - days * 24 * 60 * 60 * 1000);
	return getBusinessDayDate(shifted);
}
