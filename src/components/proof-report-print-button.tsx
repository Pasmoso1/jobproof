"use client";

import { trackProofReportExportedAction } from "@/app/(app)/product-analytics-actions";

export function ProofReportPrintButton({ jobId }: { jobId: string }) {
  function handlePrint() {
    void trackProofReportExportedAction(jobId).catch(() => undefined);
    window.print();
  }

  return (
    <button
      type="button"
      onClick={handlePrint}
      className="inline-flex items-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 print:hidden"
    >
      Print / save PDF
    </button>
  );
}
