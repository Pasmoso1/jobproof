/** Change order form + remote send validation (shared patterns with job email rules). */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const CHANGE_ORDER_REMOTE_EMAIL_REQUIRED =
  "Customer email is required to send this change order.";

/** For emailing a change order signing link — explicit product copy when empty. */
export function validateCustomerEmailForChangeOrderRemote(
  raw: string | null | undefined
): string | null {
  const v = String(raw ?? "").trim();
  if (!v) return CHANGE_ORDER_REMOTE_EMAIL_REQUIRED;
  if (!EMAIL_RE.test(v)) return "Enter a valid email address.";
  return null;
}

export function isValidCustomerEmailForChangeOrderRemote(
  raw: string | null | undefined
): boolean {
  return validateCustomerEmailForChangeOrderRemote(raw) === null;
}

export const CHANGE_ORDER_TITLE_REQUIRED = "Title is required.";
export const CHANGE_ORDER_DESCRIPTION_REQUIRED = "Description is required.";
export const CHANGE_ORDER_NEW_TOTAL_REQUIRED = "New job total is required.";
export const CHANGE_ORDER_NEW_TOTAL_INVALID = "Enter a valid new job total greater than zero.";
export const CHANGE_ORDER_START_DATE_REQUIRED = "Estimated start date is required.";
export const CHANGE_ORDER_COMPLETION_DATE_REQUIRED = "Estimated completion date is required.";
export const CHANGE_ORDER_DATES_ORDER =
  "Estimated completion date must be on or after the estimated start date.";

export function validateChangeOrderTitle(raw: string | null | undefined): string | null {
  if (!String(raw ?? "").trim()) return CHANGE_ORDER_TITLE_REQUIRED;
  return null;
}

export function validateChangeOrderDescription(raw: string | null | undefined): string | null {
  if (!String(raw ?? "").trim()) return CHANGE_ORDER_DESCRIPTION_REQUIRED;
  return null;
}

export function parseNewJobTotal(
  raw: unknown
): { ok: true; value: number } | { ok: false; message: string } {
  const s = String(raw ?? "").trim().replace(/[$,\s]/g, "");
  if (!s) return { ok: false, message: CHANGE_ORDER_NEW_TOTAL_REQUIRED };
  const n = Number.parseFloat(s);
  if (Number.isNaN(n) || !Number.isFinite(n) || n <= 0) {
    return { ok: false, message: CHANGE_ORDER_NEW_TOTAL_INVALID };
  }
  return { ok: true, value: n };
}

export function validateChangeOrderDateField(
  raw: string | null | undefined,
  emptyMessage: string
): string | null {
  const v = String(raw ?? "").trim();
  if (!v) return emptyMessage;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return "Use a valid date.";
  return null;
}

/** Returns null if OK, else error message. */
export function validateChangeOrderSchedule(
  startIso: string,
  endIso: string
): string | null {
  const s = validateChangeOrderDateField(startIso, CHANGE_ORDER_START_DATE_REQUIRED);
  if (s) return s;
  const e = validateChangeOrderDateField(endIso, CHANGE_ORDER_COMPLETION_DATE_REQUIRED);
  if (e) return e;
  if (new Date(endIso) < new Date(startIso)) return CHANGE_ORDER_DATES_ORDER;
  return null;
}
