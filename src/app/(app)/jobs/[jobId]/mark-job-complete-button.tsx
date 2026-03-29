"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { markJobComplete } from "@/app/(app)/actions";

export function MarkJobCompleteButton({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function confirmComplete() {
    setError(null);
    setLoading(true);
    const result = await markJobComplete(jobId);
    setLoading(false);
    if ("error" in result && result.error) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.push(`/jobs/${jobId}/invoices?jobCompleted=1`);
  }

  return (
    <div className="inline-flex flex-col items-stretch gap-1">
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        disabled={loading}
        className="rounded-lg border border-green-700 bg-green-50 px-4 py-2.5 text-sm font-medium text-green-900 transition-colors hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Saving…" : "Mark job complete"}
      </button>
      {error && !open && (
        <p className="max-w-xs text-xs text-red-600" role="alert">
          {error}
        </p>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="mark-complete-title"
            className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h2
              id="mark-complete-title"
              className="text-lg font-semibold text-zinc-900"
            >
              Mark job complete?
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-zinc-600">
              You can still view updates, contracts, and invoices afterward.
            </p>
            {error && (
              <p className="mt-3 text-sm text-red-600" role="alert">
                {error}
              </p>
            )}
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
              <button
                ref={cancelRef}
                type="button"
                disabled={loading}
                onClick={() => setOpen(false)}
                className="rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={confirmComplete}
                className="rounded-lg bg-green-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Saving…" : "Mark complete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
