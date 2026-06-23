import {
  MAX_QUOTE_REQUEST_PHOTO_BYTES,
  MAX_QUOTE_REQUEST_PHOTOS,
} from "@/lib/quote-requests/constants";

export const QUOTE_PHOTO_ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const TMP_FILE_RE = /^[0-9a-f-]{36}\.(jpe?g|png|gif|webp|heic|heif)$/i;

export function isQuoteUploadSessionId(value: string): boolean {
  return UUID_RE.test(value.trim());
}

export function normalizeQuotePhotoMime(mime: string): string {
  const lower = mime.trim().toLowerCase();
  if (lower === "image/jpg") return "image/jpeg";
  return lower || "image/jpeg";
}

export function extFromQuotePhotoMime(mime: string): string {
  switch (normalizeQuotePhotoMime(mime)) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/gif":
      return "gif";
    case "image/webp":
      return "webp";
    case "image/heic":
      return "heic";
    case "image/heif":
      return "heif";
    default:
      return "jpg";
  }
}

export function buildQuotePhotoTmpPath(
  contractorId: string,
  uploadSessionId: string,
  fileId: string,
  ext: string
): string {
  return `${contractorId}/tmp/${uploadSessionId}/${fileId}.${ext}`;
}

export function buildQuotePhotoTmpPrefix(contractorId: string, uploadSessionId: string): string {
  return `${contractorId}/tmp/${uploadSessionId}/`;
}

export function isValidQuotePhotoTmpPath(
  filePath: string,
  contractorId: string,
  uploadSessionId: string
): boolean {
  const prefix = buildQuotePhotoTmpPrefix(contractorId, uploadSessionId);
  if (!filePath.startsWith(prefix)) return false;
  const rest = filePath.slice(prefix.length);
  if (rest.includes("/") || rest.includes("..")) return false;
  return TMP_FILE_RE.test(rest);
}

export function validateQuotePhotoMeta(meta: {
  mimeType: string;
  byteSize: number;
}): { ok: true; mime: string } | { ok: false; error: string } {
  const mime = normalizeQuotePhotoMime(meta.mimeType);
  if (!QUOTE_PHOTO_ALLOWED_MIME.has(mime) && !QUOTE_PHOTO_ALLOWED_MIME.has(meta.mimeType.toLowerCase())) {
    return { ok: false, error: "Photos must be JPEG, PNG, GIF, WebP, or HEIC." };
  }
  if (!Number.isFinite(meta.byteSize) || meta.byteSize <= 0) {
    return { ok: false, error: "Photo file is empty." };
  }
  if (meta.byteSize > MAX_QUOTE_REQUEST_PHOTO_BYTES) {
    const maxMb = MAX_QUOTE_REQUEST_PHOTO_BYTES / (1024 * 1024);
    return { ok: false, error: `Each photo must be ${maxMb} MB or smaller.` };
  }
  return { ok: true, mime };
}

export function validateQuotePhotoPathList(
  photoPaths: string[],
  contractorId: string,
  uploadSessionId: string
): { ok: true } | { ok: false; error: string } {
  if (photoPaths.length > MAX_QUOTE_REQUEST_PHOTOS) {
    return { ok: false, error: `You can upload up to ${MAX_QUOTE_REQUEST_PHOTOS} photos.` };
  }
  const seen = new Set<string>();
  for (const path of photoPaths) {
    if (!isValidQuotePhotoTmpPath(path, contractorId, uploadSessionId)) {
      return { ok: false, error: "Invalid photo reference." };
    }
    if (seen.has(path)) {
      return { ok: false, error: "Duplicate photo reference." };
    }
    seen.add(path);
  }
  return { ok: true };
}

export function friendlyQuotePhotoUploadError(err: unknown): string {
  if (err instanceof Error) {
    if (/failed to fetch|network|load failed/i.test(err.message)) {
      return "Photo upload failed. Check your connection and try again.";
    }
    return err.message;
  }
  return "Photo upload failed. Please try again.";
}
