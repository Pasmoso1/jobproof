"use client";

import { useState, useTransition } from "react";
import { retryStripeBillingAddressSync } from "./actions";

export function StripeBillingAddressRetryButton() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="mt-2 space-y-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setMessage(null);
          setError(null);
          startTransition(async () => {
            const result = await retryStripeBillingAddressSync();
            if (result.success) {
              setMessage(result.message);
            } else {
              setError(result.error);
            }
          });
        }}
        className="text-sm font-medium text-[#2436BB] underline-offset-2 hover:underline disabled:opacity-50"
      >
        {pending ? "Syncing…" : "Retry billing address sync"}
      </button>
      {message ? <p className="text-xs text-green-800">{message}</p> : null}
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
