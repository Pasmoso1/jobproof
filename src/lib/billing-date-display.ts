import { APP_USER_TIMEZONE } from "@/lib/datetime-eastern";

/** All user-facing JobProof subscription/billing dates use Eastern (America/Toronto). */
export const BILLING_DISPLAY_TIMEZONE = APP_USER_TIMEZONE;

function parseBillingInstant(value: string | Date | null | undefined): Date | null {
  if (value == null || value === "") return null;
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/**
 * Calendar date for billing UI, e.g. `May 18, 2026`.
 * Interprets ISO UTC instants in America/Toronto.
 */
export function formatBillingDateEastern(value: string | Date | null | undefined): string {
  const d = parseBillingInstant(value);
  if (!d) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BILLING_DISPLAY_TIMEZONE,
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

/**
 * Date and time for billing admin/audit display, e.g. `May 18, 2026, 2:15 p.m.`
 */
export function formatBillingDateTimeEastern(value: string | Date | null | undefined): string {
  const d = parseBillingInstant(value);
  if (!d) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BILLING_DISPLAY_TIMEZONE,
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

/** Same as {@link formatBillingDateEastern}, or em dash when missing/invalid. */
export function formatBillingDateOrDash(value: string | Date | null | undefined): string {
  const formatted = formatBillingDateEastern(value);
  return formatted || "—";
}
