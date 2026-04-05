/**
 * Primary contractor email for invoices: profile first, then signed-in auth email.
 * Public (token) pages use only the profile column — no session.
 */
export function resolveContractorContactEmail(
  profile: { business_contact_email?: string | null },
  authUserEmail: string | null | undefined
): string | null {
  const fromProfile = profile.business_contact_email?.trim();
  if (fromProfile) return fromProfile;
  const fromAuth = authUserEmail?.trim();
  return fromAuth || null;
}
