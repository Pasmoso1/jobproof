"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { regenerateStudioCampaignCopy } from "@/lib/partners/studio/actions";
import { STUDIO_COPY_VARIANTS } from "@/lib/partners/studio/catalog";

export function StudioCopyVariantBar({
  campaignId,
  currentVariant,
}: {
  campaignId: string;
  currentVariant: string;
}) {
  const router = useRouter();
  const [variant, setVariant] = useState(currentVariant);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onRegenerate(next: string) {
    setVariant(next);
    setError(null);
    startTransition(async () => {
      const result = await regenerateStudioCampaignCopy(campaignId, next);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-zinc-900">Copy variations</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Regenerate copy instantly. Graphics stay the same.
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {STUDIO_COPY_VARIANTS.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={pending}
            onClick={() => onRegenerate(item.id)}
            className={`inline-flex min-h-11 items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2436BB] disabled:opacity-60 ${
              variant === item.id
                ? "bg-[#2436BB] text-white"
                : "border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      {pending ? (
        <p className="mt-3 text-sm text-zinc-500" aria-live="polite">
          Writing copy…
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
