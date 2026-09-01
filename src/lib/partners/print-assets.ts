/**
 * JobProof Media Kit v2 — Print resource definitions.
 * Paths must match scripts/partner-media-print.mjs output.
 */

export type PrintAssetId =
  | "full-page"
  | "half-page"
  | "rack-card-front"
  | "rack-card-back"
  | "poster";

export const PRINT_ASSET_IDS: PrintAssetId[] = [
  "full-page",
  "half-page",
  "rack-card-front",
  "rack-card-back",
  "poster",
];

export type PrintPreviewStyle = "letter" | "half" | "rack" | "poster";

export type PrintResourceSide = "front" | "back";

export type PrintResource = {
  id: string;
  title: string;
  bestFor: string;
  dimensionsLabel: string;
  width: number;
  height: number;
  previewStyle: PrintPreviewStyle;
  /** Rack card shows front and back tabs. */
  sides?: PrintResourceSide[];
  hasPersonalizedQr: boolean;
  basePreviewSrc: string;
  downloadApiId: PrintAssetId;
};

export const PRINT_QR_SLOTS = {
  "full-page": { left: 1780, top: 1960, size: 520 },
  "half-page": { left: 1860, top: 420, size: 480 },
  "rack-card-front": { left: 280, top: 1480, size: 640 },
  poster: { left: 1050, top: 1780, size: 1200 },
} as const;

export const RACK_BACK_LINK_AREA = {
  left: 90,
  top: 1580,
  width: 1020,
  height: 220,
} as const;

const PRINT_BASE = "/media-kit/print";

function printPngPath(folder: string, fileName: string): string {
  return `${PRINT_BASE}/${folder}/${fileName}`;
}

export const MEDIA_PRINT_RESOURCES: PrintResource[] = [
  {
    id: "full-page-flyer",
    title: "Full-page Flyer",
    bestFor: "Events, handouts, contractor meetings",
    dimensionsLabel: "8.5×11 · 300 DPI",
    width: 2550,
    height: 3300,
    previewStyle: "letter",
    hasPersonalizedQr: true,
    basePreviewSrc: printPngPath("full-page", "jobproof-full-page-flyer.png"),
    downloadApiId: "full-page",
  },
  {
    id: "half-page-flyer",
    title: "Half-page Flyer",
    bestFor: "Counters, handouts, mailers",
    dimensionsLabel: "8.5×5.5 · 300 DPI",
    width: 2550,
    height: 1650,
    previewStyle: "half",
    hasPersonalizedQr: true,
    basePreviewSrc: printPngPath("half-page", "jobproof-half-page-flyer.png"),
    downloadApiId: "half-page",
  },
  {
    id: "rack-card",
    title: "Rack Card",
    bestFor: "Displays, supplier counters, events",
    dimensionsLabel: "4×9 · 300 DPI",
    width: 1200,
    height: 2700,
    previewStyle: "rack",
    sides: ["front", "back"],
    hasPersonalizedQr: true,
    basePreviewSrc: printPngPath("rack-card", "jobproof-rack-card-front.png"),
    downloadApiId: "rack-card-front",
  },
  {
    id: "poster",
    title: "Poster",
    bestFor: "Bulletin boards, events, contractor-focused locations",
    dimensionsLabel: "11×17 · 300 DPI",
    width: 3300,
    height: 5100,
    previewStyle: "poster",
    hasPersonalizedQr: true,
    basePreviewSrc: printPngPath("poster", "jobproof-poster.png"),
    downloadApiId: "poster",
  },
];

/** Legacy compatibility paths still used by Studio static downloads. */
export const PRINT_LEGACY_COMPAT_PATHS = [
  "/media-kit/print/jobproof-flyer-letter.png",
  "/media-kit/print/jobproof-flyer-letter.pdf",
  "/media-kit/print/jobproof-flyer-halfpage.png",
  "/media-kit/print/jobproof-flyer-halfpage.pdf",
  "/media-kit/print/jobproof-rack-card.png",
  "/media-kit/print/jobproof-rack-card.pdf",
  "/media-kit/print/jobproof-poster.png",
  "/media-kit/print/jobproof-poster.pdf",
] as const;

const ASSET_FILE_MAP: Record<
  PrintAssetId,
  { folder: string; png: string; pdf: string }
> = {
  "full-page": {
    folder: "full-page",
    png: "jobproof-full-page-flyer.png",
    pdf: "jobproof-full-page-flyer.pdf",
  },
  "half-page": {
    folder: "half-page",
    png: "jobproof-half-page-flyer.png",
    pdf: "jobproof-half-page-flyer.pdf",
  },
  "rack-card-front": {
    folder: "rack-card",
    png: "jobproof-rack-card-front.png",
    pdf: "jobproof-rack-card-front.pdf",
  },
  "rack-card-back": {
    folder: "rack-card",
    png: "jobproof-rack-card-back.png",
    pdf: "jobproof-rack-card-back.pdf",
  },
  poster: {
    folder: "poster",
    png: "jobproof-poster.png",
    pdf: "jobproof-poster.pdf",
  },
};

export function resolvePrintBasePngPublicPath(assetId: PrintAssetId): string {
  const entry = ASSET_FILE_MAP[assetId];
  return printPngPath(entry.folder, entry.png);
}

export function resolvePrintBasePdfPublicPath(assetId: PrintAssetId): string {
  const entry = ASSET_FILE_MAP[assetId];
  return printPngPath(entry.folder, entry.pdf);
}

export function resolvePrintBasePngFileName(assetId: PrintAssetId): string {
  return ASSET_FILE_MAP[assetId].png;
}

export function resolvePrintBasePdfFileName(assetId: PrintAssetId): string {
  return ASSET_FILE_MAP[assetId].pdf;
}

export function isPrintAssetId(value: string): value is PrintAssetId {
  return (PRINT_ASSET_IDS as string[]).includes(value);
}

export function printResourceByApiId(
  apiId: PrintAssetId
): PrintResource | undefined {
  return MEDIA_PRINT_RESOURCES.find((r) => r.downloadApiId === apiId);
}
