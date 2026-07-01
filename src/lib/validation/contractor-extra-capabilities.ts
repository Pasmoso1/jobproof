export const CONTRACTOR_EXTRA_CAPABILITIES_MAX_LENGTH = 500;

export const CONTRACTOR_EXTRA_CAPABILITIES_LABEL = "Other services you offer";

export const CONTRACTOR_EXTRA_CAPABILITIES_HELP =
  "Optional. List any services you offer that may not be covered by your trades above. JobProof uses this as supporting context when matching quote requests.";

export const CONTRACTOR_EXTRA_CAPABILITIES_PLACEHOLDER =
  "Example: We also install fences, pergolas, concrete pads, drainage, and small retaining walls.";

export function parseContractorExtraCapabilities(raw: string): {
  value: string | null;
  error?: string;
} {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { value: null };
  }
  if (trimmed.length > CONTRACTOR_EXTRA_CAPABILITIES_MAX_LENGTH) {
    return {
      value: null,
      error: `Must be ${CONTRACTOR_EXTRA_CAPABILITIES_MAX_LENGTH} characters or less.`,
    };
  }
  return { value: trimmed };
}
