/**
 * Canonical Canadian provinces and territories.
 * Store and display full names consistently. Abbreviations accepted for legacy data.
 */

export const CANADIAN_PROVINCES = [
  "Alberta",
  "British Columbia",
  "Manitoba",
  "New Brunswick",
  "Newfoundland and Labrador",
  "Northwest Territories",
  "Nova Scotia",
  "Nunavut",
  "Ontario",
  "Prince Edward Island",
  "Quebec",
  "Saskatchewan",
  "Yukon",
] as const;

export type CanadianProvinceName = (typeof CANADIAN_PROVINCES)[number];

const CODE_TO_NAME: Record<string, CanadianProvinceName> = {
  AB: "Alberta",
  BC: "British Columbia",
  MB: "Manitoba",
  NB: "New Brunswick",
  NL: "Newfoundland and Labrador",
  NT: "Northwest Territories",
  NS: "Nova Scotia",
  NU: "Nunavut",
  ON: "Ontario",
  PE: "Prince Edward Island",
  QC: "Quebec",
  SK: "Saskatchewan",
  YT: "Yukon",
  PQ: "Quebec",
};

const NAME_TO_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(CODE_TO_NAME).map(([code, name]) => [name.toUpperCase(), code])
);

/**
 * Normalize free text / legacy abbreviations to the canonical full province name.
 * Returns null when empty or not recognized.
 */
export function normalizeCanadianProvince(
  raw: string | null | undefined
): CanadianProvinceName | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;

  const upper = s.toUpperCase();
  if (CODE_TO_NAME[upper]) return CODE_TO_NAME[upper];

  for (const name of CANADIAN_PROVINCES) {
    if (name.toUpperCase() === upper) return name;
  }

  if (upper.includes("ONTARIO")) return "Ontario";
  if (upper.includes("ALBERTA")) return "Alberta";
  if (upper.includes("BRITISH COLUMBIA") || upper === "B.C.") return "British Columbia";
  if (upper.includes("QUEBEC") || upper.includes("QUÉBEC")) return "Quebec";
  if (upper.includes("MANITOBA")) return "Manitoba";
  if (upper.includes("SASKATCHEWAN")) return "Saskatchewan";
  if (upper.includes("NOVA SCOTIA")) return "Nova Scotia";
  if (upper.includes("NEW BRUNSWICK")) return "New Brunswick";
  if (upper.includes("NEWFOUNDLAND")) return "Newfoundland and Labrador";
  if (upper.includes("PRINCE EDWARD")) return "Prince Edward Island";
  if (upper.includes("NORTHWEST")) return "Northwest Territories";
  if (upper.includes("NUNAVUT")) return "Nunavut";
  if (upper.includes("YUKON")) return "Yukon";

  return null;
}

/** Two-letter code for tax helpers; null if unknown. */
export function canadianProvinceCode(
  raw: string | null | undefined
): string | null {
  const name = normalizeCanadianProvince(raw);
  if (!name) return null;
  return NAME_TO_CODE[name.toUpperCase()] ?? null;
}

/**
 * Value for a <select>: prefer matching option for legacy stored codes/names.
 * Returns "" when unset so the placeholder option is selected.
 */
export function provinceSelectValue(raw: string | null | undefined): string {
  return normalizeCanadianProvince(raw) ?? "";
}

export const PROVINCE_REQUIRED_FOR_TAX_MESSAGE =
  "Select a province or territory so JobProof can suggest the correct sales tax. You can still edit the tax rate after selecting.";
