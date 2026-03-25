"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signChangeOrderRemote } from "@/app/(app)/actions";

export function ChangeOrderRemoteSigningForm({ token }: { token: string }) {
  const router = useRouter();
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [signerPhone, setSignerPhone] = useState("");
  const [consentChecked, setConsentChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signChangeOrderRemote(token, {
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

    setSuccess(true);
    router.refresh();
  }

  if (success) {
    return (
      <div className="mt-6 rounded-lg bg-green-50 p-4 text-green-800">
        <p className="font-medium">Change order signed successfully!</p>
        <p className="mt-1 text-sm">
          Thank you for signing. The contractor has been notified.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div>
        <label
          htmlFor="signerName"
          className="block text-sm font-medium text-zinc-700"
        >
          Full name <span className="text-red-500">*</span>
        </label>
        <input
          id="signerName"
          type="text"
          required
          value={signerName}
          onChange={(e) => setSignerName(e.target.value)}
          placeholder="Your full legal name"
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 placeholder-zinc-400 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
        />
      </div>

      <div>
        <label
          htmlFor="signerEmail"
          className="block text-sm font-medium text-zinc-700"
        >
          Email <span className="text-red-500">*</span>
        </label>
        <input
          id="signerEmail"
          type="email"
          required
          value={signerEmail}
          onChange={(e) => setSignerEmail(e.target.value)}
          placeholder="your@email.com"
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 placeholder-zinc-400 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
        />
      </div>

      <div>
        <label
          htmlFor="signerPhone"
          className="block text-sm font-medium text-zinc-700"
        >
          Phone
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

      <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-900">
        By signing below, you agree this change order is a legally binding amendment to your contract.
      </p>

      <div>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            required
            checked={consentChecked}
            onChange={(e) => setConsentChecked(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-zinc-300 text-[#2436BB] focus:ring-[#2436BB]"
          />
          <span className="text-sm text-zinc-700">
            I have read this change order and approve the amendment. I confirm I am authorized to sign
            on behalf of the customer where applicable.
          </span>
        </label>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="mt-4 w-full rounded-lg bg-[#2436BB] px-6 py-3 font-medium text-white transition-colors hover:bg-[#1c2a96] focus:outline-none focus:ring-2 focus:ring-[#2436BB] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading ? "Signing..." : "Sign change order"}
      </button>
    </form>
  );
}
