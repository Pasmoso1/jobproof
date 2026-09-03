import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  recordPartnerAttributionFailure,
  resolvePartnerAttributionFailure,
} from "@/lib/partners/attribution-failures";
import { attributeContractorToPartnerReferral } from "@/lib/partners/attribution";
import { decodePartnerRefCookie, PARTNER_REF_COOKIE_NAME } from "@/lib/partners/partner-ref-cookie";

type AttributionProfileRow = {
  id: string;
  business_name: string | null;
  signup_partner_referral_code: string | null;
};

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/** Attribute partner referral after signup confirmation (service role). */
export async function applyPartnerReferralAttributionForUser(input: {
  userId: string;
  userEmail?: string | null;
  cookieHeader?: string | null;
  partnerRefCookieValue?: string | null;
  source: string;
}): Promise<void> {
  const admin = createServiceRoleClient();
  if (!admin) {
    await recordPartnerAttributionFailure({
      userId: input.userId,
      userEmail: input.userEmail,
      referralCode: decodePartnerRefCookie(input.partnerRefCookieValue ?? undefined),
      source: input.source,
      stage: "service_role_missing",
      errorMessage: "SUPABASE_SERVICE_ROLE_KEY is unavailable for attribution.",
    });
    return;
  }

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
    const { data } = await admin
      .from("profiles")
      .select("id, business_name, signup_partner_referral_code")
      .eq("user_id", input.userId)
      .maybeSingle();
    const profile = (data ?? null) as AttributionProfileRow | null;
    if (!profile?.signup_partner_referral_code) return;
    code = String(profile.signup_partner_referral_code);
    const result = await attributeContractorToPartnerReferral(admin, {
      contractorProfileId: String(profile.id),
      referralCode: code,
      businessName: profile.business_name,
      source: input.source,
    });
    if (result.attributed || result.referralId) {
      await resolvePartnerAttributionFailure({
        userId: input.userId,
        referralCode: code,
      });
    }
    return;
  }

  let profile: AttributionProfileRow | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data } = await admin
      .from("profiles")
      .select("id, business_name, signup_partner_referral_code")
      .eq("user_id", input.userId)
      .maybeSingle();
    profile = (data ?? null) as AttributionProfileRow | null;
    if (profile) break;
    if (attempt < 2) await wait(250 * (attempt + 1));
  }
  if (!profile) {
    await recordPartnerAttributionFailure({
      userId: input.userId,
      userEmail: input.userEmail,
      referralCode: code,
      source: input.source,
      stage: "missing_profile",
      errorMessage: "Profile row was not available during attribution retry window.",
    });
    return;
  }

  const result = await attributeContractorToPartnerReferral(admin, {
    contractorProfileId: String(profile.id),
    referralCode: code,
    businessName: profile.business_name,
    source: input.source,
  });
  if (result.attributed || result.referralId) {
    await resolvePartnerAttributionFailure({
      userId: input.userId,
      referralCode: code,
    });
    return;
  }

  await recordPartnerAttributionFailure({
    userId: input.userId,
    userEmail: input.userEmail,
    profileId: String(profile.id),
    referralCode: code,
    source: input.source,
    stage: "attribution_noop",
    errorMessage:
      "Attribution completed without creating a referral row. Check partner status, referral code validity, or existing first-touch attribution.",
    context: {
      existingReferralId: result.referralId ?? null,
      partnerId: result.partnerId ?? null,
    },
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
