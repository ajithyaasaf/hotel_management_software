/**
 * @file dateTime.ts
 * @description Central IST (Asia/Kolkata, UTC+05:30) timezone utility for the frontend.
 *
 * WHY THIS FILE EXISTS:
 * The browser's `new Date().toISOString()` always returns UTC time. Between midnight
 * and 5:30 AM IST, this silently strips one day from every date string, causing:
 *   - Dashboard "Overdue" badge to count incorrectly
 *   - Banquet/Maintenance datetime-local inputs to submit wrong times to the cloud server
 *   - Printed invoice "nights" calculation to mismatch the billed amount
 *
 * RULE: Never use `.toISOString().split('T')[0]` on the frontend.
 * Always use the functions from this file instead.
 */

const IST_TIMEZONE = 'Asia/Kolkata';

/**
 * Get the current date string in IST (YYYY-MM-DD format).
 * Use this everywhere instead of `new Date().toISOString().split('T')[0]`.
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
 * Convert a `datetime-local` input string (e.g. "2026-07-21T14:30") to a
 * proper ISO 8601 string with the IST offset (+05:30) attached.
 *
 * WHY: <input type="datetime-local"> returns a naive local string with no
 * timezone info. When this is sent directly to a cloud UTC server via JSON,
 * the server treats it as UTC, shifting the time forward by 5.5 hours.
 *
 * Always run every datetime-local value through this before sending to the API.
 *
 * @example
 * const payload = {
 *   startTime: localDateTimeToIST(form.startTime),   // "2026-07-21T14:30+05:30"
 * }
 */
export function localDateTimeToIST(localDateTimeStr: string): string {
  if (!localDateTimeStr) return localDateTimeStr;
  // If it already has a timezone offset, return as-is
  if (localDateTimeStr.includes('+') || localDateTimeStr.endsWith('Z')) {
    return localDateTimeStr;
  }
  return `${localDateTimeStr}:00+05:30`;
}

/**
 * Compute calendar nights between two DateTime values using IST date boundaries.
 * This is the correct billing math for printed invoices and UI display.
 *
 * A 25-hour stay (check-in Mon 2 PM → checkout Tue 3 PM) = 1 night ✓
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
 * Format a Date for display in IST locale.
 * Returns a human-readable string like "21 Jul 2026, 02:30 PM".
 */
export function formatIST(date: Date, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TIMEZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    ...options,
  }).format(date);
}

/**
 * Get current date-time in IST formatted for <input type="datetime-local"> ("YYYY-MM-DDTHH:mm").
 * @param addHours - optional hours to add (e.g. 24 for tomorrow noon)
 */
export function getTodayISTDateTimeLocal(addHours = 0): string {
  const d = new Date(Date.now() + addHours * 60 * 60 * 1000);
  const dateStr = toISTDateString(d); // e.g. "2026-07-21"
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const hour = parts.find(p => p.type === 'hour')?.value || '12';
  const minute = parts.find(p => p.type === 'minute')?.value || '00';
  return `${dateStr}T${hour}:${minute}`;
}

/**
 * Convert 12-hour AM/PM time components into 24-hour "HH:mm" string.
 * Handles 12 AM (Midnight -> 00:mm), 12 PM (Noon -> 12:mm), and all intermediate values.
 */
export function convert12hTo24h(hour: string | number, minute: string | number, period: 'AM' | 'PM'): string {
  let h = typeof hour === 'number' ? hour : parseInt(String(hour).trim(), 10);
  let m = typeof minute === 'number' ? minute : parseInt(String(minute).trim(), 10);

  if (isNaN(h)) h = 12;
  if (isNaN(m)) m = 0;

  m = Math.max(0, Math.min(59, m));
  h = h % 12;
  if (period === 'PM') {
    h += 12;
  }

  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  return `${hh}:${mm}`;
}
