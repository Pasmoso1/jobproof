import { isOnboardingCompleteForTrial } from "@/lib/trial-lifecycle";
import { validateBusinessProfileFields } from "@/lib/validation/business-profile";

/**
 * Quote-request readiness reuses the onboarding-completion rule the middleware enforces
 * (`isOnboardingCompleteForTrial`: complete business profile + primary trade).
 */

export type QuoteReadinessProfile = {
  business_name?: string | null;
  phone?: string | null;
  address_line_1?: string | null;
  city?: string | null;
  province?: string | null;
  postal_code?: string | null;
  quote_primary_trade?: string | null;
};

/** Signed-in contractor: may they share their quote-request link with customers? */
export function isQuoteSharingReady(
  profile: QuoteReadinessProfile | null | undefined,
  accountEmail: string
): boolean {
  if (!profile) return false;
  return isOnboardingCompleteForTrial(profile, accountEmail);
}

/**
 * Public /quote/[slug] route. There is no session (and profiles store no account email), so this
 * applies the business-profile and primary-trade requirements of the same rule.
 */
export function isPublicQuotePageReady(profile: QuoteReadinessProfile | null | undefined): boolean {
  if (!profile) return false;
  const errors = validateBusinessProfileFields({
    business_name: profile.business_name ?? "",
    phone: profile.phone ?? "",
    address_line_1: profile.address_line_1 ?? "",
    city: profile.city ?? "",
    province: profile.province ?? "",
    postal_code: profile.postal_code ?? "",
  });
  delete errors.account_email;
  if (Object.keys(errors).length > 0) return false;
  return Boolean(String(profile.quote_primary_trade ?? "").trim());
}
