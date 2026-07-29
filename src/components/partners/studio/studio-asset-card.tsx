"use client";

import { useState, useTransition } from "react";
import type { StudioCampaignAssetRow } from "@/lib/partners/studio/types";
import { recordStudioDownload } from "@/lib/partners/studio/actions";

async function copyText(value: string) {
  await navigator.clipboard.writeText(value);
}

export function StudioAssetCard({
  campaignId,
  asset,
  referralUrl,
}: {
  campaignId: string;
  asset: StudioCampaignAssetRow;
  referralUrl: string;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function markCopied(key: string) {
    setCopied(key);
    window.setTimeout(() => setCopied(null), 2000);
  }

  function track(downloadType: string) {
    startTransition(async () => {
      await recordStudioDownload({
        campaignId,
        assetId: asset.id,
        downloadType,
      });
    });
  }

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex min-h-[140px] items-center justify-center bg-zinc-50 p-4">
        {asset.preview_src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={asset.preview_src}
            alt={`${asset.title} preview`}
            className="max-h-40 w-auto max-w-full object-contain"
          />
        ) : (
          <p className="text-sm text-zinc-500">No preview</p>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <h3 className="text-base font-semibold text-zinc-900">{asset.title}</h3>

        {asset.caption ? (
          <pre className="mt-3 max-h-32 overflow-auto whitespace-pre-wrap rounded-lg border border-zinc-100 bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-700">
            {asset.caption}
          </pre>
        ) : null}

        {asset.email_subject ? (
          <p className="mt-3 text-sm text-zinc-700">
            <span className="font-medium text-zinc-900">Subject:</span>{" "}
            {asset.email_subject}
          </p>
        ) : null}

        <div className="mt-4 flex flex-col gap-2">
          {asset.download_href ? (
            <a
              href={asset.download_href}
              download={asset.download_file_name ?? undefined}
              target={asset.asset_kind === "qr" ? "_blank" : undefined}
              rel="noreferrer"
              onClick={() => track("primary_download")}
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#2436BB] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1c2a96]"
            >
              {asset.asset_kind === "print"
                ? "Download PDF"
                : asset.asset_kind === "qr"
                  ? "Download PNG"
                  : asset.download_file_name?.endsWith(".pdf")
                    ? "Download PDF"
                    : "Download PNG"}
            </a>
          ) : null}

          {asset.secondary_download_href ? (
            <a
              href={asset.secondary_download_href}
              download={asset.secondary_download_file_name ?? undefined}
              target={asset.asset_kind === "qr" ? "_blank" : undefined}
              rel="noreferrer"
              onClick={() => track("secondary_download")}
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
            >
              {asset.asset_kind === "qr"
                ? "High-resolution Print QR"
                : "Download PNG"}
            </a>
          ) : null}

          {asset.caption ? (
            <button
              type="button"
              onClick={async () => {
                await copyText(asset.caption!);
                markCopied("caption");
              }}
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
            >
              {copied === "caption" ? "Copied" : "Copy Caption"}
            </button>
          ) : null}

          {asset.post_body && asset.post_body !== asset.caption ? (
            <button
              type="button"
              onClick={async () => {
                await copyText(asset.post_body!);
                markCopied("post");
              }}
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
            >
              {copied === "post" ? "Copied" : "Copy Post"}
            </button>
          ) : null}

          {asset.email_html ? (
            <button
              type="button"
              onClick={async () => {
                await copyText(asset.email_html!);
                markCopied("html");
              }}
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
            >
              {copied === "html" ? "Copied" : "Copy HTML"}
            </button>
          ) : null}

          {asset.email_text ? (
            <button
              type="button"
              onClick={async () => {
                await copyText(asset.email_text!);
                markCopied("text");
              }}
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
            >
              {copied === "text" ? "Copied" : "Copy Plain Text"}
            </button>
          ) : null}

          {asset.email_subject ? (
            <button
              type="button"
              onClick={async () => {
                await copyText(asset.email_subject!);
                markCopied("subject");
              }}
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
            >
              {copied === "subject" ? "Copied" : "Copy Subject"}
            </button>
          ) : null}

          <button
            type="button"
            onClick={async () => {
              await copyText(referralUrl);
              markCopied("link");
            }}
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
          >
            {copied === "link" ? "Copied" : "Copy Referral Link"}
          </button>
        </div>
      </div>
    </article>
  );
}
