"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  closeQuoteRequest,
  convertQuoteRequestPlaceholder,
  declineQuoteRequest,
  markQuoteRequestResponded,
  markQuoteRequestReviewed,
  markQuoteRequestSiteVisit,
} from "../quote-request-actions";
import type { QuoteRequestDeclineReason } from "@/lib/quote-requests/decline-notifications";
import { isScopeFit } from "@/lib/quote-requests/scope-assessment";

function isOutOfScope(scopeFit: string | null): boolean {
  return scopeFit === "outside_scope" || scopeFit === "possibly_out_of_scope";
}

function isInScopeForDecline(scopeFit: string | null): boolean {
  if (!scopeFit) return true;
  return scopeFit === "within_scope" || scopeFit === "mixed_scope";
}

export function QuoteRequestActionButtons({
  requestId,
  scopeFit,
  status,
}: {
  requestId: string;
  scopeFit: string | null;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const normalizedScope = scopeFit && isScopeFit(scopeFit) ? scopeFit : null;
  const isClosed = status === "closed";
  const showOutOfScopeDeclines = !isClosed && isOutOfScope(normalizedScope);
  const showInScopeDeclines = !isClosed && isInScopeForDecline(normalizedScope);

  async function run(label: string, fn: () => Promise<{ success: boolean; error?: string }>) {
    setBusy(label);
    setError(null);
    setMessage(null);
    setWarning(null);
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

  async function runSiteVisit() {
    setBusy("Request site visit");
    setError(null);
    setMessage(null);
    setWarning(null);
    try {
      const result = await markQuoteRequestSiteVisit(requestId);
      if (!result.success) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      const sentParts: string[] = [];
      const warningParts: string[] = [];

      if (result.emailSent) {
        sentParts.push("email");
      } else if (result.emailWarning) {
        warningParts.push(result.emailWarning);
      }

      if (result.smsSent) {
        sentParts.push("text");
      } else if (result.smsWarning) {
        warningParts.push(result.smsWarning);
      }

      if (sentParts.length > 0) {
        const channelLabel =
          sentParts.length === 2
            ? "Customer email and text sent"
            : sentParts[0] === "email"
              ? "Customer email sent"
              : "Customer text sent";
        setMessage(`Site visit requested. ${channelLabel}.`);
      } else {
        setMessage("Site visit requested.");
      }

      if (warningParts.length > 0) {
        setWarning(warningParts.join(" "));
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function runDecline(label: string, reason: QuoteRequestDeclineReason) {
    setBusy(label);
    setError(null);
    setMessage(null);
    setWarning(null);
    try {
      const result = await declineQuoteRequest(requestId, reason);
      if (!result.success) {
        setError(result.error ?? "Something went wrong.");
        return;
      }

      const sentParts: string[] = [];
      const warningParts: string[] = [];

      if (result.emailSent) sentParts.push("email");
      else if (result.emailWarning) warningParts.push(result.emailWarning);

      if (result.smsSent) sentParts.push("text");
      else if (result.smsWarning) warningParts.push(result.smsWarning);

      if (sentParts.length > 0) {
        setMessage(
          `${label}. Customer notified by ${sentParts.join(" and ")}. Request closed.`
        );
      } else {
        setMessage(`${label}. Request closed.`);
      }

      if (warningParts.length > 0) {
        setWarning(warningParts.join(" "));
      }

      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const disabled = busy !== null;

  return (
    <div className="space-y-4">
      {message ? (
        <p className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
          {message}
        </p>
      ) : null}
      {warning ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {warning}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      {!isClosed ? (
        <>
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
              onClick={() => void runSiteVisit()}
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

          {(showOutOfScopeDeclines || showInScopeDeclines) && (
            <div className="border-t border-zinc-100 pt-4">
              <p className="mb-2 text-sm font-medium text-zinc-700">Quick decline</p>
              <p className="mb-3 text-xs text-zinc-500">
                Sends a polite email and text to the customer, closes the request, and adds a history
                entry.
              </p>
              <div className="flex flex-wrap gap-2">
                {showOutOfScopeDeclines ? (
                  <>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() =>
                        void runDecline(
                          "Service not offered message sent",
                          "service_not_offered"
                        )
                      }
                      className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
                    >
                      {busy === "Service not offered message sent"
                        ? "Sending…"
                        : "This isn't a service we offer"}
                    </button>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() =>
                        void runDecline("Not the right fit message sent", "not_good_fit")
                      }
                      className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
                    >
                      {busy === "Not the right fit message sent"
                        ? "Sending…"
                        : "This project isn't the right fit"}
                    </button>
                  </>
                ) : null}
                {showInScopeDeclines ? (
                  <>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() =>
                        void runDecline("Capacity message sent", "capacity")
                      }
                      className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
                    >
                      {busy === "Capacity message sent"
                        ? "Sending…"
                        : "We aren't taking on new projects"}
                    </button>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() =>
                        void runDecline("Not the right fit message sent", "not_good_fit")
                      }
                      className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
                    >
                      {busy === "Not the right fit message sent"
                        ? "Sending…"
                        : "This project isn't the right fit"}
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-zinc-600">This request is closed.</p>
      )}
    </div>
  );
}
