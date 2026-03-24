"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { withdrawChangeOrderToDraft } from "@/app/(app)/actions";

export function ChangeOrderWithdrawButton({ changeOrderId }: { changeOrderId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleWithdraw() {
    if (
      !window.confirm(
        "Move this change order back to draft? The customer will no longer be in “awaiting approval” status, and existing email links may stop working until you send again."
      )
    ) {
      return;
    }
    setError(null);
    setLoading(true);
    const result = await withdrawChangeOrderToDraft(changeOrderId);
    setLoading(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      {error && (
        <p className="mb-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={loading}
        onClick={handleWithdraw}
        className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-70"
      >
        {loading ? "Moving…" : "Move back to draft"}
      </button>
    </div>
  );
}
