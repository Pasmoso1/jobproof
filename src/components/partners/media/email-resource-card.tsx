"use client";

import { useState } from "react";

export function EmailResourceCard({
  title,
  description,
  textBody,
  htmlHref,
  htmlFileName,
  subjects,
}: {
  title: string;
  description: string;
  textBody: string;
  htmlHref?: string;
  htmlFileName?: string;
  subjects?: string[];
}) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(textBody);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <article className="flex h-full flex-col rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-semibold text-zinc-900">{title}</h3>
      <p className="mt-1 text-sm text-zinc-600">{description}</p>
      {subjects && subjects.length > 0 ? (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Subject line suggestions
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-700">
            {subjects.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <pre className="mt-4 max-h-48 flex-1 overflow-auto whitespace-pre-wrap rounded-lg border border-zinc-100 bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-700">
        {textBody}
      </pre>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {htmlHref ? (
          <a
            href={htmlHref}
            download={htmlFileName}
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#2436BB] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1c2a96] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2436BB] focus-visible:ring-offset-2 sm:min-h-0 sm:py-1.5"
          >
            Download HTML
          </a>
        ) : null}
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2436BB] focus-visible:ring-offset-2 sm:min-h-0 sm:py-1.5"
        >
          {copied ? "Copied" : "Copy text"}
        </button>
      </div>
    </article>
  );
}
