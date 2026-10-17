"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { requireAdminService } from "@/lib/admin-service";
import {
  ADMIN_AUDIT_ACTIONS,
  auditWarning,
  buildAuditIdempotencyKey,
  recordAdminAudit,
  type RecordAdminAuditResult,
} from "@/lib/admin-audit-log";
import {
  buildBatchPayoutIdempotencyKey,
  sumRewardAmounts,
} from "@/lib/partners/payout-batch";
import { PARTNER_PAYMENT_METHOD_LABEL } from "@/lib/partners/payment-details";
import { verifyAndRouteQualifiedReferral } from "@/lib/partners/payout-verification-runner";
import { PRODUCT_ANALYTICS_EVENTS, trackProductEventSafe } from "@/lib/product-analytics";
import { sendPartnerReferralLifecycleEmail } from "@/lib/partners/emails";


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
    // A retry after a successful (or lost-response) payout finds nothing left to pay. If the
    // same idempotency key already produced a payout for this partner, report that payout
    // instead of a misleading "nothing ready" error. Read-only: no side effects repeated.
    const replayKey = input.idempotencyKey?.trim();
    if (replayKey) {
      const { data: prior } = await ctx.admin
        .from("partner_payouts")
        .select("id, amount, referral_count")
        .eq("idempotency_key", replayKey)
        .eq("partner_id", input.partnerId)
        .maybeSingle();
      if (prior) {
        return {
          ok: true as const,
          payoutId: String(prior.id),
          amount: Number(prior.amount),
          referralCount: Number(prior.referral_count ?? 0),
          idempotent: true,
        };
      }
    }
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

  const payoutId = String(result.payout_id);

  // Replay of an already-recorded payout (same idempotency key): report the ORIGINAL payout and
  // do not repeat side effects. Previously this path re-sent the "reward paid" email and
  // analytics using the CURRENT ready set, which could describe referrals that were not in the
  // replayed payout.
  if (result.idempotent) {
    const { data: original } = await ctx.admin
      .from("partner_payouts")
      .select("amount, referral_count")
      .eq("id", payoutId)
      .maybeSingle();
    revalidatePayoutPaths(input.partnerId);
    return {
      ok: true as const,
      payoutId,
      amount: Number(original?.amount ?? 0),
      referralCount: Number(original?.referral_count ?? 0),
      idempotent: true,
    };
  }

  const amount = Number(result.amount ?? expectedTotal);
  const referralCount = Number(result.referral_count ?? readyReferrals.length);

  // Keyed by payout id so a retry never writes a second record. The payout row itself already
  // stores created_by (the admin) and is written atomically by the RPC; this audit row is a
  // separate request (see admin-audit-log.ts), so a failure is surfaced via `auditWarning`.
  const audit = await recordAdminAudit(ctx.admin, {
    adminEmail: ctx.email,
    action: ADMIN_AUDIT_ACTIONS.partnerBatchPayoutRecorded,
    targetType: "partner_payout",
    targetId: payoutId,
    metadata: {
      partner_id: input.partnerId,
      amount_cad: amount,
      referral_count: referralCount,
      has_payment_reference: Boolean(input.paymentReference?.trim()),
    },
    idempotencyKey: buildAuditIdempotencyKey(
      ADMIN_AUDIT_ACTIONS.partnerBatchPayoutRecorded,
      payoutId
    ),
  });

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
    payoutId,
    amount,
    referralCount,
    idempotent: false,
    ...auditWarning(audit),
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

  const releaseAudit = await recordAdminAudit(ctx.admin, {
    adminEmail: ctx.email,
    action: ADMIN_AUDIT_ACTIONS.referralReleasedForPayment,
    targetType: "partner_referral",
    targetId: referralId,
    metadata: { from_status: String(row.reward_status), to_status: "approved" },
    idempotencyKey: buildAuditIdempotencyKey(
      ADMIN_AUDIT_ACTIONS.referralReleasedForPayment,
      referralId
    ),
  });

  revalidatePayoutPaths();
  return { ok: true as const, status: "approved" as const, ...auditWarning(releaseAudit) };
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

  const { data: released, error: releaseError } = await ctx.admin
    .from("partner_referrals")
    .update({
      reward_status: "approved",
      verification_notes: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", referralId)
    .in("reward_status", ["qualified", "needs_review"])
    .select("id");
  if (releaseError) return { ok: false as const, error: releaseError.message };

  // Audit only when a row actually changed, so a double-click / retry is not logged twice.
  let forceAudit: RecordAdminAuditResult | null = null;
  if (released && released.length > 0) {
    forceAudit = await recordAdminAudit(ctx.admin, {
      adminEmail: ctx.email,
      action: ADMIN_AUDIT_ACTIONS.referralForceReleased,
      targetType: "partner_referral",
      targetId: referralId,
      metadata: {
        from_status: String(row.reward_status),
        to_status: "approved",
        verification_bypassed: true,
      },
      idempotencyKey: buildAuditIdempotencyKey(
        ADMIN_AUDIT_ACTIONS.referralForceReleased,
        referralId,
        String(row.reward_status)
      ),
    });
  }

  revalidatePayoutPaths();
  return { ok: true as const, ...auditWarning(forceAudit) };
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

  const invalidateAudit = await recordAdminAudit(ctx.admin, {
    adminEmail: ctx.email,
    action: ADMIN_AUDIT_ACTIONS.referralInvalidated,
    targetType: "partner_referral",
    targetId: referralId,
    // The free-text reason is stored on the referral (invalidated_reason), not copied here.
    metadata: { from_status: String(row.reward_status), to_status: outcome },
    idempotencyKey: buildAuditIdempotencyKey(
      ADMIN_AUDIT_ACTIONS.referralInvalidated,
      referralId
    ),
  });

  revalidatePayoutPaths();
  return { ok: true as const, status: outcome, ...auditWarning(invalidateAudit) };
}

export async function adminReverifyReferral(referralId: string) {
  const ctx = await requireAdminService();
  if (!ctx.ok) return ctx;

  const { data: before } = await ctx.admin
    .from("partner_referrals")
    .select("reward_status")
    .eq("id", referralId)
    .maybeSingle();

  const result = await verifyAndRouteQualifiedReferral(ctx.admin, referralId);
  if (!result.ok) return { ok: false as const, error: result.error ?? "Failed" };

  // Only log when verification actually moved the referral to a different status.
  let reverifyAudit: RecordAdminAuditResult | null = null;
  if (before && String(before.reward_status) !== String(result.status)) {
    reverifyAudit = await recordAdminAudit(ctx.admin, {
      adminEmail: ctx.email,
      action: ADMIN_AUDIT_ACTIONS.referralReverified,
      targetType: "partner_referral",
      targetId: referralId,
      metadata: {
        from_status: String(before.reward_status),
        to_status: String(result.status),
      },
    });
  }

  revalidatePayoutPaths();
  return { ok: true as const, status: result.status, ...auditWarning(reverifyAudit) };
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
