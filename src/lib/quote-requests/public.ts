import { createServiceRoleClient } from "@/lib/supabase/service-role";

export type PublicQuoteContractor = {
  id: string;
  quote_slug: string;
  business_name: string;
  phone: string;
  quote_logo_url: string | null;
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
    .select("id, quote_slug, business_name, phone, quote_logo_url")
    .ilike("quote_slug", normalized)
    .maybeSingle();

  if (!data?.id || !data.quote_slug) return null;

  return {
    id: String(data.id),
    quote_slug: String(data.quote_slug),
    business_name: String(data.business_name ?? "Contractor"),
    phone: String(data.phone ?? ""),
    quote_logo_url: data.quote_logo_url ? String(data.quote_logo_url) : null,
  };
}
