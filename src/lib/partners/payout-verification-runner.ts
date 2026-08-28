/** Run post-qualification verification and route referrals to approved or needs_review. */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  formatVerificationNotes,
  targetStatusAfterVerification,
  verifyReferralForPayout,
} from "@/lib/partners/payout-verification";

type ReferralRow = {
  id: string;
  partner_id: string;
  contractor_profile_id: string;
  reward_status: string;
  reward_amount: number;
  qualification_date: string | null;
  subscription_started_at: string | null;
  payout_id: string | null;
  partners: {
    payment_email: string | null;
    email: string;
    profile_id: string | null;
    auth_user_id: string | null;
    partner_level: string;
    partner_type: string;
    status: string;
  } | {
    payment_email: string | null;
    email: string;
    profile_id: string | null;
    auth_user_id: string | null;
    partner_level: string;
    partner_type: string;
    status: string;
  }[] | null;
  profiles: {
    subscription_status: string | null;
    user_id: string | null;
  } | {
    subscription_status: string | null;
    user_id: string | null;
  }[] | null;
};

function unwrap<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export async function verifyAndRouteQualifiedReferral(
  admin: SupabaseClient,
  referralId: string,
  now: Date = new Date()
): Promise<{ ok: boolean; status?: string; error?: string }> {
  const { data: row, error } = await admin
    .from("partner_referrals")
    .select(
      `
      id,
      partner_id,
      contractor_profile_id,
      reward_status,
      reward_amount,
      qualification_date,
      subscription_started_at,
      payout_id,
      partners (
        payment_email,
        email,
        profile_id,
        auth_user_id,
        partner_level,
        partner_type,
        status
      ),
      profiles:contractor_profile_id (
        subscription_status,
        user_id
      )
    `
    )
    .eq("id", referralId)
    .maybeSingle();

  if (error || !row) {
    return { ok: false, error: error?.message ?? "Referral not found" };
  }

  const referral = row as ReferralRow;
  if (!["qualified", "needs_review"].includes(referral.reward_status)) {
    return { ok: false, error: "Referral is not eligible for verification routing" };
  }

  const partner = unwrap(referral.partners);
  const contractor = unwrap(referral.profiles);
  if (!partner) return { ok: false, error: "Partner not found" };

  const result = verifyReferralForPayout(
    {
      reward_status: referral.reward_status,
      reward_amount: Number(referral.reward_amount),
      qualification_date: referral.qualification_date,
      subscription_started_at: referral.subscription_started_at,
      payout_id: referral.payout_id,
      contractor_profile_id: referral.contractor_profile_id,
    },
    {
      payment_email: partner.payment_email,
      email: partner.email,
      profile_id: partner.profile_id,
      auth_user_id: partner.auth_user_id,
      partner_level: partner.partner_level,
      partner_type: partner.partner_type,
      status: partner.status,
    },
    {
      subscription_status: contractor?.subscription_status ?? null,
      user_id: contractor?.user_id ?? null,
    },
    now
  );

  const nextStatus = targetStatusAfterVerification(result);
  const { error: updErr } = await admin
    .from("partner_referrals")
    .update({
      reward_status: nextStatus,
      verification_notes: result.reasons.length
        ? formatVerificationNotes(result.reasons)
        : null,
      updated_at: now.toISOString(),
    })
    .eq("id", referralId)
    .in("reward_status", ["qualified", "needs_review"]);

  if (updErr) return { ok: false, error: updErr.message };
  return { ok: true, status: nextStatus };
}

/** Process qualified referrals awaiting automated verification. */
export async function verifyQualifiedPartnerReferrals(
  admin: SupabaseClient,
  limit = 200
): Promise<{ inspected: number; approved: number; needsReview: number }> {
  const { data: rows, error } = await admin
    .from("partner_referrals")
    .select("id")
    .in("reward_status", ["qualified", "needs_review"])
    .is("payout_id", null)
    .limit(limit);

  if (error) {
    console.error("[partners] verify query failed", error.message);
    return { inspected: 0, approved: 0, needsReview: 0 };
  }

  let approved = 0;
  let needsReview = 0;
  for (const row of rows ?? []) {
    const result = await verifyAndRouteQualifiedReferral(admin, String(row.id));
    if (!result.ok) continue;
    if (result.status === "approved") approved += 1;
    if (result.status === "needs_review") needsReview += 1;
  }

  return { inspected: rows?.length ?? 0, approved, needsReview };
}

/** Re-run verification for a partner after payment email is updated. */
export async function reverifyPartnerReferralsAfterPaymentEmailUpdate(
  admin: SupabaseClient,
  partnerId: string
): Promise<void> {
  const { data: rows } = await admin
    .from("partner_referrals")
    .select("id")
    .eq("partner_id", partnerId)
    .in("reward_status", ["qualified", "needs_review"])
    .is("payout_id", null);

  for (const row of rows ?? []) {
    await verifyAndRouteQualifiedReferral(admin, String(row.id));
  }
}
