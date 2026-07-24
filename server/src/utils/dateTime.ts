/**
 * @file dateTime.ts
 * @description Central IST (Asia/Kolkata, UTC+05:30) timezone utility for the backend.
 *
 * WHY THIS FILE EXISTS:
 * All cloud servers (Render, Hugging Face, Vercel) run on UTC.
 * Using `new Date().toISOString().split('T')[0]` on a UTC server will extract the
 * WRONG date string between midnight and 5:30 AM IST — shifting everything to the
 * previous calendar day. This causes catastrophic failures in:
 *   - Night Audit (locks out users until 5:30 AM)
 *   - Revenue Reports (credits revenue to the wrong business day)
 *   - Expense Validation (blocks all expense logging between 12 AM – 5:30 AM)
 *   - System Config Fallback (resets hotel to yesterday after server restart)
 *
 * RULE: Never use `.toISOString().split('T')[0]` anywhere on the backend.
 * Always use the functions from this file instead.
 */

const IST_TIMEZONE = 'Asia/Kolkata';

/**
 * Get the current date string in IST (YYYY-MM-DD format).
 * Use this everywhere instead of `new Date().toISOString().split('T')[0]`.
 *
 * @example
 * // Before (BROKEN on cloud): new Date().toISOString().split('T')[0]
 * // After (SAFE):             getTodayIST()
 */
export function getTodayIST(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/**
 * Extract the YYYY-MM-DD date string from any Date object, in IST.
 * Use this instead of `someDate.toISOString().split('T')[0]`.
 *
 * @example
 * // Before (BROKEN on cloud): booking.checkInDate.toISOString().split('T')[0]
 * // After (SAFE):             toISTDateString(booking.checkInDate)
 */
export function toISTDateString(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Get the current Date object normalised to midnight IST.
 * Useful for "today at 00:00:00 IST" boundary comparisons.
 */
export function getTodayMidnightIST(): Date {
  const istDateStr = getTodayIST(); // e.g. "2026-07-21"
  // Create midnight in IST by appending IST offset. Prisma/JS will store as UTC.
  return new Date(`${istDateStr}T00:00:00+05:30`);
}

/**
 * Get "tomorrow at 00:00:00 IST" — used by expense validation guards so that
 * staff can log expenses right up until midnight IST, not midnight UTC.
 */
export function getTomorrowMidnightIST(): Date {
  const today = getTodayMidnightIST();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow;
}

/**
 * Given a business date string ("YYYY-MM-DD"), compute the number of calendar
 * nights between two exact DateTime values, using IST date boundaries.
 *
 * This is the SAFE billing math. It strips the time component and uses the
 * calendar-date difference, so:
 *   - A 25-hour stay (check-in Mon 2PM → checkout Tue 3PM) = 1 night ✓
 *   - A 47-hour stay (check-in Mon 2PM → checkout Wed 1PM) = 2 nights ✓
 *
 * NEVER use raw millisecond Math.ceil for billing calculations after time-tracking
 * is enabled — it will over-charge guests.
 */
export function computeCalendarNightsIST(checkIn: Date, checkOut: Date): number {
  if (!checkIn || !checkOut || isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
    return 1;
  }
  const inStr = toISTDateString(checkIn);
  const outStr = toISTDateString(checkOut);
  const inDate = new Date(`${inStr}T00:00:00+05:30`);
  const outDate = new Date(`${outStr}T00:00:00+05:30`);
  const diffMs = outDate.getTime() - inDate.getTime();
  if (diffMs <= 0) {
    return 1; // Same-day check-in/checkout or day-use minimum 1 night charge
  }
  const nights = Math.round(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(1, nights);
}

/**
 * Get the current hour in IST (0–23).
 * Used by Night Audit time-lock guards running on cloud UTC servers.
 *
 * @example
 * // The Night Audit should only run after midnight IST, not midnight UTC.
 * if (getCurrentHourIST() < 0) { throw new Error("Too early"); } // always valid after 00:00 IST
 */
export function getCurrentHourIST(): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: IST_TIMEZONE,
    hour: 'numeric',
    hour12: false,
  }).formatToParts(new Date());
  const hourPart = parts.find(p => p.type === 'hour');
  return parseInt(hourPart?.value ?? '0', 10);
}

/**
 * Format a Date object into readable IST string (e.g. "21 Jul 2026, 02:15 PM").
 */
export function formatIST(date: Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TIMEZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}
