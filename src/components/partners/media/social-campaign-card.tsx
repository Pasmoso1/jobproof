"use client";

import { useState } from "react";

type CampaignFormat = {
  id: string;
  label: string;
  dimensionsLabel: string;
  href: string;
  fileName: string;
  width: number;
  height: number;
};

export function SocialCampaignCard({
  campaign,
  caption,
}: {
  campaign: {
    id: string;
    title: string;
    shortDescription: string;
    headline: string;
    formats: CampaignFormat[];
  };
  caption: string;
}) {
  const [copied, setCopied] = useState(false);
  const square =
    campaign.formats.find((f) => f.id === "square") ?? campaign.formats[0];
  const previewAspect = square
    ? `${square.width} / ${square.height}`
    : "1 / 1";

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div
        className="relative w-full overflow-hidden bg-[#1A2558]"
        style={{ aspectRatio: previewAspect }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={square?.href}
          alt={`${campaign.title} — JobProof social graphic`}
          className="h-full w-full object-contain object-center"
          loading="lazy"
          decoding="async"
        />
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
        <div>
          <h3 className="text-base font-semibold text-zinc-900 sm:text-lg">
            {campaign.title}
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-zinc-600">
            {campaign.shortDescription}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          {campaign.formats.map((format) => (
            <a
              key={format.id}
              href={format.href}
              download={format.fileName}
              className="inline-flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm font-medium text-zinc-900 hover:border-[#2436BB]/40 hover:bg-[#2436BB]/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2436BB] focus-visible:ring-offset-2 sm:min-h-0"
            >
              <span>{format.label}</span>
              <span className="shrink-0 text-xs font-normal text-zinc-500">
                {format.dimensionsLabel}
              </span>
            </a>
          ))}
        </div>

        <div className="mt-auto rounded-xl border border-zinc-100 bg-zinc-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Suggested caption
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">
            {caption}
          </p>
          <button
            type="button"
            className="mt-3 inline-flex min-h-11 items-center justify-center rounded-lg bg-[#2436BB] px-4 py-2 text-sm font-medium text-white hover:bg-[#1c2a96] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2436BB] focus-visible:ring-offset-2 sm:min-h-0"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(caption);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 2000);
              } catch {
                /* ignore */
              }
            }}
          >
            {copied ? "Caption copied" : "Copy caption"}
          </button>
        </div>
      </div>
    </article>
  );
}
