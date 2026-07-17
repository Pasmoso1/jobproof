import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { attributeContractorToPartnerReferral } from "@/lib/partners/attribution";
import { decodePartnerRefCookie, PARTNER_REF_COOKIE_NAME } from "@/lib/partners/partner-ref-cookie";

/** Attribute partner referral after signup confirmation (service role). */
export async function applyPartnerReferralAttributionForUser(input: {
  userId: string;
  cookieHeader?: string | null;
  partnerRefCookieValue?: string | null;
  source: string;
}): Promise<void> {
  const admin = createServiceRoleClient();
  if (!admin) return;

  let code = decodePartnerRefCookie(input.partnerRefCookieValue ?? undefined);
  if (!code && input.cookieHeader) {
    const part = input.cookieHeader
      .split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith(`${PARTNER_REF_COOKIE_NAME}=`));
    if (part) {
      code = decodePartnerRefCookie(part.slice(PARTNER_REF_COOKIE_NAME.length + 1));
    }
  }
  if (!code) {
    // Fall back to profile column if already set somehow
    const { data: profile } = await admin
      .from("profiles")
      .select("id, business_name, signup_partner_referral_code")
      .eq("user_id", input.userId)
      .maybeSingle();
    if (!profile?.signup_partner_referral_code) return;
    code = String(profile.signup_partner_referral_code);
    await attributeContractorToPartnerReferral(admin, {
      contractorProfileId: String(profile.id),
      referralCode: code,
      businessName: profile.business_name,
      source: input.source,
    });
    return;
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("id, business_name, signup_partner_referral_code")
    .eq("user_id", input.userId)
    .maybeSingle();
  if (!profile) return;

  await attributeContractorToPartnerReferral(admin, {
    contractorProfileId: String(profile.id),
    referralCode: code,
    businessName: profile.business_name,
    source: input.source,
  });
}

export async function syncPartnerReferralBusinessName(
  admin: SupabaseClient,
  profileId: string,
  businessName: string | null
): Promise<void> {
  if (!businessName?.trim()) return;
  await admin
    .from("partner_referrals")
    .update({
      contractor_business_name: businessName.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq("contractor_profile_id", profileId)
    .is("contractor_business_name", null);
}
