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
export const CHANGE_ORDER_NEW_COMPLETION_DATE_REQUIRED = "New completion date is required.";
/** @deprecated Use CHANGE_ORDER_NEW_COMPLETION_DATE_REQUIRED */
export const CHANGE_ORDER_COMPLETION_DATE_REQUIRED = CHANGE_ORDER_NEW_COMPLETION_DATE_REQUIRED;

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

/** Validates the change order “new completion date” field only. */
export function validateChangeOrderNewCompletionDate(
  raw: string | null | undefined
): string | null {
  return validateChangeOrderDateField(
    raw,
    CHANGE_ORDER_NEW_COMPLETION_DATE_REQUIRED
  );
}
