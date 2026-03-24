/** Shared client + server validation for job scope, contract price, customer email, and trade. */

export const SCOPE_OF_WORK_EMPTY_MESSAGE =
  "Scope of work is required. Describe what work will be completed.";

export const TRADE_REQUIRED_MESSAGE = "Trade is required (e.g. Electrical, Plumbing, Renovation).";

export function validateScopeOfWork(raw: string): string | null {
  const v = raw.trim();
  if (!v) return SCOPE_OF_WORK_EMPTY_MESSAGE;
  return null;
}

/** Non-empty trade / service category (stored in jobs.service_category). */
export function validateTrade(raw: string | null | undefined): string | null {
  const v = String(raw ?? "").trim();
  if (!v) return TRADE_REQUIRED_MESSAGE;
  return null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Validates non-empty, plausible email. Returns error message or null if OK. */
export function validateCustomerEmail(raw: string | null | undefined): string | null {
  const v = String(raw ?? "").trim();
  if (!v) return "Customer email is required.";
  if (!EMAIL_RE.test(v)) return "Enter a valid email address.";
  return null;
}

/** For remote signing flows — explicit copy per product requirements. */
export function validateCustomerEmailForRemote(raw: string | null | undefined): string | null {
  const v = String(raw ?? "").trim();
  if (!v) return "Customer email is required for remote signing.";
  if (!EMAIL_RE.test(v)) return "Enter a valid email address for remote signing.";
  return null;
}

export function isValidCustomerEmail(raw: string | null | undefined): boolean {
  return validateCustomerEmail(raw) === null;
}

export const JOB_ESTIMATED_START_REQUIRED = "Estimated start date is required.";
export const JOB_ESTIMATED_COMPLETION_REQUIRED = "Estimated completion date is required.";
export const JOB_DATES_ORDER_MESSAGE =
  "Estimated completion date must be on or after the estimated start date.";

/**
 * Validates required estimated start / completion and completion >= start (date-only strings YYYY-MM-DD).
 * Returns fieldErrors keyed as `start_date` and `estimated_completion_date`, or null if valid.
 */
export function validateJobEstimatedScheduleDates(
  startRaw: string | null | undefined,
  completionRaw: string | null | undefined
): Record<string, string> | null {
  const start = String(startRaw ?? "").trim();
  const completion = String(completionRaw ?? "").trim();
  const errors: Record<string, string> = {};
  if (!start) errors.start_date = JOB_ESTIMATED_START_REQUIRED;
  if (!completion) errors.estimated_completion_date = JOB_ESTIMATED_COMPLETION_REQUIRED;
  if (Object.keys(errors).length > 0) return errors;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) {
    errors.start_date = "Enter a valid estimated start date.";
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(completion)) {
    errors.estimated_completion_date = "Enter a valid estimated completion date.";
  }
  if (Object.keys(errors).length > 0) return errors;

  if (completion < start) {
    return { estimated_completion_date: JOB_DATES_ORDER_MESSAGE };
  }
  return null;
}

/**
 * Contract builder / contract_data: `startDate` and `completionDate` (YYYY-MM-DD).
 * Field keys match `ContractBuilderForm` state.
 */
export function validateContractBuilderScheduleDates(
  startRaw: string | null | undefined,
  completionRaw: string | null | undefined
): Record<string, string> | null {
  const fe = validateJobEstimatedScheduleDates(startRaw, completionRaw);
  if (!fe) return null;
  const out: Record<string, string> = {};
  if (fe.start_date) out.startDate = fe.start_date;
  if (fe.estimated_completion_date) out.completionDate = fe.estimated_completion_date;
  return out;
}

/** Single message for server actions (first applicable error). */
export function contractSigningScheduleErrorMessage(
  startRaw: string | null | undefined,
  completionRaw: string | null | undefined
): string | null {
  const fe = validateContractBuilderScheduleDates(startRaw, completionRaw);
  if (!fe) return null;
  return fe.startDate ?? fe.completionDate ?? null;
}

export function parsePositiveContractPrice(
  raw: unknown
): { ok: true; value: number } | { ok: false; message: string } {
  if (raw === null || raw === undefined) {
    return { ok: false, message: "Contract price is required." };
  }
  const s = String(raw).trim().replace(/[$,\s]/g, "");
  if (s === "") {
    return { ok: false, message: "Contract price is required." };
  }
  const n = Number.parseFloat(s);
  if (Number.isNaN(n) || !Number.isFinite(n)) {
    return { ok: false, message: "Enter a valid contract price." };
  }
  if (n <= 0) {
    return { ok: false, message: "Contract price must be greater than zero." };
  }
  return { ok: true, value: n };
}
