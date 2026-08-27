/**
 * Shared Partner Program login destinations (safe internal `next` only).
 */

/** After Partner Program "Sign in", resolve portal vs status vs apply in app code. */
export const PARTNER_PROGRAM_LOGIN_NEXT = "/partner";

export const PARTNER_PROGRAM_LOGIN_HREF = `/login?next=${encodeURIComponent(
  PARTNER_PROGRAM_LOGIN_NEXT
)}`;

/**
 * Map Partner account state to the correct entry path after Partner sign-in
 * or direct `/partner` access.
 */
export function resolvePartnerEntryPath(input: {
  kind: "active" | "partner_inactive" | "application" | "none";
  emailVerified?: boolean;
}): string {
  if (input.kind === "active" && input.emailVerified) {
    return "/partner";
  }
  if (input.kind === "none") {
    return "/partners/apply";
  }
  // Pending / declined applications, inactive partners, unverified approved.
  return "/partner/status";
}
