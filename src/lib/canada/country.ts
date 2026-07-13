/**
 * JobProof currently serves Canadian contractors only.
 * Country is fixed to Canada for now; keep this helper so a selectable
 * country field can be introduced later without restructuring forms.
 */
export const DEFAULT_CONTRACTOR_COUNTRY = "Canada" as const;
export const DEFAULT_CONTRACTOR_COUNTRY_CODE = "CA" as const;

export type SupportedContractorCountry = typeof DEFAULT_CONTRACTOR_COUNTRY;

/** Future: expand this list when JobProof supports additional countries. */
export const SUPPORTED_CONTRACTOR_COUNTRIES: readonly SupportedContractorCountry[] = [
  DEFAULT_CONTRACTOR_COUNTRY,
];

export function resolveContractorCountry(
  // Reserved for future multi-country support (ignored today — Canada only).
  raw?: string | null
): SupportedContractorCountry {
  void raw;
  return DEFAULT_CONTRACTOR_COUNTRY;
}
