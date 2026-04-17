/** User-facing dates/times for contractors and customers (Ontario / Eastern). */
export const APP_USER_TIMEZONE = "America/Toronto";

/** Today's calendar date as `YYYY-MM-DD` in Eastern time. */
export function getTodayYmdEastern(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_USER_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Calendar `YYYY-MM-DD` in Eastern for an instant (ISO string or Date). */
export function isoToYmdEastern(input: string | Date): string {
  const d = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_USER_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Whole-day difference `endYmd - startYmd` (non-negative when end >= start). */
export function diffCalendarDaysYmd(startYmd: string, endYmd: string): number {
  const a = startYmd.trim();
  const b = endYmd.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a) || !/^\d{4}-\d{2}-\d{2}$/.test(b)) return 0;
  const [y1, m1, d1] = a.split("-").map(Number);
  const [y2, m2, d2] = b.split("-").map(Number);
  const u1 = Date.UTC(y1, m1 - 1, d1);
  const u2 = Date.UTC(y2, m2 - 1, d2);
  return Math.max(0, Math.round((u2 - u1) / 86400000));
}

/**
 * Format an instant (ISO string or Date) as a calendar date in Eastern time.
 * Use for DB timestamps (`created_at`, `signed_at`, etc.).
 */
export function formatDateEastern(
  input: string | Date,
  options?: { dateStyle?: "long" | "medium" | "short" }
): string {
  const d = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_USER_TIMEZONE,
    dateStyle: options?.dateStyle ?? "long",
  }).format(d);
}

/**
 * Format an instant as date + time in Eastern time (e.g. invoice issued, update documented).
 */
export function formatDateTimeEastern(input: string | Date): string {
  const d = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_USER_TIMEZONE,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

/**
 * Format a job-local calendar date string (`YYYY-MM-DD` from forms or DB) in Eastern context.
 */
export function formatLocalDateStringEastern(
  ymd: string,
  options?: { dateStyle?: "long" | "medium" | "short" }
): string {
  const trimmed = ymd.trim();
  if (!trimmed) return "";
  const d = new Date(`${trimmed}T12:00:00`);
  if (Number.isNaN(d.getTime())) return trimmed;
  return formatDateEastern(d, options);
}

/**
 * First and last calendar day (`YYYY-MM-DD`) of the month that contains `now` in Eastern time.
 * Used for grouping payment rows by contractor-facing month (Ontario).
 */
export function getEasternMonthYmdRange(now: Date = new Date()): {
  startYmd: string;
  endYmd: string;
} {
  const today = getTodayYmdEastern(now);
  const [yStr, mStr] = today.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    return { startYmd: today, endYmd: today };
  }
  const startYmd = `${yStr}-${mStr}-01`;
  const monthIndex = m - 1;
  const lastDay = new Date(y, monthIndex + 1, 0).getDate();
  const endYmd = `${yStr}-${mStr}-${String(lastDay).padStart(2, "0")}`;
  return { startYmd, endYmd };
}
