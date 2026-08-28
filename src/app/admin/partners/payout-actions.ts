"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { requireAdminUser } from "@/lib/admin-auth";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  buildBatchPayoutIdempotencyKey,
  sumRewardAmounts,
} from "@/lib/partners/payout-batch";
import { PARTNER_PAYMENT_METHOD_LABEL } from "@/lib/partners/payment-details";
import { verifyAndRouteQualifiedReferral } from "@/lib/partners/payout-verification-runner";
import { PRODUCT_ANALYTICS_EVENTS, trackProductEventSafe } from "@/lib/product-analytics";
import { sendPartnerReferralLifecycleEmail } from "@/lib/partners/emails";

async function requireAdminService() {
  const auth = await requireAdminUser();
  if (!auth.ok) return { ok: false as const, error: "Unauthorized" };
  const admin = createServiceRoleClient();
  if (!admin) return { ok: false as const, error: "Service role unavailable" };
  return { ok: true as const, admin, email: auth.userEmail };
}

function revalidatePayoutPaths(partnerId?: string) {
  revalidatePath("/admin/partners/payouts");
  revalidatePath("/admin/partners");
  if (partnerId) {
    revalidatePath(`/admin/partners/payouts/${partnerId}`);
  }
}

export async function adminRecordPartnerBatchPayout(input: {
  partnerId: string;
  paymentReference?: string;
  notes?: string;
  paidAt?: string;
  idempotencyKey?: string;
}) {
  const ctx = await requireAdminService();
  if (!ctx.ok) return ctx;

  const { data: readyReferrals, error: listErr } = await ctx.admin
    .from("partner_referrals")
    .select("id, reward_amount, contractor_profile_id, contractor_business_name")
    .eq("partner_id", input.partnerId)
    .eq("reward_status", "approved")
    .is("payout_id", null);

  if (listErr) return { ok: false as const, error: listErr.message };
  if (!readyReferrals?.length) {
    return { ok: false as const, error: "No rewards ready for payment" };
  }

  const referralIds = readyReferrals.map((r) => String(r.id));
  const expectedTotal = sumRewardAmounts(readyReferrals);
  const idempotencyKey =
    input.idempotencyKey?.trim() ||
    buildBatchPayoutIdempotencyKey(input.partnerId, referralIds);

  const paidAt = input.paidAt?.trim() || new Date().toISOString();

  const { data, error } = await ctx.admin.rpc("record_partner_batch_payout", {
    p_partner_id: input.partnerId,
    p_payment_method: PARTNER_PAYMENT_METHOD_LABEL,
    p_payment_reference: input.paymentReference?.trim() || null,
    p_notes: input.notes?.trim() || null,
    p_paid_at: paidAt,
    p_created_by: ctx.email,
    p_idempotency_key: idempotencyKey,
  });

  if (error) {
    return { ok: false as const, error: error.message };
  }

  const result = data as {
    ok?: boolean;
    error?: string;
    payout_id?: string;
    amount?: number;
    referral_count?: number;
    idempotent?: boolean;
    payment_email?: string;
  };

  if (!result?.ok) {
    return { ok: false as const, error: result?.error ?? "Payout failed" };
  }

  const amount = Number(result.amount ?? expectedTotal);
  const referralCount = Number(result.referral_count ?? readyReferrals.length);

  for (const referral of readyReferrals) {
    trackProductEventSafe({
      profileId: String(referral.contractor_profile_id),
      eventName: PRODUCT_ANALYTICS_EVENTS.partner_reward_paid,
      source: "admin_partner_payouts",
      metadata: {
        partner_id: input.partnerId,
        amount: Number(referral.reward_amount),
        payout_id: result.payout_id,
        batch: true,
      },
    });
  }

  const { data: partner } = await ctx.admin
    .from("partners")
    .select("contact_name, email")
    .eq("id", input.partnerId)
    .maybeSingle();

  if (partner?.email) {
    void sendPartnerReferralLifecycleEmail({
      to: partner.email,
      contactName: partner.contact_name ?? "Partner",
      kind: "reward_paid",
      amountCad: amount,
      paymentDate: paidAt,
      paymentReference: input.paymentReference?.trim() || null,
      batchReferralCount: referralCount,
    });
  }

  revalidatePayoutPaths(input.partnerId);
  return {
    ok: true as const,
    payoutId: String(result.payout_id),
    amount,
    referralCount,
    idempotent: Boolean(result.idempotent),
  };
}

