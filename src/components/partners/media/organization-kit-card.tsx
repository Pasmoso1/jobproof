"use client";

import { useId } from "react";
import type { OrganizationKitItem } from "@/lib/partners/organization-partner-kit";
import type { OrganizationKitContext } from "@/lib/partners/organization-partner-kit";

function downloadBlob(content: string, fileName: string, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function OrganizationKitCard({
  item,
  context,
}: {
  item: OrganizationKitItem;
  context: OrganizationKitContext;
}) {
  const labelId = useId();
  const descriptionId = useId();

  return (
    <article
      className="flex h-full flex-col rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
      aria-labelledby={labelId}
      aria-describedby={descriptionId}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 id={labelId} className="text-base font-semibold text-zinc-900">
          {item.name}
        </h3>
        <span className="shrink-0 rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1 text-[11px] font-medium text-zinc-600">
          {item.previewLabel}
        </span>
      </div>
      <p id={descriptionId} className="mt-2 flex-1 text-sm leading-relaxed text-zinc-600">
        {item.description}
      </p>
      <p className="mt-3 text-xs text-zinc-500">
        Recommended use: {item.recommendedUse}
      </p>
      <p className="mt-2 text-xs text-zinc-500">
        Includes your referral URL, code, and QR where appropriate.
      </p>
      <button
        type="button"
        className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#2436BB] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1c2a96] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2436BB]"
        aria-label={`Download ${item.name}`}
        onClick={() => {
          const content = item.build(context);
          downloadBlob(content, item.fileName, item.mime);
        }}
      >
        Download
      </button>
    </article>
  );
}
