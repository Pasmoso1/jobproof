"use client";

import { useState } from "react";
import { updatePartnerPaymentEmail } from "../actions";

export function PartnerPaymentEmailForm({ initialEmail }: { initialEmail: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <form
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
      onSubmit={async (e) => {
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
        setMessage("Payment email updated.");
      }}
    >
      <div className="min-w-0 flex-1">
        <label htmlFor="payment_email" className="block text-sm font-medium text-zinc-700">
          Payment email
        </label>
        <input
          id="payment_email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-[#2436BB] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1c2a96] disabled:opacity-60"
      >
        {loading ? "Saving…" : "Save"}
      </button>
      {message ? <p className="w-full text-sm text-green-700">{message}</p> : null}
      {error ? <p className="w-full text-sm text-red-600">{error}</p> : null}
    </form>
  );
}
