"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import {
  adminGenerateBatchPayoutIdempotencyKey,
  adminRecordPartnerBatchPayout,
} from "../../payout-actions";
import { partnerAdminStatusBadge } from "../payout-dashboard-client";
import type { PartnerRewardStatus } from "@/lib/partners/constants";
import {
  PARTNER_PAYMENT_METHOD_LABEL,
  hasPartnerPaymentEmail,
} from "@/lib/partners/payment-details";
import { formatAdminDate } from "@/lib/partners/admin-application-review";

export type PartnerPayoutReferralRow = {
  id: string;
  contractorName: string | null;
  signupDate: string;
  subscriptionStartedAt: string | null;
  qualificationDate: string | null;
  rewardAmount: number;
  rewardStatus: PartnerRewardStatus;
  verificationNotes: string | null;
};

export function PartnerPayoutDetailClient({
  partnerId,
  organizationName,
  contactName,
  paymentEmail,
  referrals,
  totalAmountCad,
}: {
  partnerId: string;
  organizationName: string;
  contactName: string;
  paymentEmail: string | null;
  referrals: PartnerPayoutReferralRow[];
  totalAmountCad: number;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [paymentReference, setPaymentReference] = useState("");
  const [notes, setNotes] = useState("");
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const canPay =
    referrals.length > 0 && hasPartnerPaymentEmail(paymentEmail) && totalAmountCad > 0;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (confirmOpen && !dialog.open) dialog.showModal();
    if (!confirmOpen && dialog.open) dialog.close();
  }, [confirmOpen]);

  async function openConfirm() {
    setError(null);
    setMessage(null);
    const keyResult = await adminGenerateBatchPayoutIdempotencyKey(partnerId);
    if (keyResult.ok) {
      setIdempotencyKey(`${keyResult.key}:${keyResult.clientNonce}`);
    }
    setConfirmOpen(true);
  }

  function recordPayment() {
    if (!idempotencyKey) return;
    setError(null);
    startTransition(async () => {
      const paidAtIso = paidAt ? new Date(paidAt).toISOString() : new Date().toISOString();
      const result = await adminRecordPartnerBatchPayout({
        partnerId,
        paymentReference,
        notes,
        paidAt: paidAtIso,
        idempotencyKey,
      });
      if (!result.ok) {
        setError(result.error ?? "Payment recording failed");
        return;
      }
      setConfirmOpen(false);
      setMessage(
        result.idempotent
          ? "Payment was already recorded (duplicate request ignored)."
          : `Recorded $${result.amount.toFixed(0)} CAD payment for ${result.referralCount} referrals.`
      );
      router.refresh();
      router.push("/admin/partners/payouts");
    });
  }

  return (
    <div className="space-y-8">
      {(message || error) && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            error
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-green-200 bg-green-50 text-green-800"
          }`}
        >
          {error ?? message}
        </div>
      )}

      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h1 className="text-xl font-bold text-zinc-900">{organizationName}</h1>
        <p className="mt-1 text-sm text-zinc-600">{contactName}</p>
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-zinc-500">Payment email</dt>
            <dd className="font-medium text-zinc-900">
              {hasPartnerPaymentEmail(paymentEmail) ? (
                paymentEmail
              ) : (
                <span className="text-amber-800">Payment email required</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Ready rewards</dt>
            <dd className="font-medium text-zinc-900">{referrals.length}</dd>
          </div>
        </dl>
        <p className="mt-4 text-2xl font-bold text-zinc-900">
          Total: ${totalAmountCad.toFixed(0)} CAD
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-zinc-900">Referrals in this payout</h2>
        <div className="hidden overflow-x-auto rounded-xl border border-zinc-200 bg-white md:block">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-3 py-2">Contractor</th>
                <th className="px-3 py-2">Signup</th>
                <th className="px-3 py-2">Subscribed</th>
                <th className="px-3 py-2">Qualified</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {referrals.map((r) => (
                <tr key={r.id} className="border-b border-zinc-100">
                  <td className="px-3 py-3">{r.contractorName || "—"}</td>
                  <td className="px-3 py-3 text-xs">{formatAdminDate(r.signupDate)}</td>
                  <td className="px-3 py-3 text-xs">
                    {formatAdminDate(r.subscriptionStartedAt)}
                  </td>
                  <td className="px-3 py-3 text-xs">
                    {formatAdminDate(r.qualificationDate)}
                  </td>
                  <td className="px-3 py-3">${r.rewardAmount.toFixed(0)} CAD</td>
                  <td className="px-3 py-3">{partnerAdminStatusBadge(r.rewardStatus)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="space-y-3 md:hidden">
          {referrals.map((r) => (
            <div
              key={r.id}
              className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
            >
              <p className="font-medium">{r.contractorName || "—"}</p>
              <p className="mt-1 text-sm text-zinc-600">
                Qualified {formatAdminDate(r.qualificationDate)} · $
                {r.rewardAmount.toFixed(0)} CAD
              </p>
              {partnerAdminStatusBadge(r.rewardStatus)}
            </div>
          ))}
        </div>
      </section>

      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
        <p className="text-sm text-zinc-600">
          {referrals.length} referral{referrals.length === 1 ? "" : "s"}
        </p>
        <p className="text-lg font-bold text-zinc-900">
          TOTAL PAYMENT: ${totalAmountCad.toFixed(0)} CAD
        </p>
        <button
          type="button"
          disabled={pending || !canPay}
          title={
            canPay
              ? `Record ${PARTNER_PAYMENT_METHOD_LABEL} after you send it`
              : "Add partner payment email or ensure rewards are ready"
          }
          className="mt-4 rounded bg-[#2436BB] px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          onClick={() => void openConfirm()}
        >
          Record ${totalAmountCad.toFixed(0)} payment
        </button>
      </div>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="w-[min(100%,32rem)] max-w-lg rounded-xl border border-zinc-200 bg-white p-6 shadow-xl backdrop:bg-black/40"
        onClose={() => setConfirmOpen(false)}
      >
        <h2 id={titleId} className="text-lg font-semibold text-zinc-900">
          Confirm payment
        </h2>
        <p className="mt-2 text-sm text-zinc-600">
          Confirm that you sent <strong>${totalAmountCad.toFixed(0)} CAD</strong> by{" "}
          {PARTNER_PAYMENT_METHOD_LABEL} to{" "}
          <strong>{paymentEmail || "—"}</strong> for {referrals.length} referral
          {referrals.length === 1 ? "" : "s"}.
        </p>
        <div className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="text-zinc-600">Interac / reference number (optional)</span>
            <input
              type="text"
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="text-zinc-600">Admin note (optional)</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="text-zinc-600">Payment date</span>
            <input
              type="datetime-local"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
            />
          </label>
        </div>
        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending || !idempotencyKey}
            className="rounded bg-green-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            onClick={recordPayment}
          >
            Confirm payment recorded
          </button>
          <button
            type="button"
            className="rounded border px-4 py-2 text-sm"
            onClick={() => setConfirmOpen(false)}
          >
            Cancel
          </button>
        </div>
      </dialog>

      <Link href="/admin/partners/payouts" className="text-sm font-medium text-[#2436BB]">
        ← Back to payouts
      </Link>
    </div>
  );
}
