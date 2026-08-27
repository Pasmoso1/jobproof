"use client";

import { useState } from "react";
import { updatePartnerPaymentEmail } from "../actions";
import {
  PARTNER_MISSING_PAYMENT_EMAIL_PROMPT,
  PARTNER_PAYMENT_EMAIL_HELPER,
  PARTNER_PAYMENT_METHOD_LABEL,
  hasPartnerPaymentEmail,
} from "@/lib/partners/payment-details";

export function PartnerPaymentEmailForm({
  initialEmail,
}: {
  initialEmail: string | null;
}) {
  const [savedEmail, setSavedEmail] = useState(String(initialEmail ?? "").trim());
  const hasSaved = hasPartnerPaymentEmail(savedEmail);
  const [editing, setEditing] = useState(!hasPartnerPaymentEmail(initialEmail));
  const [email, setEmail] = useState(savedEmail);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);
    const fd = new FormData();
    fd.set("payment_email", email);
    const result = await updatePartnerPaymentEmail(fd);
    setLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    const next = email.trim().toLowerCase();
    setSavedEmail(next);
    setEmail(next);
    setMessage("Payment email updated.");
    setEditing(false);
  }

  return (
    <div className="space-y-4">
      {!hasSaved ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {PARTNER_MISSING_PAYMENT_EMAIL_PROMPT}
        </p>
      ) : null}

      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Payment method
          </dt>
          <dd className="mt-1 text-sm font-medium text-zinc-900">
            {PARTNER_PAYMENT_METHOD_LABEL}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Payment email
          </dt>
          <dd className="mt-1 break-all text-sm font-medium text-zinc-900">
            {hasSaved ? savedEmail : "Not added"}
          </dd>
        </div>
      </dl>

      {!editing ? (
        <button
          type="button"
          onClick={() => {
            setEditing(true);
            setMessage(null);
            setError(null);
            setEmail(savedEmail);
          }}
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2436BB] focus-visible:ring-offset-2"
        >
          {hasSaved ? "Update payment details" : "Add payment email"}
        </button>
      ) : (
        <form className="space-y-3" onSubmit={(e) => void handleSubmit(e)}>
          <div>
            <label
              htmlFor="payment_email"
              className="block text-sm font-medium text-zinc-700"
            >
              Payment email
            </label>
            <p className="mt-1 text-sm text-zinc-600">{PARTNER_PAYMENT_EMAIL_HELPER}</p>
            <p className="mt-1 text-xs text-zinc-500">
              This can be different from your JobProof login email. It does not change
              how you sign in.
            </p>
            <input
              id="payment_email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-2 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#2436BB] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1c2a96] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2436BB] focus-visible:ring-offset-2 disabled:opacity-60"
            >
              {loading ? "Saving…" : hasSaved ? "Save payment email" : "Add payment email"}
            </button>
            {hasSaved ? (
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  setEditing(false);
                  setEmail(savedEmail);
                  setError(null);
                }}
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      )}

      {message ? <p className="text-sm text-green-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
