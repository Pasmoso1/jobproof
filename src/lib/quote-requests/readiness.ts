import { isOnboardingCompleteForTrial } from "@/lib/trial-lifecycle";

/**
 * Quote-request readiness reuses the onboarding-completion rule the middleware enforces
 * (`isOnboardingCompleteForTrial`: business name + primary trade). Phone and address are
 * optional here — the public quote pages omit contact details the contractor hasn't added.
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
export function isQuoteSharingReady(profile: QuoteReadinessProfile | null | undefined): boolean {
  if (!profile) return false;
  return isOnboardingCompleteForTrial(profile);
}

/** Public /quote/[slug] route: same rule as sharing (no session is available here). */
export function isPublicQuotePageReady(profile: QuoteReadinessProfile | null | undefined): boolean {
  if (!profile) return false;
  return isOnboardingCompleteForTrial(profile);
}
