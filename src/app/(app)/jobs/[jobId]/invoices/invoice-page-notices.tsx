"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

export type InvoicePageNoticeKind = "sent" | "resent" | "draft" | "failed" | null;

export function InvoicePageNotices({
  jobId,
  notice,
  message,
}: {
  jobId: string;
  notice: InvoicePageNoticeKind;
  message: string | null;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!notice) return;
    window.scrollTo({ top: 0, behavior: "smooth" });
    const t = window.setTimeout(() => ref.current?.focus(), 400);
    return () => window.clearTimeout(t);
  }, [notice]);

  if (!notice) return null;

  const base =
    "mb-6 rounded-lg border px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-2";
  const dismiss = (
    <Link
      href={`/jobs/${jobId}/invoices`}
      className="mt-2 inline-block text-sm font-medium underline hover:no-underline"
    >
      Dismiss
    </Link>
  );

  if (notice === "sent") {
    return (
      <div
        ref={ref}
        tabIndex={-1}
        role="status"
        aria-live="polite"
        className={`${base} border-green-200 bg-green-50 text-green-950 focus-visible:ring-green-500`}
      >
        <p className="font-semibold text-green-900">Invoice sent</p>
        <p className="mt-1 text-green-900">
          The invoice was emailed to the customer successfully. Check invoice history below for
          status.
        </p>
        {dismiss}
      </div>
    );
  }

  if (notice === "resent") {
    return (
      <div
        ref={ref}
        tabIndex={-1}
        role="status"
        aria-live="polite"
        className={`${base} border-green-200 bg-green-50 text-green-950 focus-visible:ring-green-500`}
      >
        <p className="font-semibold text-green-900">Invoice resent</p>
        <p className="mt-1 text-green-900">
          The invoice email was sent again. Invoice history below should show the updated status.
        </p>
        {dismiss}
      </div>
    );
  }

  if (notice === "draft") {
    return (
      <div
        ref={ref}
        tabIndex={-1}
        role="status"
        aria-live="polite"
        className={`${base} border-amber-200 bg-amber-50 text-amber-950 focus-visible:ring-amber-500`}
      >
        <p className="font-semibold text-amber-900">Invoice saved as draft</p>
        <p className="mt-1 text-amber-900">
          {message?.trim()
            ? message
            : "The invoice was created but was not emailed. Fix the issue below, then resend from this page."}
        </p>
        {dismiss}
      </div>
    );
  }

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alert"
      aria-live="assertive"
      className={`${base} border-red-200 bg-red-50 text-red-900 focus-visible:ring-red-500`}
    >
      <p className="font-semibold">Could not send invoice email</p>
      <p className="mt-1">
        {message?.trim()
          ? message
          : "Something went wrong. The invoice may still be a draft. Check your email configuration (Resend) and try again."}
      </p>
      {dismiss}
    </div>
  );
}
