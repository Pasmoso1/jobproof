type MediaPreviewTone = "light" | "dark" | "checkered";

const TONE_CLASS: Record<MediaPreviewTone, string> = {
  light: "bg-white",
  dark: "bg-[#1A2558]",
  checkered:
    "bg-[length:16px_16px] bg-[linear-gradient(45deg,#e4e4e7_25%,transparent_25%,transparent_75%,#e4e4e7_75%,#e4e4e7),linear-gradient(45deg,#e4e4e7_25%,#fafafa_25%,#fafafa_75%,#e4e4e7_75%,#e4e4e7)] bg-[position:0_0,8px_8px]",
};

export function MediaAssetCard({
  asset,
}: {
  asset: {
    name: string;
    description: string;
    recommendedUse?: string;
    availableFormats?: string;
    previewSrc: string;
    previewAlt: string;
    dimensionsLabel: string;
    previewTone?: MediaPreviewTone;
    downloads: Array<{ label: string; href: string; fileName: string }>;
  };
}) {
  const tone = asset.previewTone ?? "light";

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      {/*
        Fixed min-height preview box so logos stay visible on mobile.
        Use native <img> to avoid Next/Image width/height collapse on small screens.
      */}
      <div
        className={`flex min-h-[140px] w-full items-center justify-center overflow-hidden p-5 sm:min-h-[168px] sm:p-6 ${TONE_CLASS[tone]}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={asset.previewSrc}
          alt={asset.previewAlt}
          className="h-full max-h-32 w-full object-contain object-center sm:max-h-36"
          loading="lazy"
          decoding="async"
        />
      </div>
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <h3 className="text-base font-semibold text-zinc-900">{asset.name}</h3>
        <p className="mt-1 text-sm text-zinc-600">{asset.description}</p>
        {asset.recommendedUse ? (
          <p className="mt-3 text-sm text-zinc-700">
            <span className="font-medium text-zinc-900">Recommended use:</span>{" "}
            {asset.recommendedUse}
          </p>
        ) : null}
        <p className="mt-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
          {asset.availableFormats ?? asset.dimensionsLabel}
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {asset.downloads.map((d) => (
            <a
              key={d.href}
              href={d.href}
              download={d.fileName}
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#2436BB] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1c2a96] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2436BB] focus-visible:ring-offset-2 sm:min-h-0 sm:py-1.5"
            >
              {d.label}
            </a>
          ))}
        </div>
      </div>
    </article>
  );
}
