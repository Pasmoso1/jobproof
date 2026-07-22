"use client";

import { CopyContentCard } from "@/components/partners/media/copy-content-card";
import { CopyButton } from "@/app/(partner)/partner/copy-button";

export function SocialCaptionCard({
  title,
  intendedUse,
  body,
  referralUrl,
}: {
  title: string;
  intendedUse: string;
  body: string;
  referralUrl: string | null;
}) {
  return (
    <div className="space-y-3">
      <CopyContentCard title={title} intendedUse={intendedUse} body={body} />
      {referralUrl ? (
        <div className="flex flex-wrap gap-2 px-1">
          <CopyButton text={referralUrl} label="Copy referral link" />
          <a
            href={referralUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2436BB] focus-visible:ring-offset-2"
          >
            Open referral page
          </a>
        </div>
      ) : null}
    </div>
  );
}
