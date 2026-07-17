"use client";

import { useState, useTransition } from "react";
import {
  adminApprovePartnerApplication,
  adminApproveReferralReward,
  adminChangePartnerLevel,
  adminDeclinePartnerApplication,
  adminMarkReferralPaid,
  adminReactivatePartner,
  adminSetApplicationUnderReview,
  adminSuspendPartner,
  adminAdjustReferralReward,
} from "./actions";
import type { PartnerLevel, PartnerRewardStatus } from "@/lib/partners/constants";
import {
  partnerLevelLabel,
  rewardAmountForLevel,
} from "@/lib/partners/constants";
import { FoundingPartnerBadge } from "@/components/partners/founding-partner-badge";

type AppRow = {
  id: string;
  organization_name: string;
  contact_name: string;
  email: string;
  partner_type: string;
  status: string;
  submitted_at: string;
  estimated_audience: string | null;
  promotion_plan: string;
  reason: string;
  agreement_version: string | null;
  agreement_accepted_at: string | null;
};

type PartnerRow = {
  id: string;
  organization_name: string;
  contact_name: string;
  email: string;
  partner_type: string;
  partner_level: PartnerLevel;
  status: string;
  referral_code: string;
  created_at: string;
  agreement_version: string | null;
  agreement_accepted_at: string | null;
};

type ReferralRow = {
  id: string;
  partner_name: string;
  referral_code: string;
  contractor_business_name: string | null;
  signup_date: string;
  subscription_started_at: string | null;
  qualification_date: string | null;
  reward_amount: number;
  reward_status: PartnerRewardStatus;
  reward_paid_at: string | null;
  reward_status_label: string;
};

