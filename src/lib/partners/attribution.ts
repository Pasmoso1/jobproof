import type { SupabaseClient } from "@supabase/supabase-js";
import { PRODUCT_ANALYTICS_EVENTS, trackProductEventSafe } from "@/lib/product-analytics";
import { rewardAmountForLevel, type PartnerLevel } from "@/lib/partners/constants";
import { normalizePartnerReferralCode } from "@/lib/partners/referral-code";
import { sendPartnerReferralLifecycleEmail } from "@/lib/partners/emails";

/**
 * Attach a contractor profile to a partner permanently (first referral wins).
 * Safe to call multiple times — no-ops if already attributed.
 */
export async function attributeContractorToPartnerReferral(
  admin: SupabaseClient,
  input: {
    contractorProfileId: string;
    referralCode: string | null | undefined;
    businessName?: string | null;
    source: string;
  }
): Promise<{ attributed: boolean; partnerId?: string; referralId?: string }> {
  const code = normalizePartnerReferralCode(input.referralCode);
  if (!code) return { attributed: false };

  const { data: existing } = await admin
    .from("partner_referrals")
    .select("id, partner_id")
    .eq("contractor_profile_id", input.contractorProfileId)
    .maybeSingle();
  if (existing) {
    return {
      attributed: false,
      partnerId: String(existing.partner_id),
      referralId: String(existing.id),
    };
  }

  const { data: partner } = await admin
    .from("partners")
    .select("id, contact_name, email, partner_level, status")
    .eq("referral_code", code)
    .eq("status", "active")
    .maybeSingle();

  if (!partner) return { attributed: false };

  const level = (partner.partner_level === "founding" ? "founding" : "standard") as PartnerLevel;
  const rewardAmount = rewardAmountForLevel(level);

  const { data: inserted, error } = await admin
    .from("partner_referrals")
    .insert({
      partner_id: partner.id,
      contractor_profile_id: input.contractorProfileId,
      contractor_business_name: input.businessName?.trim() || null,
      signup_date: new Date().toISOString(),
      reward_amount: rewardAmount,
      reward_status: "pending",
    })
    .select("id")
    .maybeSingle();

  if (error || !inserted) {
    console.error("[partners] attribute referral failed", error?.message);
    return { attributed: false };
  }

  await admin
    .from("profiles")
    .update({ signup_partner_referral_code: code })
    .eq("id", input.contractorProfileId)
    .is("signup_partner_referral_code", null);

  trackProductEventSafe({
    profileId: input.contractorProfileId,
    eventName: PRODUCT_ANALYTICS_EVENTS.partner_referral_signup,
    source: input.source,
    metadata: { partner_id: String(partner.id) },
  });

  void sendPartnerReferralLifecycleEmail({
    to: String(partner.email),
    contactName: String(partner.contact_name),
    kind: "signup",
    businessName: input.businessName,
  });

  return {
    attributed: true,
    partnerId: String(partner.id),
    referralId: String(inserted.id),
  };
}

/** Mark trial started on an existing referral row. */
export async function markPartnerReferralTrialStarted(
  admin: SupabaseClient,
  contractorProfileId: string
): Promise<void> {
  const { data: row } = await admin
    .from("partner_referrals")
    .select("id, partner_id, trial_started_at, contractor_business_name, partners(contact_name, email)")
    .eq("contractor_profile_id", contractorProfileId)
    .maybeSingle();
  if (!row || row.trial_started_at) return;

  await admin
    .from("partner_referrals")
    .update({
      trial_started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id);

  trackProductEventSafe({
    profileId: contractorProfileId,
    eventName: PRODUCT_ANALYTICS_EVENTS.partner_trial_started,
    source: "partner_lifecycle",
    metadata: { partner_id: String(row.partner_id) },
  });

  const partners = row.partners as
    | { contact_name?: string; email?: string }
    | { contact_name?: string; email?: string }[]
    | null;
  const p = Array.isArray(partners) ? partners[0] : partners;
  if (p?.email) {
    void sendPartnerReferralLifecycleEmail({
      to: p.email,
      contactName: p.contact_name ?? "Partner",
      kind: "trial_started",
      businessName: row.contractor_business_name,
    });
  }
}

/** Mark paid subscription started (qualification clock). */
export async function markPartnerReferralSubscriptionStarted(
  admin: SupabaseClient,
  contractorProfileId: string
): Promise<void> {
  const { data: row } = await admin
    .from("partner_referrals")
    .select(
      "id, partner_id, subscription_started_at, contractor_business_name, partners(contact_name, email)"
    )
    .eq("contractor_profile_id", contractorProfileId)
    .maybeSingle();
  if (!row) return;
  if (row.subscription_started_at) return;

  await admin
    .from("partner_referrals")
    .update({
      subscription_started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id);

  trackProductEventSafe({
    profileId: contractorProfileId,
    eventName: PRODUCT_ANALYTICS_EVENTS.partner_subscription_started,
    source: "partner_lifecycle",
    metadata: { partner_id: String(row.partner_id) },
  });

  const partners = row.partners as
    | { contact_name?: string; email?: string }
    | { contact_name?: string; email?: string }[]
    | null;
  const p = Array.isArray(partners) ? partners[0] : partners;
  if (p?.email) {
    void sendPartnerReferralLifecycleEmail({
      to: p.email,
      contactName: p.contact_name ?? "Partner",
      kind: "subscription_started",
      businessName: row.contractor_business_name,
    });
  }
}
