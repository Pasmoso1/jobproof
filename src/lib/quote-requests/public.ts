import { createServiceRoleClient } from "@/lib/supabase/service-role";

import { getEffectiveQuoteTrade } from "@/lib/quote-requests/trade";
import { isPublicQuotePageReady } from "@/lib/quote-requests/readiness";

export type PublicQuoteContractor = {
  id: string;
  quote_slug: string;
  business_name: string;
  phone: string;
  quote_logo_url: string | null;
  /** Effective trade label for public display (custom label when Other). */
  trade_label: string | null;
  plan_tier: string | null;
  beta_tester: boolean;
  beta_plan_tier: string | null;
  /** False until the contractor has completed the business setup required to take requests. */
  quote_ready: boolean;
};

export async function getContractorByQuoteSlug(
  slug: string
): Promise<PublicQuoteContractor | null> {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return null;

  const admin = createServiceRoleClient();
  if (!admin) return null;

  const { data } = await admin
    .from("profiles")
    .select(
      "id, quote_slug, business_name, phone, address_line_1, city, province, postal_code, quote_logo_url, quote_primary_trade, quote_primary_trade_other, plan_tier, beta_tester, beta_plan_tier"
    )
    .ilike("quote_slug", normalized)
    .maybeSingle();

  if (!data?.id || !data.quote_slug) return null;

  return {
    id: String(data.id),
    quote_slug: String(data.quote_slug),
    business_name: String(data.business_name ?? "Contractor"),
    phone: String(data.phone ?? ""),
    quote_logo_url: data.quote_logo_url ? String(data.quote_logo_url) : null,
    trade_label: getEffectiveQuoteTrade({
      quote_primary_trade: data.quote_primary_trade,
      quote_primary_trade_other: data.quote_primary_trade_other,
    }),
    plan_tier: data.plan_tier != null ? String(data.plan_tier) : null,
    beta_tester: data.beta_tester === true,
    beta_plan_tier: data.beta_plan_tier != null ? String(data.beta_plan_tier) : null,
    quote_ready: isPublicQuotePageReady(data),
  };
}
