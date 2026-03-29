/** User-facing dates/times for contractors and customers (Ontario / Eastern). */
export const APP_USER_TIMEZONE = "America/Toronto";

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
