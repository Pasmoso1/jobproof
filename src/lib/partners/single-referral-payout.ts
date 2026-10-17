import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Manual single-referral payout (`adminMarkReferralPaid`).
 *
 * The grouped payout (`record_partner_batch_payout` RPC) is atomic. This single-referral
 * path cannot use it (the RPC always pays EVERY approved referral for a partner) and no RPC
 * exists for one referral, so it is made safe with three guards instead of a transaction:
 *
 * 1. Idempotent payout row: `partner_payouts.idempotency_key = single_referral:<id>` (unique
 *    index from migration 067). A retry or double-click re-uses the existing row instead of
 *    creating a second payout.
 * 2. Conditional link: the referral is only updated while it is still payable and unlinked
 *    (`payout_id IS NULL` AND status = 'approved'), and the update must change exactly one row.
 * 3. Compensation: if linking fails, the payout row THIS call created is deleted when nothing
 *    references it, so no orphan payout (a recorded payment with an unpaid referral that a
 *    later batch payout could pay a second time) is left behind. If compensation itself fails
 *    the orphan is reported loudly and is picked up (not duplicated) by the next retry via (1).
 *
 * ELIGIBILITY (same as the grouped payout): a referral is payable only when its authoritative
 * database state is `reward_status = 'approved' AND payout_id IS NULL` -- exactly the predicate
 * `record_partner_batch_payout` locks and pays. `approved` is only ever reached after the 90-day
 * qualification and automated verification (payout-verification-runner) or an explicit admin
 * release, so pending / qualified / needs_review / cancelled / forfeited / paid referrals are all
 * refused here. The rule is evaluated on a fresh read immediately before the payout is created,
 * and enforced again atomically inside the conditional link update.
 *
 * Reward amounts and qualification logic are untouched: the stored `reward_amount` is paid as-is,
 * exactly as the grouped payout does.
 */

/** The only status a referral may be paid from (identical to the grouped payout RPC). */
export const PAYABLE_REFERRAL_STATUS = "approved";

/**
 * Why a referral cannot be paid right now, or `null` when it is eligible.
 * Pure so the exact same rule is used for the pre-check and for post-failure diagnosis.
 */
export function singleReferralPayoutBlocker(row: {
  reward_status?: unknown;
  payout_id?: unknown;
}): string | null {
  const status = String(row.reward_status ?? "");
  if (status === "paid") return "Already paid";
  if (row.payout_id) {
    return "Referral is already linked to a payout; resolve this manually before paying again.";
  }
  switch (status) {
    case PAYABLE_REFERRAL_STATUS:
      return null;
    case "pending":
      return "Referral has not completed the 90-day qualification period and cannot be paid.";
    case "qualified":
    case "needs_review":
      return "Referral has not been verified and released for payment yet. Release it for payment first.";
    case "cancelled":
      return "Referral is cancelled and cannot be paid.";
    case "forfeited":
      return "Referral is forfeited and cannot be paid.";
    default:
      return `Referral status "${status || "unknown"}" is not payable.`;
  }
}

export const SINGLE_PAYOUT_KEY_PREFIX = "single_referral:";

export function singleReferralPayoutKey(referralId: string): string {
  return `${SINGLE_PAYOUT_KEY_PREFIX}${referralId}`;
}

export type SingleReferralPayoutInput = {
  referralId: string;
  paymentMethod?: string;
  paymentReference?: string;
  notes?: string;
  /** Administrator email, stored on the payout so it is self-attributing without the audit log. */
  createdBy: string;
  paidAt?: string;
};

export type SingleReferralPayoutResult =
  | {
      ok: true;
      payoutId: string;
      amount: number;
      paidAt: string;
      partnerId: string;
      contractorProfileId: string;
      contractorBusinessName: string | null;
      partner: { contact_name?: string; email?: string } | null;
      /** True when an earlier (interrupted) attempt had already created the payout row. */
      resumed: boolean;
    }
  | { ok: false; error: string };

type PartnerJoin = { contact_name?: string; email?: string };

function firstPartner(value: unknown): PartnerJoin | null {
  const p = Array.isArray(value) ? value[0] : value;
  return p && typeof p === "object" ? (p as PartnerJoin) : null;
}