export async function adminReleaseReferralForPayment(referralId: string) {
  const ctx = await requireAdminService();
  if (!ctx.ok) return ctx;

  const { data: row } = await ctx.admin
    .from("partner_referrals")
    .select("id, reward_status, payout_id")
    .eq("id", referralId)
    .maybeSingle();

  if (!row) return { ok: false as const, error: "Not found" };
  if (row.payout_id) {
    return { ok: false as const, error: "Referral is already linked to a payout" };
  }
  if (!["qualified", "needs_review"].includes(String(row.reward_status))) {
    return {
      ok: false as const,
      error: "Only qualified or needs-review rewards can be released for payment",
    };
  }

  const result = await verifyAndRouteQualifiedReferral(ctx.admin, referralId);
  if (!result.ok) return { ok: false as const, error: result.error ?? "Verification failed" };

  if (result.status !== "approved") {
    return {
      ok: false as const,
      error: "Verification did not pass — resolve review items first or override via invalidate",
      status: result.status,
    };
  }

  revalidatePayoutPaths();
  return { ok: true as const, status: "approved" as const };
}

export async function adminForceReleaseReferralForPayment(referralId: string) {
  const ctx = await requireAdminService();
  if (!ctx.ok) return ctx;

  const { data: row } = await ctx.admin
    .from("partner_referrals")
    .select("id, reward_status, payout_id")
    .eq("id", referralId)
    .maybeSingle();

  if (!row) return { ok: false as const, error: "Not found" };
  if (row.payout_id) {
    return { ok: false as const, error: "Referral is already linked to a payout" };
  }
  if (!["qualified", "needs_review"].includes(String(row.reward_status))) {
    return { ok: false as const, error: "Reward is not eligible for release" };
  }

  await ctx.admin
    .from("partner_referrals")
    .update({
      reward_status: "approved",
      verification_notes: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", referralId)
    .in("reward_status", ["qualified", "needs_review"]);

  revalidatePayoutPaths();
  return { ok: true as const };
}

export async function adminInvalidateReferralReward(
  referralId: string,
  reason: string,
  outcome: "cancelled" | "forfeited" = "forfeited"
) {
  const ctx = await requireAdminService();
  if (!ctx.ok) return ctx;

  const trimmedReason = String(reason ?? "").trim();
  if (!trimmedReason) {
    return { ok: false as const, error: "Enter a reason for invalidation." };
  }

  const { data: row } = await ctx.admin
    .from("partner_referrals")
    .select("id, reward_status, payout_id")
    .eq("id", referralId)
    .maybeSingle();

  if (!row) return { ok: false as const, error: "Not found" };
  if (row.reward_status === "paid" || row.payout_id) {
    return { ok: false as const, error: "Paid referrals cannot be invalidated" };
  }
  if (["cancelled", "forfeited"].includes(String(row.reward_status))) {
    return { ok: false as const, error: "Referral is already invalidated" };
  }

  const now = new Date().toISOString();
  const { error } = await ctx.admin
    .from("partner_referrals")
    .update({
      reward_status: outcome,
      invalidated_at: now,
      invalidated_reason: trimmedReason,
      invalidated_by: ctx.email,
      verification_notes: trimmedReason,
      updated_at: now,
    })
    .eq("id", referralId);

  if (error) return { ok: false as const, error: error.message };

  revalidatePayoutPaths();
  return { ok: true as const, status: outcome };
}

export async function adminReverifyReferral(referralId: string) {
  const ctx = await requireAdminService();
  if (!ctx.ok) return ctx;

  const result = await verifyAndRouteQualifiedReferral(ctx.admin, referralId);
  if (!result.ok) return { ok: false as const, error: result.error ?? "Failed" };

  revalidatePayoutPaths();
  return { ok: true as const, status: result.status };
}

export async function adminGenerateBatchPayoutIdempotencyKey(partnerId: string) {
  const ctx = await requireAdminService();
  if (!ctx.ok) return ctx;

  const { data: readyReferrals } = await ctx.admin
    .from("partner_referrals")
    .select("id")
    .eq("partner_id", partnerId)
    .eq("reward_status", "approved")
    .is("payout_id", null);

  const referralIds = (readyReferrals ?? []).map((r) => String(r.id));
  return {
    ok: true as const,
    key: buildBatchPayoutIdempotencyKey(partnerId, referralIds),
    clientNonce: randomUUID(),
  };
}
