"use client";

import { useState } from "react";
import type { WebBannerFormatGroup } from "@/lib/partners/web-banners";

const PREVIEW_SHELL: Record<
  WebBannerFormatGroup["previewStyle"],
  string
> = {
  // Wide banners: fill the card width; height follows aspect ratio.
  wide: "w-full bg-[#1A2558]",
  leaderboard: "w-full bg-[#1A2558]",
  // Medium rectangle: cap width so it doesn't pixelate or dominate.
  rectangle: "mx-auto w-full max-w-[300px] bg-[#1A2558]",
  // Skyscraper: centered column, not a full-width absurdly tall card.
  skyscraper: "mx-auto w-[160px] max-w-full bg-[#1A2558]",
};

export function WebBannerFormatGroupCard({
  group,
  referralUrl,
}: {
  group: WebBannerFormatGroup;
  referralUrl: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const primary = group.assets[0];
  const [activeId, setActiveId] = useState(primary?.id ?? "");
  const active =
    group.assets.find((a) => a.id === activeId) ?? group.assets[0];

  if (!active) return null;

  const aspect = `${active.width} / ${active.height}`;
  const shell = PREVIEW_SHELL[group.previewStyle];

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-100 p-4 sm:p-5">
        <h3 className="text-base font-semibold text-zinc-900 sm:text-lg">
          {group.title}
        </h3>
        <p className="mt-1 text-sm text-zinc-600">{group.recommendedUse}</p>
        <p className="mt-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
          PNG · {group.dimensionsLabel}
        </p>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        <div
          className={`overflow-hidden rounded-xl ${shell}`}
          style={{ aspectRatio: aspect }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={active.href}
            alt={`${active.campaignTitle} — JobProof ${group.dimensionsLabel} banner`}
            className="h-full w-full object-contain object-center"
            loading="lazy"
            decoding="async"
          />
        </div>

        <div
          className="flex flex-wrap gap-2"
          role="tablist"
          aria-label={`${group.title} campaigns`}
        >
          {group.assets.map((asset) => {
            const selected = asset.id === active.id;
            return (
              <button
                key={asset.id}
                type="button"
                role="tab"
                aria-selected={selected}
                className={`inline-flex min-h-11 items-center rounded-lg border px-3 py-2 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2436BB] focus-visible:ring-offset-2 sm:min-h-0 ${
                  selected
                    ? "border-[#2436BB] bg-[#2436BB] text-white"
                    : "border-zinc-200 bg-zinc-50 text-zinc-800 hover:border-[#2436BB]/40"
                }`}
                onClick={() => setActiveId(asset.id)}
              >
                {asset.campaignTitle}
              </button>
            );
          })}
        </div>

        <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-3">
          <p className="text-sm font-semibold text-zinc-900">{active.headline}</p>
          {active.supporting ? (
            <p className="mt-1 text-sm text-zinc-600">{active.supporting}</p>
          ) : null}
          <p className="mt-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
            CTA · {active.cta}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <a
            href={active.href}
            download={active.fileName}
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg bg-[#2436BB] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1c2a96] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2436BB] focus-visible:ring-offset-2 sm:min-h-0 sm:flex-none"
          >
            Download PNG
          </a>
          {referralUrl ? (
            <button
              type="button"
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 hover:border-[#2436BB]/40 hover:bg-[#2436BB]/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2436BB] focus-visible:ring-offset-2 sm:min-h-0"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(referralUrl);
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 2000);
                } catch {
                  /* ignore */
                }
              }}
            >
              {copied ? "Link copied" : "Copy referral link"}
            </button>
          ) : null}
        </div>

        <p className="text-xs leading-relaxed text-zinc-500">
          Link this banner to your personal referral URL when you place it on a
          website or newsletter.
        </p>
      </div>
    </article>
  );
}
