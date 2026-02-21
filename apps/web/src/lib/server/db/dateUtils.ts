/**
 * Business day utilities for Cairo time (UTC+2).
 * The business day resets at 10:00 AM Cairo time (08:00 UTC).
 */

const CAIRO_OFFSET_HOURS = 2;
const RESET_HOUR_CAIRO = 10;
const RESET_HOUR_UTC = RESET_HOUR_CAIRO - CAIRO_OFFSET_HOURS; // 08:00 UTC

export function getBusinessDayStartMs(now?: Date): number {
	const current = now ?? new Date();
	const dayStart = new Date(current);
	dayStart.setUTCHours(RESET_HOUR_UTC, 0, 0, 0);

	if (current.getTime() < dayStart.getTime()) {
		dayStart.setUTCDate(dayStart.getUTCDate() - 1);
	}

	return dayStart.getTime();
}

export function getBusinessDayDate(now?: Date): string {
	const startMs = getBusinessDayStartMs(now);
	const cairoTime = new Date(startMs + CAIRO_OFFSET_HOURS * 60 * 60 * 1000);
	const year = cairoTime.getUTCFullYear();
	const month = String(cairoTime.getUTCMonth() + 1).padStart(2, '0');
	const day = String(cairoTime.getUTCDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}
