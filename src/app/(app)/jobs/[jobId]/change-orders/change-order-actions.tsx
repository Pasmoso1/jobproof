"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  sendChangeOrderForSigning,
  sendChangeOrderRemoteSigningLink,
} from "@/app/(app)/actions";
import {
  CHANGE_ORDER_REMOTE_EMAIL_REQUIRED,
  isValidCustomerEmailForChangeOrderRemote,
  validateCustomerEmailForChangeOrderRemote,
} from "@/lib/validation/change-order";

type ChangeOrder = {
  id: string;
  status: string;
  change_title: string | null;
};

export function ChangeOrderActions({
  changeOrder,
  jobId,
  customerEmail,
}: {
  changeOrder: ChangeOrder;
  jobId: string;
  customerEmail?: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<"device" | "email" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  const emailReady = isValidCustomerEmailForChangeOrderRemote(customerEmail);

  if (changeOrder.status === "signed") {
    return (
      <Link
        href={`/jobs/${jobId}/change-orders/${changeOrder.id}`}
        className="text-sm font-medium text-[#2436BB] hover:underline"
      >
        View
      </Link>
    );
  }

  if (changeOrder.status === "declined") {
    return null;
  }

  async function handleDevice() {
    setError(null);
    setEmailError(null);
    setLoading("device");
    try {
      if (changeOrder.status === "draft") {
        const result = await sendChangeOrderForSigning(changeOrder.id, {
          deliveryMethod: "device",
        });
        if (result?.error) {
          setError(result.error);
          return;
        }
      }
      router.push(`/jobs/${jobId}/change-orders/${changeOrder.id}/sign`);
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  async function handleEmail() {
    setError(null);
    setEmailError(null);
    const v = validateCustomerEmailForChangeOrderRemote(customerEmail);
    if (v) {
      setEmailError(v);
      return;
    }
    setLoading("email");
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : undefined;
      const result = await sendChangeOrderRemoteSigningLink({
        changeOrderId: changeOrder.id,
        publicOrigin: origin,
      });
      if (result?.error) {
        setError(result.error);
        if (
          result.error === CHANGE_ORDER_REMOTE_EMAIL_REQUIRED ||
          result.error.toLowerCase().includes("email")
        ) {
          setEmailError(result.error);
        }
        return;
      }
      router.push(`/jobs/${jobId}/change-orders/${changeOrder.id}`);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex max-w-md flex-col items-end gap-2">
      {error && (
        <div className="w-full rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          <p>{error}</p>
          {error.includes("business profile") && (
            <Link
              href="/settings/business"
              className="mt-1 inline-block font-medium text-red-800 underline hover:no-underline"
            >
              Complete business profile →
            </Link>
          )}
        </div>
      )}
      {emailError && (
        <p className="w-full text-right text-sm text-red-600" role="alert">
          {emailError}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={handleDevice}
          disabled={!!loading}
          className="rounded-lg bg-[#2436BB] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#1c2a96] disabled:opacity-70"
        >
          {loading === "device" ? "Opening…" : "Sign on device"}
        </button>
        <button
          type="button"
          onClick={handleEmail}
          disabled={!!loading || !emailReady}
          title={
            !emailReady
              ? CHANGE_ORDER_REMOTE_EMAIL_REQUIRED
              : changeOrder.status === "draft"
                ? "Email a signing link to the customer"
                : "Resend signing link by email"
          }
          className="rounded-lg border border-[#2436BB] px-3 py-1.5 text-sm font-medium text-[#2436BB] hover:bg-[#2436BB]/5 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading === "email"
            ? "Sending…"
            : changeOrder.status === "draft"
              ? "Send by email"
              : "Resend email"}
        </button>
      </div>
    </div>
  );
}
