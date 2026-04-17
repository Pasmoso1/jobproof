import {
  DEFAULT_CANADA_SALES_TAX_RATE,
  getDefaultTaxForProvince,
} from "@/lib/tax/canada";

/** Ontario-style default when province is missing or unrecognized. */
export const DEFAULT_INVOICE_TAX_RATE = DEFAULT_CANADA_SALES_TAX_RATE;

/** @deprecated Invoice tax is derived from job property province; kept for any legacy callers. */
export function resolveInvoiceTaxRate(
  clientTaxRate: number,
  jobTaxRate: number | null | undefined
): number {
  const c = Number(clientTaxRate);
  if (Number.isFinite(c) && c >= 0) return c;
  const j = jobTaxRate != null ? Number(jobTaxRate) : NaN;
  if (Number.isFinite(j) && j >= 0) return j;
  return DEFAULT_INVOICE_TAX_RATE;
}

/**
 * Sales tax rate (decimal) from a province/territory string (job site or contractor).
 * Ontario and unknown → 13%. Other provinces use common combined GST/HST/RST rates.
 */
export function taxRateFromPropertyProvince(province: string | null | undefined): number {
  return getDefaultTaxForProvince(province).taxRate;
}

/** Short label for UI, e.g. "13.00% (ON — HST)". */
export function invoiceTaxRateDisplayLabel(province: string | null | undefined): string {
  const t = getDefaultTaxForProvince(province);
  const pct = (t.taxRate * 100).toLocaleString(undefined, { maximumFractionDigits: 3 });
  const code = province?.trim() ? t.provinceCode : `${t.provinceCode} (default)`;
  return `${pct}% (${code})`;
}

/** Compact label for invoice lines, e.g. "13% (ON)" or "14.975% (QC)". */
export function invoiceTaxShortLabel(province: string | null | undefined): string {
  return getDefaultTaxForProvince(province).shortLabel;
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
