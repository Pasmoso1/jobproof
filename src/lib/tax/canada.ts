/**
 * Default Canadian sales tax by province/territory (combined GST/HST/PST-style rates).
 * Used for new jobs, contracts, and invoices — apply only at creation time.
 */

export const DEFAULT_CANADA_SALES_TAX_RATE = 0.13;

export type CanadaProvinceTax = {
  taxRate: number;
  /** Human-readable description */
  label: string;
  /** Compact, e.g. "13% (ON)" */
  shortLabel: string;
  /** Two-letter or canonical code for display */
  provinceCode: string;
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

function provinceCodeFromRaw(raw: string | null | undefined): string {
  if (!raw) return "";
  const s = raw.trim().toUpperCase();
  if (!s) return "";
  if (s.includes("ONTARIO") || s.startsWith("ON")) return "ON";
  if (s.includes("ALBERTA") || s.startsWith("AB")) return "AB";
  if (s.includes("BRITISH COLUMBIA") || s.startsWith("BC")) return "BC";
  if (
    s.includes("QUEBEC") ||
    s.includes("QUÉBEC") ||
    s.startsWith("QC") ||
    s.startsWith("PQ")
  ) {
    return "QC";
  }
  if (s.includes("MANITOBA") || s.startsWith("MB")) return "MB";
  if (s.includes("SASKATCHEWAN") || s.startsWith("SK")) return "SK";
  if (s.includes("NOVA SCOTIA") || s.startsWith("NS")) return "NS";
  if (s.includes("NEW BRUNSWICK") || s.startsWith("NB")) return "NB";
  if (s.includes("NEWFOUNDLAND") || s.startsWith("NL")) return "NL";
  if (s.includes("PRINCE EDWARD") || s.startsWith("PE")) return "PE";
  if (s.includes("NORTHWEST TERRITOR") || s.startsWith("NT")) return "NT";
  if (s.includes("NUNAVUT") || s.startsWith("NU")) return "NU";
  if (s.includes("YUKON") || s.startsWith("YT")) return "YT";
  if (s.length >= 2) return s.slice(0, 2);
  return s;
}

function formatPct(rate: number): string {
  const pct = rate * 100;
  if (Math.abs(pct - Math.round(pct)) < 1e-9) {
    return String(Math.round(pct));
  }
  return pct.toFixed(3).replace(/\.?0+$/, "");
}

/**
 * Default tax row for a province/territory name or code (e.g. "ON", "Ontario", "British Columbia").
 * Unknown or empty input → Ontario-style default (13%).
 */
export function getDefaultTaxForProvince(
  province: string | null | undefined
): CanadaProvinceTax {
  const raw = province?.trim() ?? "";
  const code = provinceCodeFromRaw(raw) || "ON";
  const row = RATE_BY_CODE[code];
  const rate = row?.rate ?? DEFAULT_CANADA_SALES_TAX_RATE;
  const labelBase = row?.label ?? "Sales tax (default)";
  const pctStr = formatPct(rate);
  const shortLabel = `${pctStr}% (${code})`;
  const label = `${pctStr}% — ${labelBase}`;

  return {
    taxRate: rate,
    label,
    shortLabel,
    provinceCode: code,
  };
}

/**
 * Prefer contractor business province; if missing, fall back to job work-site (property) province.
 * Matches prior app behavior when contractor province was unset.
 */
export function defaultTaxRateForNewFinancials(
  contractorProvince: string | null | undefined,
  jobPropertyProvince: string | null | undefined
): CanadaProvinceTax {
  if (contractorProvince?.trim()) {
    return getDefaultTaxForProvince(contractorProvince);
  }
  return getDefaultTaxForProvince(jobPropertyProvince);
}
