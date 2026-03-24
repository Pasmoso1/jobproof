"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateChangeOrder } from "@/app/(app)/actions";
import {
  CHANGE_ORDER_COMPLETION_DATE_REQUIRED,
  CHANGE_ORDER_DATES_ORDER,
  CHANGE_ORDER_DESCRIPTION_REQUIRED,
  CHANGE_ORDER_START_DATE_REQUIRED,
  CHANGE_ORDER_TITLE_REQUIRED,
  parseNewJobTotal,
  validateChangeOrderDateField,
} from "@/lib/validation/change-order";

type ChangeOrderRow = {
  id: string;
  change_title: string | null;
  change_description: string | null;
  reason_for_change: string | null;
  revised_total_price: number | null;
  original_contract_price: number | null;
  new_estimated_start_date: string | null;
  new_estimated_completion_date: string | null;
};

export function ChangeOrderDraftEditForm({ changeOrder }: { changeOrder: ChangeOrderRow }) {
  const router = useRouter();
  const [changeTitle, setChangeTitle] = useState(changeOrder.change_title ?? "");
  const [changeDescription, setChangeDescription] = useState(changeOrder.change_description ?? "");
  const [reasonForChange, setReasonForChange] = useState(changeOrder.reason_for_change ?? "");
  const [newJobTotal, setNewJobTotal] = useState(
    changeOrder.revised_total_price != null ? String(changeOrder.revised_total_price) : ""
  );
  const [newEstimatedStartDate, setNewEstimatedStartDate] = useState(
    changeOrder.new_estimated_start_date?.slice(0, 10) ?? ""
  );
  const [newEstimatedCompletionDate, setNewEstimatedCompletionDate] = useState(
    changeOrder.new_estimated_completion_date?.slice(0, 10) ?? ""
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const previousTotal = Number(changeOrder.original_contract_price ?? 0);
  const rawInput = newJobTotal.trim().replace(/[$,\s]/g, "");
  const liveNum =
    rawInput === "" ? null : Number.parseFloat(rawInput);
  const showLive =
    rawInput !== "" &&
    liveNum !== null &&
    !Number.isNaN(liveNum) &&
    Number.isFinite(liveNum) &&
    liveNum > 0;
  const liveChange = showLive ? liveNum - previousTotal : null;

  function validateFields(): Record<string, string> {
    const errs: Record<string, string> = {};
    if (!changeTitle.trim()) errs.change_title = CHANGE_ORDER_TITLE_REQUIRED;
    if (!changeDescription.trim()) errs.change_description = CHANGE_ORDER_DESCRIPTION_REQUIRED;
    const s = validateChangeOrderDateField(newEstimatedStartDate, CHANGE_ORDER_START_DATE_REQUIRED);
    if (s) errs.new_estimated_start_date = s;
    const e = validateChangeOrderDateField(newEstimatedCompletionDate, CHANGE_ORDER_COMPLETION_DATE_REQUIRED);
    if (e) errs.new_estimated_completion_date = e;
    if (!s && !e && newEstimatedStartDate && newEstimatedCompletionDate) {
      if (new Date(newEstimatedCompletionDate) < new Date(newEstimatedStartDate)) {
        errs.new_estimated_completion_date = CHANGE_ORDER_DATES_ORDER;
      }
    }
    const t = parseNewJobTotal(newJobTotal);
    if (!t.ok) errs.new_job_total = t.message;
    return errs;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const errs = validateFields();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    const totalRes = parseNewJobTotal(newJobTotal);
    if (!totalRes.ok) return;
    setLoading(true);
    const result = await updateChangeOrder(changeOrder.id, {
      changeTitle: changeTitle.trim(),
      changeDescription: changeDescription.trim(),
      reasonForChange: reasonForChange.trim() || undefined,
      newJobTotal: totalRes.value,
      newEstimatedStartDate: newEstimatedStartDate.trim(),
      newEstimatedCompletionDate: newEstimatedCompletionDate.trim(),
    });
    setLoading(false);
    if (result && "fieldErrors" in result && result.fieldErrors) {
      setFieldErrors(result.fieldErrors as unknown as Record<string, string>);
      return;
    }
    if (result?.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSave}
      className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-4 sm:p-5"
    >
      <h2 className="text-sm font-semibold text-zinc-900">Edit draft</h2>
      <p className="mt-1 text-xs text-zinc-600">
        You can change this draft until you send it for approval. Previous job total for this change
        order is fixed at ${previousTotal.toLocaleString()} (snapshot when it was created).
      </p>

      {error && (
        <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="mt-4 space-y-3">
        <div>
          <label className="block text-xs font-medium text-zinc-700">Title *</label>
          <input
            value={changeTitle}
            onChange={(e) => setChangeTitle(e.target.value)}
            className="mt-1 block w-full rounded border border-zinc-300 px-3 py-2 text-sm"
          />
          {fieldErrors.change_title && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.change_title}</p>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-700">Description *</label>
          <textarea
            rows={3}
            value={changeDescription}
            onChange={(e) => setChangeDescription(e.target.value)}
            className="mt-1 block w-full rounded border border-zinc-300 px-3 py-2 text-sm"
          />
          {fieldErrors.change_description && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.change_description}</p>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-700">Reason for change</label>
          <input
            value={reasonForChange}
            onChange={(e) => setReasonForChange(e.target.value)}
            className="mt-1 block w-full rounded border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-700">New job total *</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={newJobTotal}
            onChange={(e) => setNewJobTotal(e.target.value)}
            className="mt-1 block w-full rounded border border-zinc-300 px-3 py-2 text-sm"
          />
          {fieldErrors.new_job_total && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.new_job_total}</p>
          )}
          {newJobTotal.trim() !== "" && (
            <div className="mt-2 rounded border border-blue-200 bg-blue-50/90 p-3 text-sm">
              <p className="font-medium text-blue-950">Live pricing summary</p>
              {!showLive ? (
                <p className="mt-1 text-blue-900/90">Enter a valid total greater than zero.</p>
              ) : (
                <ul className="mt-2 space-y-1 text-blue-950">
                  <li className="flex justify-between gap-4">
                    <span className="text-blue-800">Previous total (snapshot)</span>
                    <span className="font-medium">${previousTotal.toLocaleString()}</span>
                  </li>
                  <li className="flex justify-between gap-4">
                    <span className="text-blue-800">New total</span>
                    <span className="font-medium">${liveNum!.toLocaleString()}</span>
                  </li>
                  <li className="flex justify-between gap-4 border-t border-blue-200 pt-1">
                    <span className="text-blue-800">Change</span>
                    <span
                      className={
                        liveChange! >= 0 ? "font-semibold text-green-800" : "font-semibold text-red-800"
                      }
                    >
                      {liveChange! >= 0 ? "+" : ""}
                      {liveChange!.toLocaleString()}
                    </span>
                  </li>
                </ul>
              )}
            </div>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-zinc-700">Est. start *</label>
            <input
              type="date"
              value={newEstimatedStartDate}
              onChange={(e) => setNewEstimatedStartDate(e.target.value)}
              className="mt-1 block w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            />
            {fieldErrors.new_estimated_start_date && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.new_estimated_start_date}</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700">Est. completion *</label>
            <input
              type="date"
              value={newEstimatedCompletionDate}
              onChange={(e) => setNewEstimatedCompletionDate(e.target.value)}
              className="mt-1 block w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            />
            {fieldErrors.new_estimated_completion_date && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.new_estimated_completion_date}</p>
            )}
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="mt-4 rounded-lg bg-[#2436BB] px-4 py-2 text-sm font-medium text-white hover:bg-[#1c2a96] disabled:opacity-70"
      >
        {loading ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
