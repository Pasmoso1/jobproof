"use client";

import { useState } from "react";

export function CopyContentCard({
  title,
  intendedUse,
  body,
}: {
  title: string;
  intendedUse: string;
  body: string;
}) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <article className="flex h-full flex-col rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-semibold text-zinc-900">{title}</h3>
      <p className="mt-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
        {intendedUse}
      </p>
      <p className="mt-3 flex-1 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">
        {body}
      </p>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={onCopy}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2436BB] focus-visible:ring-offset-2"
        >
          Copy
        </button>
        <span className="text-sm text-zinc-500" aria-live="polite">
          {copied ? "Copied" : ""}
        </span>
      </div>
    </article>
  );
}
