import {
  AsYouType,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";
import { DEFAULT_CONTRACTOR_COUNTRY_CODE } from "@/lib/canada/country";

const DEFAULT_REGION = DEFAULT_CONTRACTOR_COUNTRY_CODE as CountryCode;

/**
 * Validate a Canadian (or region-default) phone number.
 * Accepts common formats: (555) 123-4567, 555-123-4567, +1 555..., etc.
 */
export function validateCanadianPhone(
  raw: string | null | undefined,
  options?: { required?: boolean; label?: string }
): string | null {
  const required = options?.required !== false;
  const label = options?.label ?? "phone number";
  const v = String(raw ?? "").trim();
  if (!v) {
    return required ? `Enter a ${label}.` : null;
  }
  const parsed = parsePhoneNumberFromString(v, DEFAULT_REGION);
  if (!parsed || !parsed.isValid()) {
    return `Enter a valid Canadian ${label}.`;
  }
  return null;
}

/**
 * Normalize for storage (E.164 when valid, e.g. +15551234567).
 * Returns trimmed original if parsing fails (legacy data safety).
 */
export function normalizeCanadianPhoneForStorage(
  raw: string | null | undefined
): string | null {
  const v = String(raw ?? "").trim();
  if (!v) return null;
  const parsed = parsePhoneNumberFromString(v, DEFAULT_REGION);
  if (parsed?.isValid()) return parsed.format("E.164");
  return v;
}

/** User-friendly national formatting for display. */
export function formatCanadianPhoneForDisplay(
  raw: string | null | undefined
): string {
  const v = String(raw ?? "").trim();
  if (!v) return "";
  const parsed = parsePhoneNumberFromString(v, DEFAULT_REGION);
  if (parsed?.isValid()) return parsed.formatNational();
  try {
    return new AsYouType(DEFAULT_REGION).input(v);
  } catch {
    return v;
  }
}
