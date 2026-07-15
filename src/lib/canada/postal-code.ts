/**
 * Normalize Canadian postal codes for Stripe Customer address.postal_code.
 * Accepts "A1A1A1", "a1a 1a1", etc. Returns "A1A 1A1" when valid.
 */

const CA_POSTAL_RE = /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z]\d[ABCEGHJ-NPRSTV-Z]\d$/i;

export function normalizeCanadianPostalCode(
  raw: string | null | undefined
): string | null {
  const compact = String(raw ?? "")
    .trim()
    .replace(/[\s-]+/g, "")
    .toUpperCase();
  if (!compact) return null;
  if (!CA_POSTAL_RE.test(compact)) return null;
  return `${compact.slice(0, 3)} ${compact.slice(3)}`;
}

export function isValidCanadianPostalCode(raw: string | null | undefined): boolean {
  return normalizeCanadianPostalCode(raw) != null;
}
