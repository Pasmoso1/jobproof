"use client";

import { useState, useTransition } from "react";
import {
  removePartnerStudioLogo,
  uploadPartnerStudioLogo,
} from "@/lib/partners/studio/actions";

export function StudioLogoUploader({
  initialLogoUrl,
  organizationName,
}: {
  initialLogoUrl: string | null;
  organizationName: string;
}) {
  const [logoUrl, setLogoUrl] = useState<string | null>(initialLogoUrl);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onUpload(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.set("logo", file);
    setError(null);
    startTransition(async () => {
      const result = await uploadPartnerStudioLogo(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setLogoUrl(result.logoUrl);
    });
  }

  function onRemove() {
    setError(null);
    startTransition(async () => {
      const result = await removePartnerStudioLogo();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setLogoUrl(null);
    });
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-semibold text-zinc-900">Partner company logo</h3>
      <p className="mt-1 text-sm text-zinc-600">
        Optional. Used tastefully as “Recommended by {organizationName}” without
        overpowering JobProof branding. PNG preferred; SVG accepted. Transparent PNG
        recommended.
      </p>

      {logoUrl ? (
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex h-24 w-full items-center justify-center rounded-xl border border-zinc-100 bg-zinc-50 p-3 sm:w-40">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoUrl}
              alt={`${organizationName} logo`}
              className="max-h-20 max-w-full object-contain"
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg bg-[#2436BB] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1c2a96]">
              Replace Logo
              <input
                type="file"
                accept="image/png,image/svg+xml,image/jpeg,image/webp"
                className="sr-only"
                disabled={pending}
                onChange={(e) => onUpload(e.target.files)}
              />
            </label>
            <button
              type="button"
              onClick={onRemove}
              disabled={pending}
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
            >
              Remove Logo
            </button>
          </div>
        </div>
      ) : (
        <label className="mt-4 flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-6 text-center hover:border-[#2436BB]/40">
          <span className="text-sm font-medium text-zinc-800">Upload company logo</span>
          <span className="mt-1 text-xs text-zinc-500">PNG, SVG, JPEG, or WebP · max 5 MB</span>
          <input
            type="file"
            accept="image/png,image/svg+xml,image/jpeg,image/webp"
            className="sr-only"
            disabled={pending}
            onChange={(e) => onUpload(e.target.files)}
          />
        </label>
      )}

      {pending ? (
        <p className="mt-3 text-sm text-zinc-500" aria-live="polite">
          Saving logo…
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
