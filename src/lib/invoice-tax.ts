import { getDefaultTaxForProvince } from "@/lib/tax/canada";

/**
 * Sales tax rate (decimal) from a province/territory string.
 * Returns null when province is missing or unrecognized (do not assume Ontario).
 */
export function taxRateFromPropertyProvince(
  province: string | null | undefined
): number | null {
  return getDefaultTaxForProvince(province)?.taxRate ?? null;
}

/** Short label for UI; "Select province" when unset. */
export function invoiceTaxRateDisplayLabel(province: string | null | undefined): string {
  const t = getDefaultTaxForProvince(province);
  if (!t) return "Select province for tax";
  const pct = (t.taxRate * 100).toLocaleString(undefined, { maximumFractionDigits: 3 });
  return `${pct}% (${t.provinceName})`;
}

/** Compact label for invoice lines, e.g. "13% (Ontario)". */
export function invoiceTaxShortLabel(province: string | null | undefined): string {
  return getDefaultTaxForProvince(province)?.shortLabel ?? "Tax";
}

/** Label matching tax already stored on an invoice (subtotal + tax_amount). */
export function invoiceTaxShortLabelFromAppliedAmounts(
  subtotal: number,
  taxAmount: number
): string {
  if (!Number.isFinite(subtotal) || !Number.isFinite(taxAmount) || subtotal <= 0) {
    return "Tax";
  }
  const r = taxAmount / subtotal;
  const pct = r * 100;
  const pctStr =
    Math.abs(pct - Math.round(pct)) < 1e-6
      ? String(Math.round(pct))
      : pct.toFixed(3).replace(/\.?0+$/, "");
  return `${pctStr}%`;
}
