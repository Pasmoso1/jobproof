"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signChangeOrderDevice } from "@/app/(app)/actions";

type ChangeOrder = {
  id: string;
  change_title: string | null;
  change_description: string | null;
  reason_for_change: string | null;
  original_contract_price: number | null;
  change_amount: number | null;
  revised_total_price: number | null;
};

export function ChangeOrderDeviceSigningForm({
  changeOrderId,
  jobId,
  changeOrder,
}: {
  changeOrderId: string;
  jobId: string;
  changeOrder: ChangeOrder;
}) {
  const router = useRouter();
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [signerPhone, setSignerPhone] = useState("");
  const [consentChecked, setConsentChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const original = changeOrder.original_contract_price ?? 0;
  const change = changeOrder.change_amount ?? 0;
  const revised = changeOrder.revised_total_price ?? original + change;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signChangeOrderDevice(changeOrderId, {
      signerName: signerName.trim(),
      signerEmail: signerEmail.trim(),
      signerPhone: signerPhone.trim() || undefined,
      consentCheckbox: consentChecked,
    });

    setLoading(false);

    if (result?.error) {
      setError(result.error);
      return;
    }

    router.push(`/jobs/${jobId}/change-orders/${changeOrderId}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
    >
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm text-amber-800">
          <strong>Customer signing:</strong> The customer should enter their information below and sign to approve this change order.
        </p>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
        <h2 className="font-medium text-zinc-900">
          {changeOrder.change_title ?? "Change order"}
        </h2>
        {changeOrder.change_description && (
          <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700">
            {changeOrder.change_description}
          </p>
        )}
        {changeOrder.reason_for_change && (
          <p className="mt-2 text-sm">
            <span className="font-medium text-zinc-600">Reason:</span>{" "}
            {changeOrder.reason_for_change}
          </p>
        )}
        <div className="mt-4 space-y-2 border-t border-zinc-200 pt-4">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-600">Original contract price</span>
            <span className="font-medium text-zinc-900">
              ${original.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-600">Change amount</span>
            <span className={`font-medium ${change >= 0 ? "text-green-700" : "text-red-700"}`}>
              {change >= 0 ? "+" : ""}${change.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between border-t border-zinc-200 pt-2 text-base font-semibold">
            <span className="text-zinc-900">Revised total price</span>
            <span className="text-[#2436BB]">${revised.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div>
        <label htmlFor="signerName" className="block text-sm font-medium text-zinc-700">
          Customer name <span className="text-red-500">*</span>
        </label>
        <input
          id="signerName"
          type="text"
          required
          value={signerName}
          onChange={(e) => setSignerName(e.target.value)}
          placeholder="Customer's full legal name"
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 placeholder-zinc-400 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
        />
      </div>

      <div>
        <label htmlFor="signerEmail" className="block text-sm font-medium text-zinc-700">
          Customer email <span className="text-red-500">*</span>
        </label>
        <input
          id="signerEmail"
          type="email"
          required
          value={signerEmail}
          onChange={(e) => setSignerEmail(e.target.value)}
          placeholder="customer@example.com"
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 placeholder-zinc-400 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
        />
      </div>

      <div>
        <label htmlFor="signerPhone" className="block text-sm font-medium text-zinc-700">
          Customer phone
        </label>
        <input
          id="signerPhone"
          type="tel"
          value={signerPhone}
          onChange={(e) => setSignerPhone(e.target.value)}
          placeholder="(555) 123-4567"
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 placeholder-zinc-400 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
        />
      </div>

      <div className="space-y-3">
        <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-900">
          By signing below, you agree this change order is a legally binding amendment to the contract.
        </p>

        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={consentChecked}
            onChange={(e) => setConsentChecked(e.target.checked)}
            required
            className="mt-1 h-4 w-4 rounded border-zinc-300 text-[#2436BB] focus:ring-[#2436BB]"
          />
          <span className="text-sm text-zinc-700">
            I have read this change order and approve the amendment. I confirm I am authorized to sign
            on behalf of the customer where applicable.
          </span>
        </label>
      </div>

      <div className="flex gap-3 border-t border-zinc-200 pt-6">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-[#2436BB] px-6 py-3 font-medium text-white transition-colors hover:bg-[#1c2a96] focus:outline-none focus:ring-2 focus:ring-[#2436BB] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? "Signing..." : "Customer signs change order"}
        </button>
        <Link
          href={`/jobs/${jobId}/change-orders/${changeOrderId}`}
          className="rounded-lg border border-zinc-300 px-6 py-3 font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
