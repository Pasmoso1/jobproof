"use client";

import { useState } from "react";
import type { PrintResource } from "@/lib/partners/print-assets";

const PREVIEW_SHELL: Record<PrintResource["previewStyle"], string> = {
  letter: "mx-auto w-full max-w-[320px] sm:max-w-[360px]",
  half: "mx-auto w-full max-w-[420px]",
  rack: "mx-auto w-full max-w-[220px]",
  poster: "mx-auto w-full max-w-[260px]",
};

function apiUrl(assetId: string, format: "png" | "pdf"): string {
  return `/api/partner/media/print/${assetId}?format=${format}`;
}

export function PrintResourceCard({
  resource,
  referralUrl,
}: {
  resource: PrintResource;
  referralUrl: string | null;
}) {
  const isRack = resource.sides?.includes("front") && resource.sides?.includes("back");
  const [activeSide, setActiveSide] = useState<"front" | "back">("front");

  const frontApiId = resource.downloadApiId;
  const backApiId = "rack-card-back" as const;
  const activeApiId = isRack && activeSide === "back" ? backApiId : frontApiId;

  const aspect = `${resource.width} / ${resource.height}`;
  const shell = PREVIEW_SHELL[resource.previewStyle];
  const previewSrc = referralUrl
    ? apiUrl(activeApiId, "png")
    : isRack && activeSide === "back"
      ? "/media-kit/print/rack-card/jobproof-rack-card-back.png"
      : resource.basePreviewSrc;

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-100 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="text-base font-semibold text-zinc-900 sm:text-lg">
            {resource.title}
          </h3>
          {resource.hasPersonalizedQr ? (
            <span className="inline-flex rounded-full bg-[#2436BB]/10 px-2.5 py-1 text-xs font-semibold text-[#2436BB]">
              Includes your personalized QR
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-zinc-600">
          <span className="font-medium text-zinc-800">Best for:</span>{" "}
          {resource.bestFor}
        </p>
        <p className="mt-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
          {resource.dimensionsLabel}
        </p>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        {isRack ? (
          <div
            className="flex flex-wrap gap-2"
            role="tablist"
            aria-label={`${resource.title} sides`}
          >
            {(["front", "back"] as const).map((side) => {
              const selected = activeSide === side;
              return (
                <button
                  key={side}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  className={`inline-flex min-h-11 items-center rounded-lg border px-3 py-2 text-sm font-medium capitalize focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2436BB] focus-visible:ring-offset-2 sm:min-h-0 ${
                    selected
                      ? "border-[#2436BB] bg-[#2436BB] text-white"
                      : "border-zinc-200 bg-zinc-50 text-zinc-800 hover:border-[#2436BB]/40"
                  }`}
                  onClick={() => setActiveSide(side)}
                >
                  {side}
                </button>
              );
            })}
          </div>
        ) : null}

        <div className={`overflow-hidden rounded-xl bg-zinc-50 ${shell}`}>
          <div style={{ aspectRatio: aspect }} className="w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewSrc}
              alt={`${resource.title} preview`}
              className="h-full w-full object-contain object-center"
              loading="lazy"
              decoding="async"
            />
          </div>
        </div>

        {!referralUrl ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
            Personalized QR unavailable — your referral link is not ready yet.
            Base previews are shown without a partner QR. Downloads unlock once
            your referral link is available.
          </p>
        ) : (
          <p className="text-xs leading-relaxed text-zinc-500">
            Your QR code links contractors through your JobProof referral link
            {isRack
              ? ". Front includes the QR; back includes your referral URL."
              : "."}
          </p>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {referralUrl ? (
            <>
              <a
                href={apiUrl(activeApiId, "pdf")}
                download
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg bg-[#2436BB] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1c2a96] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2436BB] focus-visible:ring-offset-2 sm:min-h-0 sm:flex-none"
              >
                Download PDF
              </a>
              <a
                href={apiUrl(activeApiId, "png")}
                download
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 hover:border-[#2436BB]/40 hover:bg-[#2436BB]/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2436BB] focus-visible:ring-offset-2 sm:min-h-0 sm:flex-none"
              >
                Download PNG
              </a>
            </>
          ) : null}
        </div>
      </div>
    </article>
  );
}
