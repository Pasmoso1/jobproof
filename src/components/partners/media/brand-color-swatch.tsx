"use client";

import { useState } from "react";

export function BrandColorSwatch({
  name,
  hex,
  note,
}: {
  name: string;
  hex: string;
  note?: string;
}) {
  const [copied, setCopied] = useState(false);
  const isLight = hex.toUpperCase() === "#FFFFFF";

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(hex);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div
        className={`h-16 w-full rounded-lg ${isLight ? "border border-zinc-200" : ""}`}
        style={{ backgroundColor: hex }}
        aria-hidden="true"
      />
      <p className="mt-3 text-sm font-semibold text-zinc-900">{name}</p>
      <p className="mt-0.5 font-mono text-sm text-zinc-700">{hex}</p>
      {note ? <p className="mt-1 text-xs text-zinc-500">{note}</p> : null}
      <button
        type="button"
        onClick={onCopy}
        className="mt-3 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2436BB] focus-visible:ring-offset-2"
        aria-label={`Copy ${name} colour ${hex}`}
      >
        {copied ? "Copied" : "Copy hex"}
      </button>
      <span className="sr-only" aria-live="polite">
        {copied ? `${hex} copied` : ""}
      </span>
    </div>
  );
}
