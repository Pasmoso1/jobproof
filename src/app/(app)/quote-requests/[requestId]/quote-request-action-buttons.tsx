"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  closeQuoteRequest,
  convertQuoteRequestPlaceholder,
  markQuoteRequestResponded,
  markQuoteRequestReviewed,
  markQuoteRequestSiteVisit,
} from "../quote-request-actions";

export function QuoteRequestActionButtons({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(label: string, fn: () => Promise<{ success: boolean; error?: string }>) {
    setBusy(label);
    setError(null);
    setMessage(null);
    try {
      const result = await fn();
      if (!result.success) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      setMessage(`${label} saved.`);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const disabled = busy !== null;

  return (
    <div className="space-y-3">
      {message ? (
        <p className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => void run("Mark reviewed", () => markQuoteRequestReviewed(requestId))}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
        >
          {busy === "Mark reviewed" ? "Saving…" : "Mark reviewed"}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => void run("Mark responded", () => markQuoteRequestResponded(requestId))}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
        >
          {busy === "Mark responded" ? "Saving…" : "Mark responded"}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => void run("Request site visit", () => markQuoteRequestSiteVisit(requestId))}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
        >
          {busy === "Request site visit" ? "Saving…" : "Request site visit"}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() =>
            void run("Create customer record", () => convertQuoteRequestPlaceholder(requestId))
          }
          className="rounded-lg border border-[#2436BB]/30 bg-[#2436BB]/5 px-3 py-2 text-sm font-medium text-[#2436BB] hover:bg-[#2436BB]/10 disabled:opacity-60"
        >
          Create customer record (coming soon)
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => void run("Close request", () => closeQuoteRequest(requestId))}
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-100 disabled:opacity-60"
        >
          {busy === "Close request" ? "Saving…" : "Close request"}
        </button>
      </div>
    </div>
  );
}
