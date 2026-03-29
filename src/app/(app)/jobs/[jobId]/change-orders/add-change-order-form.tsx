"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createChangeOrder,
  sendChangeOrderForSigning,
  sendChangeOrderRemoteSigningLink,
} from "@/app/(app)/actions";
import {
  CHANGE_ORDER_DESCRIPTION_REQUIRED,
  CHANGE_ORDER_REMOTE_EMAIL_REQUIRED,
  CHANGE_ORDER_TITLE_REQUIRED,
  isValidCustomerEmailForChangeOrderRemote,
  parseNewJobTotal,
  validateChangeOrderNewCompletionDate,
  validateCustomerEmailForChangeOrderRemote,
} from "@/lib/validation/change-order";
import { formatLocalDateStringEastern } from "@/lib/datetime-eastern";

type Job = {
  original_contract_price?: number | null;
  current_contract_total?: number | null;
};

export function AddChangeOrderForm({
  jobId,
  job,
  customerEmail,
  jobEditLocked = false,
}: {
  jobId: string;
  job: Job;
  customerEmail: string | null | undefined;
  /** When true, customer email cannot be edited via Edit job (signed contract). */
  jobEditLocked?: boolean;
}) {
  const router = useRouter();
  const [changeTitle, setChangeTitle] = useState("");
  const [changeDescription, setChangeDescription] = useState("");
  const [reasonForChange, setReasonForChange] = useState("");
  const [newJobTotal, setNewJobTotal] = useState("");
  const [newEstimatedCompletionDate, setNewEstimatedCompletionDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [emailSendError, setEmailSendError] = useState<string | null>(null);
  const [loading, setLoading] = useState<"draft" | "device" | "email" | null>(null);
  const [confirmSend, setConfirmSend] = useState<"device" | "email" | null>(null);
  const [confirmModalError, setConfirmModalError] = useState<string | null>(null);

  const previousTotal = Number(job.current_contract_total ?? job.original_contract_price ?? 0);

  const rawInput = newJobTotal.trim().replace(/[$,\s]/g, "");
  const liveNum = rawInput === "" ? null : Number.parseFloat(rawInput);
  const showLiveSummary =
    newJobTotal.trim() !== "" &&
    liveNum !== null &&
    !Number.isNaN(liveNum) &&
    Number.isFinite(liveNum) &&
    liveNum > 0;
  const liveChangeAmount = showLiveSummary ? liveNum! - previousTotal : null;

  /** Always derived from current form state so the confirmation dialog stays accurate while open. */
  const confirmationPreview = useMemo(() => {
    const totalRes = parseNewJobTotal(newJobTotal);
    const total = totalRes.ok ? totalRes.value : null;
    const change = total != null ? total - previousTotal : null;
    return {
      total,
      change,
      title: changeTitle.trim() || "—",
      completionLabel: newEstimatedCompletionDate
        ? formatLocalDateStringEastern(newEstimatedCompletionDate)
        : "—",
    };
  }, [newJobTotal, newEstimatedCompletionDate, changeTitle, previousTotal]);

  function validateFields(): Record<string, string> {
    const errs: Record<string, string> = {};
    if (!changeTitle.trim()) {
      errs.change_title = CHANGE_ORDER_TITLE_REQUIRED;
    }
    if (!changeDescription.trim()) {
      errs.change_description = CHANGE_ORDER_DESCRIPTION_REQUIRED;
    }

    const completionErr = validateChangeOrderNewCompletionDate(newEstimatedCompletionDate);
    if (completionErr) errs.new_estimated_completion_date = completionErr;

    const t = parseNewJobTotal(newJobTotal);
    if (!t.ok) errs.new_job_total = t.message;

    return errs;
  }

  function buildParams() {
    const totalRes = parseNewJobTotal(newJobTotal);
    if (!totalRes.ok) return null;
    return {
      changeTitle: changeTitle.trim(),
      changeDescription: changeDescription.trim(),
      reasonForChange: reasonForChange.trim() || undefined,
      newJobTotal: totalRes.value,
      newEstimatedCompletionDate: newEstimatedCompletionDate.trim(),
    };
  }

  async function runCreate(): Promise<
    | { changeOrderId: string }
    | { fieldErrors: Record<string, string> }
    | { errorMessage: string }
  > {
    const params = buildParams();
    if (!params) return { errorMessage: "Check the form and try again." };
    const result = await createChangeOrder(jobId, params);
    if (result && "fieldErrors" in result && result.fieldErrors) {
      return {
        fieldErrors: result.fieldErrors as unknown as Record<string, string>,
      };
    }
    if (result?.error) {
      return { errorMessage: result.error };
    }
    const id = "changeOrderId" in result && result.changeOrderId ? result.changeOrderId : null;
    if (!id) return { errorMessage: "Could not create change order." };
    return { changeOrderId: id };
  }

  async function handleSaveDraft() {
    setError(null);
    setEmailSendError(null);
    const errs = validateFields();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    setLoading("draft");
    const created = await runCreate();
    setLoading(null);
    if (created && "fieldErrors" in created) {
      setFieldErrors(created.fieldErrors);
      return;
    }
    if (created && "errorMessage" in created) {
      setError(created.errorMessage);
      return;
    }
    if (!created || !("changeOrderId" in created)) return;
    router.push(`/jobs/${jobId}/change-orders/${created.changeOrderId}`);
  }

  function openConfirmDevice() {
    setError(null);
    setEmailSendError(null);
    setConfirmModalError(null);
    const errs = validateFields();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    setConfirmSend("device");
  }

  function openConfirmEmail() {
    setError(null);
    setEmailSendError(null);
    setConfirmModalError(null);
    const remoteErr = validateCustomerEmailForChangeOrderRemote(customerEmail);
    if (remoteErr) {
      setEmailSendError(remoteErr);
      return;
    }
    const errs = validateFields();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    setConfirmSend("email");
  }

  async function executeConfirmedSend() {
    const mode = confirmSend;
    if (!mode) return;

    const errs = validateFields();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      setConfirmModalError(
        "Some fields are no longer valid. Fix the errors in the form behind this dialog, then confirm again."
      );
      return;
    }
    setConfirmModalError(null);
    setFieldErrors({});
    setConfirmSend(null);
    setLoading(mode === "device" ? "device" : "email");
    const created = await runCreate();
    if (created && "fieldErrors" in created) {
      setFieldErrors(created.fieldErrors);
      setLoading(null);
      return;
    }
    if (created && "errorMessage" in created) {
      setError(created.errorMessage);
      setLoading(null);
      return;
    }
    if (!created || !("changeOrderId" in created)) {
      setLoading(null);
      return;
    }
    const changeOrderId = created.changeOrderId;

    if (mode === "device") {
      const sendResult = await sendChangeOrderForSigning(changeOrderId, {
        deliveryMethod: "device",
      });
      setLoading(null);
      if (sendResult?.error) {
        setError(sendResult.error);
        return;
      }
      router.push(`/jobs/${jobId}/change-orders/${changeOrderId}/sign`);
      return;
    }

    const origin = typeof window !== "undefined" ? window.location.origin : undefined;
    const remoteResult = await sendChangeOrderRemoteSigningLink({
      changeOrderId,
      publicOrigin: origin,
    });
    setLoading(null);
    if (remoteResult?.error) {
      setError(remoteResult.error);
      if (
        remoteResult.error.includes("email") ||
        remoteResult.error === CHANGE_ORDER_REMOTE_EMAIL_REQUIRED
      ) {
        setEmailSendError(remoteResult.error);
      }
      return;
    }
    router.push(`/jobs/${jobId}/change-orders/${changeOrderId}`);
  }

  const emailReady = isValidCustomerEmailForChangeOrderRemote(customerEmail);

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          {error.includes("business profile") && (
            <Link
              href="/settings/business"
              className="mt-2 block font-medium text-red-800 underline hover:no-underline"
            >
              Complete business profile →
            </Link>
          )}
        </div>
      )}

      <h2 className="font-semibold text-zinc-900">New change order</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Current job total: <span className="font-medium text-zinc-900">${previousTotal.toLocaleString()}</span>
        {" "}(before this change)
      </p>

      <div className="mt-4 space-y-4">
        <div>
          <label htmlFor="changeTitle" className="block text-sm font-medium text-zinc-700">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            id="changeTitle"
            type="text"
            value={changeTitle}
            onChange={(e) => {
              setChangeTitle(e.target.value);
              setFieldErrors((p) => {
                const n = { ...p };
                delete n.change_title;
                return n;
              });
            }}
            placeholder="e.g. Additional cabinet installation"
            className={`mt-1 block w-full rounded-lg border px-4 py-2.5 text-zinc-900 focus:outline-none focus:ring-1 focus:ring-[#2436BB] ${
              fieldErrors.change_title ? "border-red-500" : "border-zinc-300 focus:border-[#2436BB]"
            }`}
          />
          {fieldErrors.change_title && (
            <p className="mt-1 text-sm text-red-600">{fieldErrors.change_title}</p>
          )}
        </div>

        <div>
          <label htmlFor="changeDescription" className="block text-sm font-medium text-zinc-700">
            Description <span className="text-red-500">*</span>
          </label>
          <textarea
            id="changeDescription"
            rows={3}
            value={changeDescription}
            onChange={(e) => {
              setChangeDescription(e.target.value);
              setFieldErrors((p) => {
                const n = { ...p };
                delete n.change_description;
                return n;
              });
            }}
            placeholder="Describe the change in detail..."
            className={`mt-1 block w-full rounded-lg border px-4 py-2.5 text-zinc-900 focus:outline-none focus:ring-1 focus:ring-[#2436BB] ${
              fieldErrors.change_description ? "border-red-500" : "border-zinc-300 focus:border-[#2436BB]"
            }`}
          />
          {fieldErrors.change_description && (
            <p className="mt-1 text-sm text-red-600">{fieldErrors.change_description}</p>
          )}
        </div>

        <div>
          <label htmlFor="reasonForChange" className="block text-sm font-medium text-zinc-700">
            Reason for change
          </label>
          <input
            id="reasonForChange"
            type="text"
            value={reasonForChange}
            onChange={(e) => setReasonForChange(e.target.value)}
            placeholder="e.g. Customer requested upgrade"
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
          />
        </div>

        <div>
          <label htmlFor="newJobTotal" className="block text-sm font-medium text-zinc-700">
            New job total <span className="text-red-500">*</span>
          </label>
          <p className="mt-0.5 text-xs text-zinc-500">
            Enter the full contract total after this change. We calculate the difference from the current
            total.
          </p>
          <div className="relative mt-1">
            <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-zinc-500">
              $
            </span>
            <input
              id="newJobTotal"
              type="number"
              step="0.01"
              min="0.01"
              inputMode="decimal"
              value={newJobTotal}
              onChange={(e) => {
                setNewJobTotal(e.target.value);
                setFieldErrors((p) => {
                  const n = { ...p };
                  delete n.new_job_total;
                  return n;
                });
              }}
              placeholder={previousTotal.toLocaleString()}
              className={`no-spinner block w-full rounded-lg border py-2.5 pl-7 pr-4 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-[#2436BB] ${
                fieldErrors.new_job_total ? "border-red-500" : "border-zinc-300 focus:border-[#2436BB]"
              }`}
            />
          </div>
          {fieldErrors.new_job_total && (
            <p className="mt-1 text-sm text-red-600">{fieldErrors.new_job_total}</p>
          )}
          {newJobTotal.trim() !== "" && (
            <div
              className="mt-3 rounded-lg border-2 border-blue-200 bg-gradient-to-b from-blue-50/95 to-white px-4 py-3 shadow-sm"
              aria-live="polite"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-900/80">
                Live pricing summary
              </p>
              {!showLiveSummary ? (
                <p className="mt-2 text-sm text-amber-800">
                  Keep typing a valid new job total (greater than zero) to see the change amount.
                </p>
              ) : (
                <dl className="mt-2 space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-zinc-600">Previous total</dt>
                    <dd className="font-medium text-zinc-900">${previousTotal.toLocaleString()}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-zinc-600">New total</dt>
                    <dd className="font-semibold text-[#2436BB]">${liveNum!.toLocaleString()}</dd>
                  </div>
                  <div className="flex justify-between gap-4 border-t border-blue-100 pt-2">
                    <dt className="text-zinc-600">Change amount</dt>
                    <dd
                      className={
                        liveChangeAmount! >= 0 ? "font-semibold text-green-700" : "font-semibold text-red-700"
                      }
                    >
                      {liveChangeAmount! >= 0 ? "+" : ""}
                      {liveChangeAmount!.toLocaleString()}
                    </dd>
                  </div>
                </dl>
              )}
            </div>
          )}
        </div>

        <div>
          <label
            htmlFor="newEstimatedCompletionDate"
            className="block text-sm font-medium text-zinc-700"
          >
            New completion date <span className="text-red-500">*</span>
          </label>
          <p className="mt-0.5 text-xs text-zinc-500">
            The date the job is expected to finish after this change (updates the schedule for this
            change order only).
          </p>
          <input
            id="newEstimatedCompletionDate"
            type="date"
            value={newEstimatedCompletionDate}
            onChange={(e) => {
              setNewEstimatedCompletionDate(e.target.value);
              setFieldErrors((p) => {
                const n = { ...p };
                delete n.new_estimated_completion_date;
                return n;
              });
            }}
            className={`mt-1 block w-full max-w-xs rounded-lg border px-4 py-2.5 text-zinc-900 focus:outline-none focus:ring-1 focus:ring-[#2436BB] ${
              fieldErrors.new_estimated_completion_date
                ? "border-red-500"
                : "border-zinc-300 focus:border-[#2436BB]"
            }`}
          />
          {fieldErrors.new_estimated_completion_date && (
            <p className="mt-1 text-sm text-red-600">{fieldErrors.new_estimated_completion_date}</p>
          )}
        </div>

        <div className="rounded-lg border border-zinc-200 bg-zinc-50/80 px-3 py-2 text-sm text-zinc-700">
          <p className="font-medium text-zinc-900">Email for “send by email”</p>
          <p className="mt-0.5">
            {customerEmail?.trim() ? (
              <span>{customerEmail.trim()}</span>
            ) : (
              <span className="text-amber-800">No email on file for this customer.</span>
            )}
          </p>
          {!emailReady &&
            (jobEditLocked ? (
              <p className="mt-2 text-sm text-amber-800">
                No customer email on file. It can&apos;t be added here while the contract is signed and
                the job is locked for editing.
              </p>
            ) : (
              <Link
                href={`/jobs/${jobId}/edit`}
                className="mt-2 inline-block text-sm font-medium text-[#2436BB] hover:underline"
              >
                Add customer email on Edit job →
              </Link>
            ))}
          {emailSendError && (
            <p className="mt-2 text-sm text-red-600" role="alert">
              {emailSendError}
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 border-t border-zinc-200 pt-6">
        <p className="text-sm font-medium text-zinc-900">Send to customer for approval</p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={!!loading}
            onClick={openConfirmDevice}
            className="rounded-lg bg-[#2436BB] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1c2a96] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading === "device" ? "Sending…" : "Customer signs on your device"}
          </button>
          <button
            type="button"
            disabled={!!loading || !emailReady}
            title={
              !emailReady ? CHANGE_ORDER_REMOTE_EMAIL_REQUIRED : "Email a secure signing link to the customer"
            }
            onClick={openConfirmEmail}
            className="rounded-lg border-2 border-[#2436BB] bg-white px-4 py-2.5 text-sm font-medium text-[#2436BB] transition-colors hover:bg-[#2436BB]/5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading === "email" ? "Sending…" : "Send to customer by email"}
          </button>
        </div>
        <button
          type="button"
          disabled={!!loading}
          onClick={handleSaveDraft}
          className="self-start rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading === "draft" ? "Saving…" : "Save draft"}
        </button>
      </div>

      {confirmSend && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="co-confirm-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Close"
            onClick={() => {
              setConfirmSend(null);
              setConfirmModalError(null);
            }}
          />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl">
            <h3 id="co-confirm-title" className="text-lg font-semibold text-zinc-900">
              {confirmSend === "device"
                ? "Send for approval — sign on this device?"
                : "Send for approval — email customer?"}
            </h3>
            <p className="mt-2 text-sm text-zinc-600">
              Confirm these details before sending. This creates the change order and notifies the customer
              workflow.
            </p>
            <p className="mt-2 text-xs font-medium text-blue-900/90">
              These values always match your form — you can edit fields while this dialog is open; the
              summary updates immediately.
            </p>
            {confirmModalError && (
              <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950" role="alert">
                {confirmModalError}
              </div>
            )}
            <dl
              key={`${newJobTotal}|${newEstimatedCompletionDate}|${changeTitle}`}
              className="mt-4 space-y-2 rounded-lg bg-zinc-50 p-4 text-sm"
            >
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-600">Title</dt>
                <dd className="max-w-[60%] text-right font-medium text-zinc-900">
                  {confirmationPreview.title}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-600">New job total</dt>
                <dd className="font-medium text-zinc-900">
                  {confirmationPreview.total != null
                    ? `$${confirmationPreview.total.toLocaleString()}`
                    : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-600">Change amount</dt>
                <dd
                  className={
                    confirmationPreview.total != null && confirmationPreview.change != null
                      ? confirmationPreview.change >= 0
                        ? "font-medium text-green-700"
                        : "font-medium text-red-700"
                      : "font-medium text-zinc-500"
                  }
                >
                  {confirmationPreview.total != null && confirmationPreview.change != null ? (
                    <>
                      {confirmationPreview.change >= 0 ? "+" : "-"}$
                      {Math.abs(confirmationPreview.change).toLocaleString()}
                    </>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-600">New completion date</dt>
                <dd className="font-medium text-zinc-900">{confirmationPreview.completionLabel}</dd>
              </div>
            </dl>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setConfirmSend(null);
                  setConfirmModalError(null);
                }}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void executeConfirmedSend()}
                className="rounded-lg bg-[#2436BB] px-4 py-2 text-sm font-medium text-white hover:bg-[#1c2a96]"
              >
                Confirm and send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
