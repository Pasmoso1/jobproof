/** Ontario-style default when province is missing or unrecognized. */
export const DEFAULT_INVOICE_TAX_RATE = 0.13;

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

function provinceCode(raw: string | null | undefined): string {
  if (!raw) return "";
  const s = raw.trim().toUpperCase();
  if (s.length >= 2) return s.slice(0, 2);
  return s;
}

/**
 * Sales tax rate (decimal) from the job’s work location (property province).
 * Ontario and unknown → 13%. Other provinces use common combined GST/HST/RST rates.
 */
export function taxRateFromPropertyProvince(province: string | null | undefined): number {
  const raw = province?.trim() ?? "";
  const upper = raw.toUpperCase();
  if (upper.includes("ONTARIO") || upper.startsWith("ON")) {
    return 0.13;
  }
  const code = provinceCode(province);
  const map: Record<string, number> = {
    ON: 0.13,
    NB: 0.15,
    NL: 0.15,
    NS: 0.15,
    PE: 0.15,
    BC: 0.12,
    MB: 0.12,
    SK: 0.11,
    AB: 0.05,
    NT: 0.05,
    NU: 0.05,
    YT: 0.05,
    QC: 0.14975,
  };
  if (code && map[code] != null) return map[code];
  return DEFAULT_INVOICE_TAX_RATE;
}

/** Short label for UI, e.g. "13.00% (ON — HST)". */
export function invoiceTaxRateDisplayLabel(province: string | null | undefined): string {
  const rate = taxRateFromPropertyProvince(province);
  const pct = (rate * 100).toLocaleString(undefined, { maximumFractionDigits: 3 });
  const code = provinceCode(province) || "ON (default)";
  return `${pct}% (${code})`;
}