export async function recordSingleReferralPayout(
  admin: Pick<SupabaseClient, "from">,
  input: SingleReferralPayoutInput
): Promise<SingleReferralPayoutResult> {
  const { data: row } = await admin
    .from("partner_referrals")
    .select(
      "id, partner_id, reward_status, reward_amount, payout_id, contractor_profile_id, contractor_business_name, partners(contact_name, email)"
    )
    .eq("id", input.referralId)
    .maybeSingle();

  if (!row) return { ok: false, error: "Not found" };

  const blocker = singleReferralPayoutBlocker(row);
  if (blocker) {
    // An interrupted earlier attempt may have left an unlinked payout for a referral that has
    // since become ineligible. Never silently ignore it: make it visible for reconciliation.
    if (row.reward_status !== "paid") {
      const stale = await admin
        .from("partner_payouts")
        .select("id")
        .eq("idempotency_key", singleReferralPayoutKey(input.referralId))
        .maybeSingle();
      if (stale.data) {
        console.error("[partner-payout] ORPHAN payout exists for ineligible referral", {
          payoutId: String(stale.data.id),
          referralId: input.referralId,
          referralStatus: String(row.reward_status),
        });
      }
    }
    return { ok: false, error: blocker };
  }

  const amount = Number(row.reward_amount);
  const partnerId = String(row.partner_id);
  const idempotencyKey = singleReferralPayoutKey(input.referralId);
  const paidAt = input.paidAt?.trim() || new Date().toISOString();

  // Resume: a previous attempt may have created the payout but failed before linking.
  let payoutId: string | null = null;
  let createdHere = false;
  const findExisting = async () => {
    const { data } = await admin
      .from("partner_payouts")
      .select("id, partner_id, amount")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    return data;
  };

  const existing = await findExisting();
  if (existing) {
    if (String(existing.partner_id) !== partnerId || Number(existing.amount) !== amount) {
      return {
        ok: false,
        error: "An earlier payout for this referral exists with different details; resolve manually.",
      };
    }
    payoutId = String(existing.id);
  } else {
    const { data: inserted, error: insertError } = await admin
      .from("partner_payouts")
      .insert({
        partner_id: partnerId,
        amount,
        payment_method: input.paymentMethod?.trim() || "e-transfer",
        payment_reference: input.paymentReference?.trim() || null,
        notes: input.notes?.trim() || null,
        paid_at: paidAt,
        created_by: input.createdBy.trim() || null,
        referral_count: 1,
        idempotency_key: idempotencyKey,
      })
      .select("id")
      .single();

    if (inserted?.id) {
      payoutId = String(inserted.id);
      createdHere = true;
    } else if (insertError?.code === "23505") {
      // Concurrent identical request created it first; join it.
      const raced = await findExisting();
      if (raced) payoutId = String(raced.id);
    }
    if (!payoutId) {
      return { ok: false, error: insertError?.message ?? "Payout insert failed" };
    }
  }

  const { data: linked, error: linkError } = await admin
    .from("partner_referrals")
    .update({
      reward_status: "paid",
      reward_paid_at: paidAt,
      payout_id: payoutId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.referralId)
    .is("payout_id", null)
    .eq("reward_status", PAYABLE_REFERRAL_STATUS)
    .select("id");

  if (linkError || !linked || linked.length !== 1) {
    // Roll back our own payout row, but only if nothing points at it (a concurrent identical
    // request may have linked the referral to this very row).
    if (createdHere) {
      const { data: refs } = await admin
        .from("partner_referrals")
        .select("id")
        .eq("payout_id", payoutId)
        .limit(1);
      if (!refs || refs.length === 0) {
        const { error: deleteError } = await admin
          .from("partner_payouts")
          .delete()
          .eq("id", payoutId);
        if (deleteError) {
          console.error("[partner-payout] ORPHAN payout could not be removed", {
            payoutId,
            referralId: input.referralId,
            code: deleteError.code ?? null,
          });
        }
      }
    }
    if (linkError) return { ok: false, error: linkError.message };
    // Zero rows: the referral changed state after our read (paid by a concurrent request, or
    // cancelled / invalidated). Re-read so the administrator gets the accurate reason.
    const { data: current } = await admin
      .from("partner_referrals")
      .select("reward_status, payout_id")
      .eq("id", input.referralId)
      .maybeSingle();
    return {
      ok: false,
      error:
        (current ? singleReferralPayoutBlocker(current) : null) ??
        "The referral could not be linked to the payout. Nothing was recorded.",
    };
  }

  return {
    ok: true,
    payoutId,
    amount,
    paidAt,
    partnerId,
    contractorProfileId: String(row.contractor_profile_id),
    contractorBusinessName: row.contractor_business_name ?? null,
    partner: firstPartner(row.partners),
    resumed: !createdHere,
  };
}
