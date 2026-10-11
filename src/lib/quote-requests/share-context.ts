import { buildPublicQuoteUrl } from "@/lib/quote-link-share";
import { isQuoteSharingReady, type QuoteReadinessProfile } from "@/lib/quote-requests/readiness";

export type QuoteRequestShareContext = {
  quoteUrl: string;
  businessName: string | null;
};

/**
 * What the Send Quote Request action needs, or null when the contractor can't share yet
 * (incomplete business profile or no quote slug). Uses the same readiness rule as the dashboard.
 */
export function resolveQuoteRequestShareContext(
  profile: (QuoteReadinessProfile & { quote_slug?: string | null }) | null | undefined,
  accountEmail: string,
  appOrigin: string
): QuoteRequestShareContext | null {
  if (!profile || !isQuoteSharingReady(profile, accountEmail)) return null;
  const quoteUrl = buildPublicQuoteUrl(appOrigin, profile.quote_slug);
  if (!quoteUrl) return null;
  return {
    quoteUrl,
    businessName: String(profile.business_name ?? "").trim() || null,
  };
}
