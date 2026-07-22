"use client";

import { useEffect, useId, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
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
  adminResendPartnerVerificationEmail,
  adminSendPartnerPasswordResetEmail,
} from "./actions";
import type { PartnerLevel, PartnerRewardStatus } from "@/lib/partners/constants";
import {
  partnerLevelLabel,
  rewardAmountForLevel,
} from "@/lib/partners/constants";
import { FoundingPartnerBadge } from "@/components/partners/founding-partner-badge";
import {
  adminActionSuccessMessage,
  applyApplicationStatusUpdate,
  applicationStatusLabel,
  displayOptionalAdminValue,
  formatAdminDate,
  getApplicationReviewActions,
  hasValidAgreementAcceptance,
  websiteHref,
  type AdminApplicationDetail,
} from "@/lib/partners/admin-application-review";

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
  username: string | null;
  auth_user_id: string | null;
  legacy_account: boolean;
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
  applications: initialApplications,
  partners,
  referrals,
}: {
  applications: AdminApplicationDetail[];
  partners: PartnerRow[];
  referrals: ReferralRow[];
}) {
  const router = useRouter();
  const [applications, setApplications] = useState(initialApplications);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    setApplications(initialApplications);
  }, [initialApplications]);

  const selected = applications.find((a) => a.id === selectedId) ?? null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (selected) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [selected]);

  function closeDetail() {
    setSelectedId(null);
    setDeclineReason("");
  }

  function run(
    actionKey: string,
    fn: () => Promise<{
      ok: boolean;
      error?: string;
      partnerId?: string;
      status?: string;
      decline_reason?: string;
      reviewed_at?: string;
      reviewed_by?: string | null;
    }>,
    onSuccess?: (result: {
      partnerId?: string;
      status?: string;
      decline_reason?: string;
      reviewed_at?: string;
      reviewed_by?: string | null;
    }) => void
  ) {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        setError(result.error ?? "Action failed.");
        return;
      }
      onSuccess?.(result);
      setMessage(adminActionSuccessMessage(actionKey));
      router.refresh();
    });
  }

  return (
    <div className="space-y-10">
      {message ? (
        <p
          role="status"
          className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900"
        >
          {message}
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
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
              {applications.map((a) => {
                const actions = getApplicationReviewActions(a.status);
                return (
                  <tr key={a.id} className="border-b border-zinc-100 align-top">
                    <td className="px-3 py-3">
                      <p className="font-medium">{a.organization_name}</p>
                      <p className="text-xs text-zinc-500">{a.email}</p>
                    </td>
                    <td className="px-3 py-3">{a.contact_name}</td>
                    <td className="px-3 py-3">{a.partner_type}</td>
                    <td className="px-3 py-3">
                      {hasValidAgreementAcceptance(a) ? (
                        <>
                          <p>{a.agreement_version}</p>
                          <p className="text-xs text-zinc-500">
                            {formatAdminDate(a.agreement_accepted_at)}
                          </p>
                        </>
                      ) : (
                        <span className="font-medium text-amber-700">
                          No acceptance recorded
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
                          onClick={() => {
                            setDeclineReason("");
                            setSelectedId(a.id);
                          }}
                        >
                          View application
                        </button>
                        {actions.showUnderReviewBadge ? (
                          <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">
                            Currently under review
                          </span>
                        ) : null}
                        {actions.showApprovedState ? (
                          <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-800">
                            Approved
                          </span>
                        ) : null}
                        {actions.showDeclinedState ? (
                          <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-800">
                            Declined
                          </span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="fixed inset-0 z-50 m-auto w-[min(100%,40rem)] max-h-[90vh] overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-0 text-zinc-900 shadow-xl open:flex open:flex-col backdrop:bg-zinc-950/40"
        onClose={closeDetail}
        onCancel={(e) => {
          e.preventDefault();
          closeDetail();
        }}
      >
        {selected ? (
          <ApplicationDetailPanel
            app={selected}
            titleId={titleId}
            pending={pending}
            declineReason={declineReason}
            onDeclineReasonChange={setDeclineReason}
            onClose={closeDetail}
            onResendVerification={() =>
              run("resend_verification", () =>
                adminResendPartnerVerificationEmail(selected.id)
              )
            }
            onSendPasswordReset={() =>
              run("send_password_reset", () =>
                adminSendPartnerPasswordResetEmail(selected.id)
              )
            }
            onMarkUnderReview={() =>
              run(
                "mark_under_review",
                () => adminSetApplicationUnderReview(selected.id),
                () => {
                  setApplications((prev) =>
                    applyApplicationStatusUpdate(prev, selected.id, {
                      status: "under_review",
                    })
                  );
                }
              )
            }
            onApprove={(level) =>
              run(
                level === "founding" ? "approve_founding" : "approve",
                () => adminApprovePartnerApplication(selected.id, level),
                (result) => {
                  setApplications((prev) =>
                    applyApplicationStatusUpdate(prev, selected.id, {
                      status: "approved",
                      created_partner_id: result.partnerId ?? null,
                      reviewed_at: new Date().toISOString(),
                    })
                  );
                }
              )
            }
            onDecline={() =>
              run(
                "decline",
                () =>
                  adminDeclinePartnerApplication(selected.id, declineReason),
                (result) => {
                  setApplications((prev) =>
                    applyApplicationStatusUpdate(prev, selected.id, {
                      status: "declined",
                      decline_reason: result.decline_reason ?? declineReason,
                      reviewed_at: result.reviewed_at ?? new Date().toISOString(),
                      reviewed_by: result.reviewed_by ?? null,
                    })
                  );
                  setDeclineReason("");
                }
              )
            }
          />
        ) : null}
      </dialog>

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
                <tr key={p.id} className="border-b border-zinc-100" id={`partner-${p.id}`}>
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
                          {formatAdminDate(p.agreement_accepted_at)}
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
                          className="rounded border px-2 py-1 text-xs disabled:opacity-60"
                          onClick={() =>
                            run("suspend", () => adminSuspendPartner(p.id))
                          }
                        >
                          Suspend
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={pending}
                          className="rounded border px-2 py-1 text-xs disabled:opacity-60"
                          onClick={() =>
                            run("reactivate", () => adminReactivatePartner(p.id))
                          }
                        >
                          Reactivate
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={pending}
                        className="rounded border px-2 py-1 text-xs disabled:opacity-60"
                        onClick={() =>
                          run("set_founding", () =>
                            adminChangePartnerLevel(p.id, "founding")
                          )
                        }
                      >
                        Set founding
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        className="rounded border px-2 py-1 text-xs disabled:opacity-60"
                        onClick={() =>
                          run("set_standard", () =>
                            adminChangePartnerLevel(p.id, "standard")
                          )
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
                        className="rounded border px-2 py-1 text-xs disabled:opacity-60"
                        onClick={() => {
                          const el = document.getElementById(
                            `amt-${r.id}`
                          ) as HTMLInputElement | null;
                          const amount = Number(el?.value);
                          run("adjust_amount", () =>
                            adminAdjustReferralReward(r.id, amount)
                          );
                        }}
                      >
                        Save amount
                      </button>
                      {(r.reward_status === "qualified" ||
                        r.reward_status === "pending") && (
                        <button
                          type="button"
                          disabled={pending}
                          className="rounded bg-[#2436BB] px-2 py-1 text-xs text-white disabled:opacity-60"
                          onClick={() =>
                            run("approve_reward", () =>
                              adminApproveReferralReward(r.id)
                            )
                          }
                        >
                          Approve reward
                        </button>
                      )}
                      {r.reward_status !== "paid" && (
                        <button
                          type="button"
                          disabled={pending}
                          className="rounded border border-green-300 px-2 py-1 text-xs text-green-800 disabled:opacity-60"
                          onClick={() =>
                            run("mark_paid", () =>
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

function ApplicationDetailPanel({
  app,
  titleId,
  pending,
  declineReason,
  onDeclineReasonChange,
  onClose,
  onMarkUnderReview,
  onApprove,
  onDecline,
  onResendVerification,
  onSendPasswordReset,
}: {
  app: AdminApplicationDetail;
  titleId: string;
  pending: boolean;
  declineReason: string;
  onDeclineReasonChange: (value: string) => void;
  onClose: () => void;
  onMarkUnderReview: () => void;
  onApprove: (level?: PartnerLevel | null) => void;
  onDecline: () => void;
  onResendVerification: () => void;
  onSendPasswordReset: () => void;
}) {
  const actions = getApplicationReviewActions(app.status);
  const agreementOk = hasValidAgreementAcceptance(app);
  const site = websiteHref(app.website);

  return (
    <div className="flex max-h-[90vh] flex-col">
      <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-zinc-200 bg-white px-5 py-4">
        <div>
          <h3 id={titleId} className="text-lg font-semibold text-zinc-950">
            Application details
          </h3>
          <p className="mt-1 text-sm text-zinc-600">{app.organization_name}</p>
        </div>
        <button
          type="button"
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
          onClick={onClose}
          aria-label="Close application details"
        >
          Close
        </button>
      </div>

      <div className="space-y-5 overflow-y-auto px-5 py-5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={app.status} />
          {actions.showUnderReviewBadge ? (
            <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
              Currently under review
            </span>
          ) : null}
        </div>

        <dl className="grid gap-4 sm:grid-cols-2">
          <DetailItem label="Organization" value={app.organization_name} />
          <DetailItem label="Contact name" value={app.contact_name} />
          <DetailItem
            label="Email"
            value={
              <a
                href={`mailto:${app.email}`}
                className="font-medium text-[#2436BB] hover:underline"
              >
                {app.email}
              </a>
            }
          />
          <DetailItem
            label="Phone"
            value={displayOptionalAdminValue(app.phone)}
          />
          <DetailItem
            label="Website"
            value={
              site ? (
                <a
                  href={site}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all font-medium text-[#2436BB] hover:underline"
                >
                  {app.website}
                </a>
              ) : (
                "Not provided."
              )
            }
          />
          <DetailItem label="Partner type" value={app.partner_type} />
          <DetailItem
            label="Estimated audience"
            value={displayOptionalAdminValue(app.estimated_audience)}
          />
          <DetailItem
            label="Username"
            value={displayOptionalAdminValue(app.username)}
          />
          <DetailItem
            label="Auth account linked"
            value={app.auth_account_linked ? "Yes" : "No"}
          />
          <DetailItem
            label="Email verified"
            value={app.email_verified ? "Yes" : "No"}
          />
          <DetailItem
            label="Account state"
            value={
              app.legacy_account
                ? "Legacy (setup / link required)"
                : app.auth_account_linked
                  ? app.email_verified
                    ? "Auth linked · email verified"
                    : "Auth linked · email unverified"
                  : "No Auth link"
            }
          />
          <DetailItem label="Status" value={applicationStatusLabel(app.status)} />
          <DetailItem
            label="Submitted"
            value={formatAdminDate(app.submitted_at)}
          />
          <DetailItem
            label="Reviewed at"
            value={formatAdminDate(app.reviewed_at)}
          />
          <DetailItem
            label="Reviewed by"
            value={displayOptionalAdminValue(app.reviewed_by)}
          />
          <DetailItem
            label="Agreement version"
            value={displayOptionalAdminValue(app.agreement_version)}
          />
          <DetailItem
            label="Agreement accepted"
            value={formatAdminDate(app.agreement_accepted_at)}
          />
          {app.created_partner_id ? (
            <DetailItem
              label="Created partner"
              value={
                <a
                  href={`#partner-${app.created_partner_id}`}
                  className="font-medium text-[#2436BB] hover:underline"
                  onClick={onClose}
                >
                  View partner record
                </a>
              }
            />
          ) : null}
        </dl>

        <div>
          <h4 className="text-sm font-semibold text-zinc-900">Promotion plan</h4>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-700">
            {displayOptionalAdminValue(app.promotion_plan)}
          </p>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-zinc-900">Reason for applying</h4>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-700">
            {displayOptionalAdminValue(app.reason)}
          </p>
        </div>

        {actions.showDeclinedState ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-semibold text-red-900">Declined</p>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm text-red-800">
              {displayOptionalAdminValue(app.decline_reason)}
            </p>
          </div>
        ) : null}

        {actions.showApprovedState ? (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900">
            <p className="font-semibold">Approved</p>
            {app.created_partner_id ? (
              <p className="mt-1">
                Partner record created.{" "}
                <a
                  href={`#partner-${app.created_partner_id}`}
                  className="font-medium underline"
                  onClick={onClose}
                >
                  Jump to partner
                </a>
              </p>
            ) : (
              <p className="mt-1">Partner record is available in the Partners table.</p>
            )}
          </div>
        ) : null}

        {app.legacy_account ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Legacy application: no username/Auth link on file. Approval can
            proceed, but the partner needs a secure account setup (password
            reset after they create/sign in with this email, or admin password-reset
            email below). Admins cannot set or view passwords.
          </p>
        ) : null}

        <div className="space-y-3 border-t border-zinc-200 pt-4">
          <h4 className="text-sm font-semibold text-zinc-900">Account actions</h4>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending || !app.auth_account_linked}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium disabled:opacity-60"
              onClick={onResendVerification}
            >
              Resend verification email
            </button>
            <button
              type="button"
              disabled={pending}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium disabled:opacity-60"
              onClick={onSendPasswordReset}
            >
              Send password-reset email
            </button>
          </div>
        </div>

        {!agreementOk && (actions.canApprove || actions.canDecline) ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            This application has no recorded Partner Program Agreement acceptance
            and cannot be approved.
          </p>
        ) : null}

        {(actions.canMarkUnderReview ||
          actions.canApprove ||
          actions.canDecline) && (
          <div className="space-y-4 border-t border-zinc-200 pt-4">
            <h4 className="text-sm font-semibold text-zinc-900">Review actions</h4>
            <div className="flex flex-wrap gap-2">
              {actions.canMarkUnderReview ? (
                <button
                  type="button"
                  disabled={pending}
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium disabled:opacity-60"
                  onClick={onMarkUnderReview}
                >
                  Mark under review
                </button>
              ) : null}
              {actions.showUnderReviewBadge ? (
                <span
                  className="inline-flex items-center rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900"
                  aria-disabled="true"
                >
                  Currently under review
                </span>
              ) : null}
              {actions.canApprove ? (
                <>
                  <button
                    type="button"
                    disabled={pending || !agreementOk}
                    title={
                      agreementOk
                        ? undefined
                        : "Agreement acceptance is required before approval"
                    }
                    className="rounded-lg bg-[#2436BB] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                    onClick={() => onApprove()}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={pending || !agreementOk}
                    title={
                      agreementOk
                        ? undefined
                        : "Agreement acceptance is required before approval"
                    }
                    className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium disabled:opacity-60"
                    onClick={() => onApprove("founding")}
                  >
                    Approve founding
                  </button>
                </>
              ) : null}
            </div>

            {actions.canDecline ? (
              <div className="space-y-2">
                <label
                  htmlFor="decline-reason"
                  className="block text-sm font-medium text-zinc-700"
                >
                  Decline reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="decline-reason"
                  rows={3}
                  value={declineReason}
                  onChange={(e) => onDeclineReasonChange(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
                  placeholder="Internal note explaining the decline"
                />
                <button
                  type="button"
                  disabled={pending || !declineReason.trim()}
                  className="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700 disabled:opacity-60"
                  onClick={onDecline}
                >
                  Decline application
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm text-zinc-900">{value}</dd>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    submitted: "bg-zinc-100 text-zinc-800",
    under_review: "bg-amber-50 text-amber-900",
    approved: "bg-green-50 text-green-800",
    declined: "bg-red-50 text-red-800",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
        styles[status] ?? "bg-zinc-100 text-zinc-700"
      }`}
    >
      {applicationStatusLabel(status)}
    </span>
  );
}
