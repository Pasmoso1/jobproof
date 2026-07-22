import Image from "next/image";
import type { MediaAsset } from "@/lib/partners/media-center-content";

export function MediaAssetCard({ asset }: { asset: MediaAsset }) {
  return (
    <article className="flex h-full flex-col rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex min-h-[120px] items-center justify-center rounded-lg border border-zinc-100 bg-zinc-50 p-4">
        <Image
          src={asset.previewSrc}
          alt={asset.previewAlt}
          width={240}
          height={120}
          className="h-auto max-h-24 w-auto max-w-full object-contain"
        />
      </div>
      <h3 className="mt-4 text-base font-semibold text-zinc-900">{asset.name}</h3>
      <p className="mt-1 text-sm text-zinc-600">{asset.description}</p>
      <p className="mt-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
        {asset.dimensionsLabel}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {asset.downloads.map((d) => (
          <a
            key={d.href}
            href={d.href}
            download={d.fileName}
            className="inline-flex rounded-lg bg-[#2436BB] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#1c2a96] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2436BB] focus-visible:ring-offset-2"
          >
            {d.label}
          </a>
        ))}
        {(asset.comingSoonFormats ?? []).map((format) => (
          <span
            key={format}
            className="inline-flex rounded-lg border border-dashed border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-500"
          >
            {format}: Coming soon
          </span>
        ))}
      </div>
    </article>
  );
}
