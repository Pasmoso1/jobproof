"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  duplicateEstimateDraft,
  resendEstimateEmail,
  sendEstimate,
} from "@/app/(app)/estimates/estimate-actions";

export function SendEstimateButton({ estimateId }: { estimateId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={loading}
        onClick={async () => {
          setMsg(null);
          setLoading(true);
          try {
            const res = await sendEstimate(estimateId);
            if ("error" in res) {
              setMsg(res.error);
              return;
            }
            if (!res.emailSent) {
              setMsg(res.emailError ?? "Saved link but email did not send.");
            } else {
              setMsg("Estimate sent to the customer.");
            }
            router.refresh();
          } finally {
            setLoading(false);
          }
        }}
        className="inline-flex rounded-lg bg-[#2436BB] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#1c2a96] disabled:opacity-60"
      >
        {loading ? "Sending…" : "Send estimate to customer"}
      </button>
      {msg && <p className="text-sm text-zinc-700">{msg}</p>}
    </div>
  );
}

export function ResendEstimateEmailButton({
  estimateId,
  prominent = false,
}: {
  estimateId: string;
  /** Stronger styling for expired-estimate recovery. */
  prominent?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const btnClass = prominent
    ? "inline-flex w-full justify-center rounded-lg bg-[#2436BB] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#1c2a96] disabled:opacity-60 sm:w-auto"
    : "inline-flex rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-60";

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={loading}
        onClick={async () => {
          setMsg(null);
          setLoading(true);
          try {
            const res = await resendEstimateEmail(estimateId);
            if ("error" in res) {
              setMsg(res.error);
              return;
            }
            if (!res.emailSent) {
              setMsg(res.emailError ?? "Could not resend email.");
            } else {
              setMsg("Email resent.");
            }
            router.refresh();
          } finally {
            setLoading(false);
          }
        }}
        className={btnClass}
      >
        {loading ? "Sending…" : prominent ? "Resend estimate" : "Resend estimate email"}
      </button>
      {msg && <p className="text-sm text-zinc-700">{msg}</p>}
    </div>
  );
}

export function DuplicateEstimateButton({ estimateId }: { estimateId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={loading}
        onClick={async () => {
          setMsg(null);
          setLoading(true);
          try {
            const res = await duplicateEstimateDraft(estimateId);
            if ("error" in res) {
              setMsg(res.error);
              return;
            }
            router.push(`/estimates/${res.newEstimateId}`);
            router.refresh();
          } finally {
            setLoading(false);
          }
        }}
        className="inline-flex w-full justify-center rounded-lg border border-zinc-300 bg-white px-5 py-2.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-60 sm:w-auto"
      >
        {loading ? "Working…" : "Duplicate estimate"}
      </button>
      {msg && <p className="text-sm text-red-700">{msg}</p>}
    </div>
  );
}
