"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  adminForceReleaseReferralForPayment,
  adminInvalidateReferralReward,
  adminReverifyReferral,
} from "../payout-actions";
import {
  adminRewardStatusLabel,
  type PartnerRewardStatus,
} from "@/lib/partners/constants";
import { PARTNER_PAYMENT_METHOD_LABEL } from "@/lib/partners/payment-details";
import { formatAdminDate } from "@/lib/partners/admin-application-review";

export type NeedsReviewRow = {
  id: string;
  partnerId: string;
  partnerName: string;
  contractorName: string | null;
  rewardAmount: number;
  qualificationDate: string | null;
  verificationNotes: string | null;
};

export type PayoutHistoryRow = {
  id: string;
  partnerId: string;
  partnerName: string;
  amount: number;
  referralCount: number;
  paymentMethod: string | null;
  paymentEmail: string | null;
  paidAt: string;
};

export type ReadyPartnerRow = {
  partnerId: string;
  organizationName: string;
  paymentEmail: string | null;
  readyCount: number;
  readyAmountCad: number;
  missingPaymentEmail: boolean;
};

export function PayoutDashboardClient({
  readyPartners,
  needsReview,
  history,
}: {
  readyPartners: ReadyPartnerRow[];
  needsReview: NeedsReviewRow[];
  history: PayoutHistoryRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [invalidateId, setInvalidateId] = useState<string | null>(null);
  const [invalidateReason, setInvalidateReason] = useState("");

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, success?: string) {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        setError(result.error ?? "Action failed");
        return;
      }
      setMessage(success ?? "Updated");
      router.refresh();
    });
  }

  return (
    <div className="space-y-10">
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

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-zinc-900">Ready for payment</h2>
        {readyPartners.length === 0 ? (
          <p className="text-sm text-zinc-500">No partners have rewards ready for payment.</p>
        ) : (
          <>
            <div className="hidden overflow-x-auto rounded-xl border border-zinc-200 bg-white md:block">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b bg-zinc-50 text-xs uppercase text-zinc-500">
                  <tr>
                    <th className="px-3 py-2">Partner</th>
                    <th className="px-3 py-2">Ready rewards</th>
                    <th className="px-3 py-2">Amount owed</th>
                    <th className="px-3 py-2">Payment email</th>
                    <th className="px-3 py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {readyPartners.map((p) => (
                    <tr key={p.partnerId} className="border-b border-zinc-100">
                      <td className="px-3 py-3 font-medium">{p.organizationName}</td>
                      <td className="px-3 py-3">{p.readyCount}</td>
                      <td className="px-3 py-3">${p.readyAmountCad.toFixed(0)} CAD</td>
                      <td className="px-3 py-3">
                        {p.missingPaymentEmail ? (
                          <span className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-900">
                            Payment email required
                          </span>
                        ) : (
                          <span className="break-all text-xs">{p.paymentEmail}</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <Link
                          href={`/admin/partners/payouts/${p.partnerId}`}
                          className="rounded bg-[#2436BB] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1e2d99]"
                        >
                          View payout
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-3 md:hidden">
              {readyPartners.map((p) => (
                <div
                  key={p.partnerId}
                  className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
                >
                  <p className="font-semibold text-zinc-900">{p.organizationName}</p>
                  <p className="mt-1 text-sm text-zinc-600">
                    {p.readyCount} rewards · ${p.readyAmountCad.toFixed(0)} CAD
                  </p>
                  {p.missingPaymentEmail ? (
                    <p className="mt-2 text-xs font-medium text-amber-800">
                      Payment email required
                    </p>
                  ) : (
                    <p className="mt-2 break-all text-xs text-zinc-500">{p.paymentEmail}</p>
                  )}
                  <Link
                    href={`/admin/partners/payouts/${p.partnerId}`}
                    className="mt-3 inline-block rounded bg-[#2436BB] px-3 py-1.5 text-xs font-medium text-white"
                  >
                    View payout
                  </Link>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-zinc-900">Needs review</h2>
        {needsReview.length === 0 ? (
          <p className="text-sm text-zinc-500">No referrals need review.</p>
        ) : (
          <>
            <div className="hidden overflow-x-auto rounded-xl border border-zinc-200 bg-white lg:block">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b bg-zinc-50 text-xs uppercase text-zinc-500">
                  <tr>
                    <th className="px-3 py-2">Partner</th>
                    <th className="px-3 py-2">Contractor</th>
                    <th className="px-3 py-2">Reward</th>
                    <th className="px-3 py-2">Reason</th>
                    <th className="px-3 py-2">Qualified</th>
                    <th className="px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {needsReview.map((r) => (
                    <tr key={r.id} className="border-b border-zinc-100">
                      <td className="px-3 py-3">{r.partnerName}</td>
                      <td className="px-3 py-3">{r.contractorName || "—"}</td>
                      <td className="px-3 py-3">${r.rewardAmount.toFixed(0)} CAD</td>
                      <td className="max-w-xs px-3 py-3 text-xs text-zinc-600">
                        {r.verificationNotes || "—"}
                      </td>
                      <td className="px-3 py-3 text-xs">
                        {formatAdminDate(r.qualificationDate)}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={pending}
                            className="rounded border px-2 py-1 text-xs disabled:opacity-60"
                            onClick={() =>
                              run(
                                () => adminReverifyReferral(r.id),
                                "Re-verified"
                              )
                            }
                          >
                            Re-verify
                          </button>
                          <button
                            type="button"
                            disabled={pending}
                            className="rounded bg-[#2436BB] px-2 py-1 text-xs text-white disabled:opacity-60"
                            onClick={() =>
                              run(
                                () => adminForceReleaseReferralForPayment(r.id),
                                "Released for payment"
                              )
                            }
                          >
                            Mark ready for payment
                          </button>
                          <button
                            type="button"
                            disabled={pending}
                            className="rounded border border-red-200 px-2 py-1 text-xs text-red-800 disabled:opacity-60"
                            onClick={() => {
                              setInvalidateId(r.id);
                              setInvalidateReason("");
                            }}
                          >
                            Invalidate
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-3 lg:hidden">
              {needsReview.map((r) => (
                <div
                  key={r.id}
                  className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
                >
                  <p className="font-medium text-zinc-900">{r.partnerName}</p>
                  <p className="text-sm text-zinc-600">{r.contractorName || "—"}</p>
                  <p className="mt-1 text-sm">${r.rewardAmount.toFixed(0)} CAD</p>
                  <p className="mt-2 text-xs text-zinc-500">{r.verificationNotes}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={pending}
                      className="rounded border px-2 py-1 text-xs"
                      onClick={() => run(() => adminReverifyReferral(r.id))}
                    >
                      Re-verify
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      className="rounded bg-[#2436BB] px-2 py-1 text-xs text-white"
                      onClick={() =>
                        run(() => adminForceReleaseReferralForPayment(r.id))
                      }
                    >
                      Mark ready
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      className="rounded border border-red-200 px-2 py-1 text-xs text-red-800"
                      onClick={() => {
                        setInvalidateId(r.id);
                        setInvalidateReason("");
                      }}
                    >
                      Invalidate
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-zinc-900">Payout history</h2>
        {history.length === 0 ? (
          <p className="text-sm text-zinc-500">No payouts recorded yet.</p>
        ) : (
          <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white">
            {history.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-medium text-zinc-900">{p.partnerName}</p>
                  <p className="text-sm text-zinc-600">
                    {formatAdminDate(p.paidAt)} · ${p.amount.toFixed(0)} CAD ·{" "}
                    {p.referralCount} referral{p.referralCount === 1 ? "" : "s"} ·{" "}
                    {p.paymentMethod || PARTNER_PAYMENT_METHOD_LABEL}
                  </p>
                </div>
                <Link
                  href={`/admin/partners/payouts/history/${p.id}`}
                  className="text-sm font-medium text-[#2436BB] hover:underline"
                >
                  View details
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {invalidateId ? (
        <dialog open className="fixed inset-0 z-50 m-auto w-[min(100%,28rem)] rounded-xl border border-zinc-200 bg-white p-6 shadow-xl">
          <h3 className="text-lg font-semibold text-zinc-900">Invalidate reward</h3>
          <p className="mt-1 text-sm text-zinc-600">
            Record why this referral reward is being invalidated. The referral record is
            preserved.
          </p>
          <textarea
            value={invalidateReason}
            onChange={(e) => setInvalidateReason(e.target.value)}
            rows={3}
            className="mt-3 w-full rounded border px-3 py-2 text-sm"
            placeholder="Reason (required)"
          />
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending || !invalidateReason.trim()}
              className="rounded bg-red-700 px-3 py-1.5 text-sm text-white disabled:opacity-60"
              onClick={() => {
                run(
                  () =>
                    adminInvalidateReferralReward(invalidateId!, invalidateReason),
                  "Reward invalidated"
                );
                setInvalidateId(null);
                setInvalidateReason("");
              }}
            >
              Confirm invalidate
            </button>
            <button
              type="button"
              className="rounded border px-3 py-1.5 text-sm"
              onClick={() => {
                setInvalidateId(null);
                setInvalidateReason("");
              }}
            >
              Cancel
            </button>
          </div>
        </dialog>
      ) : null}
    </div>
  );
}

export function partnerAdminStatusBadge(status: PartnerRewardStatus) {
  const label = adminRewardStatusLabel(status);
  const tone =
    status === "approved"
      ? "bg-green-50 text-green-800 border-green-200"
      : status === "needs_review"
        ? "bg-amber-50 text-amber-900 border-amber-200"
        : status === "paid"
          ? "bg-zinc-100 text-zinc-700 border-zinc-200"
          : "bg-zinc-50 text-zinc-700 border-zinc-200";
  return (
    <span className={`inline-flex rounded border px-2 py-0.5 text-xs font-medium ${tone}`}>
      {label}
    </span>
  );
}