export function AdminPartnersClient({
  applications,
  partners,
  referrals,
}: {
  applications: AppRow[];
  partners: PartnerRow[];
  referrals: ReferralRow[];
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(label: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        setError(result.error ?? `${label} failed`);
        return;
      }
      setMessage(`${label} succeeded`);
    });
  }

  return (
    <div className="space-y-10">
      {message ? (
        <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-zinc-900">Applications</h2>
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-3 py-2">Organization</th>
                <th className="px-3 py-2">Contact</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Agreement</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((a) => (
                <tr key={a.id} className="border-b border-zinc-100 align-top">
                  <td className="px-3 py-3">
                    <p className="font-medium">{a.organization_name}</p>
                    <p className="text-xs text-zinc-500">{a.email}</p>
                  </td>
                  <td className="px-3 py-3">{a.contact_name}</td>
                  <td className="px-3 py-3">{a.partner_type}</td>
                  <td className="px-3 py-3">
                    {a.agreement_version && a.agreement_accepted_at ? (
                      <>
                        <p>{a.agreement_version}</p>
                        <p className="text-xs text-zinc-500">
                          {formatDate(a.agreement_accepted_at)}
                        </p>
                      </>
                    ) : (
                      <span className="font-medium text-amber-700">
                        No acceptance recorded
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3">{a.status}</td>
                  <td className="px-3 py-3">
                    {["submitted", "under_review"].includes(a.status) ? (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={pending}
                          className="rounded border px-2 py-1 text-xs"
                          onClick={() =>
                            run("Mark under review", () =>
                              adminSetApplicationUnderReview(a.id)
                            )
                          }
                        >
                          Under review
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          className="rounded bg-[#2436BB] px-2 py-1 text-xs text-white"
                          onClick={() =>
                            run("Approve", () => adminApprovePartnerApplication(a.id))
                          }
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          className="rounded border px-2 py-1 text-xs"
                          onClick={() =>
                            run("Approve as Founding", () =>
                              adminApprovePartnerApplication(a.id, "founding")
                            )
                          }
                        >
                          Approve founding
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          className="rounded border border-red-300 px-2 py-1 text-xs text-red-700"
                          onClick={() =>
                            run("Decline", () => adminDeclinePartnerApplication(a.id))
                          }
                        >
                          Decline
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-zinc-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-zinc-900">Partners</h2>
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-3 py-2">Organization</th>
                <th className="px-3 py-2">Type / level</th>
                <th className="px-3 py-2">Reward</th>
                <th className="px-3 py-2">Agreement</th>
                <th className="px-3 py-2">Code</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {partners.map((p) => (
                <tr key={p.id} className="border-b border-zinc-100">
                  <td className="px-3 py-3">
                    <p className="font-medium">{p.organization_name}</p>
                    <p className="text-xs text-zinc-500">{p.email}</p>
                  </td>
                  <td className="px-3 py-3">
                    <p>{p.partner_type}</p>
                    <div className="mt-1">
                      {p.partner_level === "founding" ? (
                        <FoundingPartnerBadge />
                      ) : (
                        <span className="text-xs text-zinc-600">
                          {partnerLevelLabel(p.partner_level)}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    ${rewardAmountForLevel(p.partner_level)} CAD
                  </td>
                  <td className="px-3 py-3">
                    {p.agreement_version && p.agreement_accepted_at ? (
                      <>
                        <p>{p.agreement_version}</p>
                        <p className="text-xs text-zinc-500">
                          {formatDate(p.agreement_accepted_at)}
                        </p>
                      </>
                    ) : (
                      <div className="max-w-44 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">
                        Legacy/imported partner: no agreement acceptance recorded
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3 font-mono text-xs">{p.referral_code}</td>
                  <td className="px-3 py-3">{p.status}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      {p.status === "active" ? (
                        <button
                          type="button"
                          disabled={pending}
                          className="rounded border px-2 py-1 text-xs"
                          onClick={() => run("Suspend", () => adminSuspendPartner(p.id))}
                        >
                          Suspend
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={pending}
                          className="rounded border px-2 py-1 text-xs"
                          onClick={() => run("Reactivate", () => adminReactivatePartner(p.id))}
                        >
                          Reactivate
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={pending}
                        className="rounded border px-2 py-1 text-xs"
                        onClick={() =>
                          run("Set founding", () => adminChangePartnerLevel(p.id, "founding"))
                        }
                      >
                        Set founding
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        className="rounded border px-2 py-1 text-xs"
                        onClick={() =>
                          run("Set standard", () => adminChangePartnerLevel(p.id, "standard"))
                        }
                      >
                        Set standard
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-zinc-900">Referrals & rewards</h2>
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-3 py-2">Partner</th>
                <th className="px-3 py-2">Contractor</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {referrals.map((r) => (
                <tr key={r.id} className="border-b border-zinc-100">
                  <td className="px-3 py-3">
                    <p className="font-medium">{r.partner_name}</p>
                    <p className="font-mono text-xs text-zinc-500">{r.referral_code}</p>
                  </td>
                  <td className="px-3 py-3">{r.contractor_business_name || "—"}</td>
                  <td className="px-3 py-3">{r.reward_status_label}</td>
                  <td className="px-3 py-3">
                    <input
                      type="number"
                      defaultValue={r.reward_amount}
                      className="w-24 rounded border px-2 py-1 text-sm"
                      id={`amt-${r.id}`}
                    />{" "}
                    CAD
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={pending}
                        className="rounded border px-2 py-1 text-xs"
                        onClick={() => {
                          const el = document.getElementById(
                            `amt-${r.id}`
                          ) as HTMLInputElement | null;
                          const amount = Number(el?.value);
                          run("Adjust amount", () =>
                            adminAdjustReferralReward(r.id, amount)
                          );
                        }}
                      >
                        Save amount
                      </button>
                      {(r.reward_status === "qualified" || r.reward_status === "pending") && (
                        <button
                          type="button"
                          disabled={pending}
                          className="rounded bg-[#2436BB] px-2 py-1 text-xs text-white"
                          onClick={() =>
                            run("Approve reward", () => adminApproveReferralReward(r.id))
                          }
                        >
                          Approve reward
                        </button>
                      )}
                      {r.reward_status !== "paid" && (
                        <button
                          type="button"
                          disabled={pending}
                          className="rounded border border-green-300 px-2 py-1 text-xs text-green-800"
                          onClick={() =>
                            run("Mark paid", () =>
                              adminMarkReferralPaid(r.id, {
                                paymentMethod: "e-transfer",
                              })
                            )
                          }
                        >
                          Mark paid
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value));
}
