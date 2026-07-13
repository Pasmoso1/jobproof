/**
 * Default Canadian sales tax by province/territory (combined GST/HST/PST-style rates).
 * Used for new jobs, contracts, and invoices — apply only at creation time.
 *
 * Does NOT silently assume Ontario when province is missing.
 */

import {
  canadianProvinceCode,
  normalizeCanadianProvince,
  PROVINCE_REQUIRED_FOR_TAX_MESSAGE,
} from "@/lib/canada/provinces";

export { PROVINCE_REQUIRED_FOR_TAX_MESSAGE };

export type CanadaProvinceTax = {
  taxRate: number;
  /** Human-readable description */
  label: string;
  /** Compact, e.g. "13% (Ontario)" */
  shortLabel: string;
  /** Two-letter code for display */
  provinceCode: string;
  /** Canonical full province name */
  provinceName: string;
};

const RATE_BY_CODE: Record<string, { rate: number; label: string }> = {
  ON: { rate: 0.13, label: "HST (Ontario)" },
  NB: { rate: 0.15, label: "HST (New Brunswick)" },
  NL: { rate: 0.15, label: "HST (Newfoundland and Labrador)" },
  NS: { rate: 0.15, label: "HST (Nova Scotia)" },
  PE: { rate: 0.15, label: "HST (Prince Edward Island)" },
  BC: { rate: 0.12, label: "GST + PST (British Columbia)" },
  MB: { rate: 0.12, label: "GST + RST (Manitoba)" },
  SK: { rate: 0.11, label: "GST + PST (Saskatchewan)" },
  AB: { rate: 0.05, label: "GST only (Alberta)" },
  NT: { rate: 0.05, label: "GST (Northwest Territories)" },
  NU: { rate: 0.05, label: "GST (Nunavut)" },
  YT: { rate: 0.05, label: "GST (Yukon)" },
  QC: { rate: 0.14975, label: "GST + QST (Quebec)" },
};

function formatPct(rate: number): string {
  const pct = rate * 100;
  if (Math.abs(pct - Math.round(pct)) < 1e-9) {
    return String(Math.round(pct));
  }
  return pct.toFixed(3).replace(/\.?0+$/, "");
}

/**
 * Default tax row for a recognized Canadian province/territory.
 * Returns null when province is missing or not recognized — never assumes Ontario.
 */
export function getDefaultTaxForProvince(
  province: string | null | undefined
): CanadaProvinceTax | null {
  const name = normalizeCanadianProvince(province);
  const code = canadianProvinceCode(province);
  if (!name || !code) return null;
  const row = RATE_BY_CODE[code];
  if (!row) return null;
  const pctStr = formatPct(row.rate);
  return {
    taxRate: row.rate,
    label: `${pctStr}% — ${row.label}`,
    shortLabel: `${pctStr}% (${name})`,
    provinceCode: code,
    provinceName: name,
  };
}

/**
 * Prefer contractor business province; if missing, fall back to job property province.
 * Returns null when neither yields a recognized province (caller must require selection).
 */
export function defaultTaxRateForNewFinancials(
  contractorProvince: string | null | undefined,
  jobPropertyProvince: string | null | undefined
): CanadaProvinceTax | null {
  if (contractorProvince?.trim()) {
    const fromContractor = getDefaultTaxForProvince(contractorProvince);
    if (fromContractor) return fromContractor;
  }
  return getDefaultTaxForProvince(jobPropertyProvince);
}

/** @deprecated Prefer getDefaultTaxForProvince which returns null when unset. */
export const DEFAULT_CANADA_SALES_TAX_RATE = 0.13;
