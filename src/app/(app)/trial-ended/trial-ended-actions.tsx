"use client";

import { useTransition } from "react";
import {
  continueInReadOnlyAfterTrialExpired,
  continueToBillingAfterTrialExpired,
} from "./actions";

export function TrialEndedActions() {
  const [pending, startTransition] = useTransition();

  return (
    <div className="mt-8 flex flex-col items-stretch gap-3 sm:items-center">
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => void continueToBillingAfterTrialExpired())}
        className="inline-flex w-full items-center justify-center rounded-lg bg-[#2436BB] px-6 py-3 text-base font-semibold text-white hover:bg-[#1c2a96] disabled:opacity-60 sm:w-auto sm:min-w-[14rem]"
      >
        {pending ? "Continuing…" : "Continue to Billing"}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => void continueInReadOnlyAfterTrialExpired())}
        className="inline-flex w-full items-center justify-center rounded-lg border border-zinc-300 bg-white px-6 py-3 text-base font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-60 sm:w-auto sm:min-w-[14rem]"
      >
        Continue in Read-Only Mode
      </button>
    </div>
  );
}
