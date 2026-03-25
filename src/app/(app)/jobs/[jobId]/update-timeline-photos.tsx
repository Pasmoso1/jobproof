"use client";

import { useCallback, useEffect, useState } from "react";

export type TimelinePhotoAttachment = {
  id: string;
  file_name: string;
  signedUrl: string | null;
};

export function UpdateTimelinePhotos({
  attachments,
}: {
  attachments: TimelinePhotoAttachment[];
}) {
  const withUrls = attachments.filter((a) => a.signedUrl);
  const [lightbox, setLightbox] = useState<{ url: string; name: string } | null>(
    null
  );

  const close = useCallback(() => setLightbox(null), []);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, close]);

  if (withUrls.length === 0) return null;

  return (
    <>
      <div className="mt-2 flex flex-wrap gap-2">
        {withUrls.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() =>
              a.signedUrl &&
              setLightbox({ url: a.signedUrl, name: a.file_name })
            }
            className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 ring-offset-2 hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-[#2436BB]"
            aria-label={`View larger: ${a.file_name}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- signed blob URLs / remote */}
            <img
              src={a.signedUrl!}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </button>
        ))}
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/85 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Photo preview"
          onClick={close}
        >
          <button
            type="button"
            onClick={close}
            className="absolute right-4 top-4 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/20"
          >
            Close
          </button>
          <p className="mb-2 max-w-full truncate text-center text-sm text-white/90">
            {lightbox.name}
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox.url}
            alt=""
            className="max-h-[min(85vh,900px)] max-w-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
