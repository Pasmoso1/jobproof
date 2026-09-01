import { readFile } from "node:fs/promises";
import { join } from "node:path";
import QRCode from "qrcode";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import {
  PRINT_QR_SLOTS,
  RACK_BACK_LINK_AREA,
  type PrintAssetId,
  isPrintAssetId,
  resolvePrintBasePdfFileName,
  resolvePrintBasePngFileName,
} from "@/lib/partners/print-assets";

const PUBLIC_ROOT = join(process.cwd(), "public");
const PRINT_ROOT = join(PUBLIC_ROOT, "media-kit/print");

const PRINT_SPECS: Record<
  PrintAssetId,
  { pageW: number; pageH: number; folder: string }
> = {
  "full-page": { pageW: 612, pageH: 792, folder: "full-page" },
  "half-page": { pageW: 612, pageH: 396, folder: "half-page" },
  "rack-card-front": { pageW: 288, pageH: 648, folder: "rack-card" },
  "rack-card-back": { pageW: 288, pageH: 648, folder: "rack-card" },
  poster: { pageW: 792, pageH: 1224, folder: "poster" },
};

export function validateReferralUrlForQr(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }
    return parsed.pathname.includes("/signup") && parsed.search.includes("ref=");
  } catch {
    return false;
  }
}

export async function generateReferralQrPng(
  referralUrl: string,
  size: number
): Promise<Buffer> {
  return QRCode.toBuffer(referralUrl, {
    type: "png",
    width: size,
    margin: 2,
    errorCorrectionLevel: "M",
    color: {
      dark: "#000000",
      light: "#FFFFFF",
    },
  });
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrapUrlLines(url: string, maxChars: number): string[] {
  const lines: string[] = [];
  let remaining = url;
  while (remaining.length > maxChars) {
    let splitAt = remaining.lastIndexOf("/", maxChars);
    if (splitAt < maxChars * 0.4) splitAt = maxChars;
    lines.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt);
  }
  if (remaining) lines.push(remaining);
  return lines;
}

async function overlayRackBackLink(
  base: Buffer,
  referralUrl: string
): Promise<Buffer> {
  const { left, top, width, height } = RACK_BACK_LINK_AREA;
  const lines = wrapUrlLines(referralUrl, 42);
  const fontSize = lines.length > 2 ? 22 : 26;
  const lineHeight = fontSize * 1.35;
  const blockHeight = lines.length * lineHeight;
  const startY = top + (height - blockHeight) / 2 + fontSize;

  const textSvg = lines
    .map((line, i) => {
      const y = startY + i * lineHeight;
      return `<text x="${left + width / 2}" y="${y}" fill="#2436BB" font-size="${fontSize}" font-weight="600" font-family="Arial, Helvetica, sans-serif" text-anchor="middle">${escapeXml(line)}</text>`;
    })
    .join("");

  const overlay = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg">
      <rect x="${left}" y="${top}" width="${width}" height="${height}" rx="14" fill="#FFFFFF"/>
      ${textSvg}
    </svg>
  `);

  return sharp(base)
    .composite([{ input: overlay, top: 0, left: 0 }])
    .png()
    .toBuffer();
}

async function compositeQrOnBase(
  base: Buffer,
  assetId: PrintAssetId,
  referralUrl: string
): Promise<Buffer> {
  const slot = PRINT_QR_SLOTS[assetId as keyof typeof PRINT_QR_SLOTS];
  if (!slot) return base;

  const inset = Math.round(slot.size * 0.08);
  const qrSize = slot.size - inset * 2;
  const qrBuf = await generateReferralQrPng(referralUrl, qrSize);

  return sharp(base)
    .composite([
      {
        input: qrBuf,
        top: slot.top + inset,
        left: slot.left + inset,
      },
    ])
    .png()
    .toBuffer();
}

async function loadBasePng(assetId: PrintAssetId): Promise<Buffer> {
  const spec = PRINT_SPECS[assetId];
  const fileName = resolvePrintBasePngFileName(assetId);
  const filePath = join(PRINT_ROOT, spec.folder, fileName);
  return readFile(filePath);
}

async function personalizePng(
  assetId: PrintAssetId,
  referralUrl: string
): Promise<Buffer> {
  const base = await loadBasePng(assetId);

  if (assetId === "rack-card-back") {
    return overlayRackBackLink(base, referralUrl);
  }

  return compositeQrOnBase(base, assetId, referralUrl);
}

async function pngToPdf(
  pngBytes: Buffer,
  assetId: PrintAssetId
): Promise<Buffer> {
  const { pageW, pageH } = PRINT_SPECS[assetId];
  const doc = await PDFDocument.create();
  const image = await doc.embedPng(pngBytes);
  const page = doc.addPage([pageW, pageH]);
  page.drawImage(image, { x: 0, y: 0, width: pageW, height: pageH });
  return Buffer.from(await doc.save());
}

export async function personalizePrintAsset({
  assetId,
  referralUrl,
  format,
}: {
  assetId: string;
  referralUrl: string;
  format: "png" | "pdf";
}): Promise<{ bytes: Buffer; contentType: string; fileName: string }> {
  if (!isPrintAssetId(assetId)) {
    throw new Error(`Unknown print asset: ${assetId}`);
  }
  if (!validateReferralUrlForQr(referralUrl)) {
    throw new Error("Invalid referral URL for QR personalization");
  }

  const pngBytes = await personalizePng(assetId, referralUrl);
  const baseName = resolvePrintBasePngFileName(assetId).replace(/\.png$/, "");

  if (format === "png") {
    return {
      bytes: pngBytes,
      contentType: "image/png",
      fileName: `${baseName}-personalized.png`,
    };
  }

  const pdfBytes = await pngToPdf(pngBytes, assetId);
  const pdfName = resolvePrintBasePdfFileName(assetId).replace(/\.pdf$/, "");
  return {
    bytes: pdfBytes,
    contentType: "application/pdf",
    fileName: `${pdfName}-personalized.pdf`,
  };
}
