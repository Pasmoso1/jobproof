"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { markJobComplete } from "@/app/(app)/actions";

export function MarkJobCompleteButton({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setError(null);
    if (
      !window.confirm(
        "Mark this job complete? You can still view updates and create invoices afterward."
      )
    ) {
      return;
    }
    setLoading(true);
    const result = await markJobComplete(jobId);
    setLoading(false);
    if ("error" in result && result.error) {
      setError(result.error);
      return;
    }
    router.push(`/jobs/${jobId}/invoices?jobCompleted=1`);
  }

  return (
    <div className="inline-flex flex-col items-stretch gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className="rounded-lg border border-green-700 bg-green-50 px-4 py-2.5 text-sm font-medium text-green-900 transition-colors hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Saving…" : "Mark job complete"}
      </button>
      {error && (
        <p className="max-w-xs text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
