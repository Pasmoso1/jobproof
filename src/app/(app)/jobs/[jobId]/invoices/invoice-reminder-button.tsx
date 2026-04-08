"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sendInvoiceReminder } from "@/app/(app)/actions";

export function InvoiceReminderButton({
  jobId,
  invoiceId,
  invoiceStatus,
  disabled,
  className,
}: {
  jobId: string;
  invoiceId: string;
  invoiceStatus: "sent" | "overdue";
  disabled?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const label =
    invoiceStatus === "overdue" ? "Send overdue reminder" : "Send reminder";

  async function handleClick() {
    setLoading(true);
    const result = await sendInvoiceReminder(invoiceId);
    setLoading(false);

    const p = new URLSearchParams();
    if (result.success) {
      p.set("invNotice", "reminderSent");
    } else {
      p.set("invNotice", "reminderFailed");
      const detail = (result.error ?? "").trim().slice(0, 500);
      if (detail) p.set("invMsg", detail);
    }
    router.replace(`/jobs/${jobId}/invoices?${p.toString()}`);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || loading}
      className={
        className ??
        "rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-950 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
      }
    >
      {loading ? "Sending…" : label}
    </button>
  );
}
