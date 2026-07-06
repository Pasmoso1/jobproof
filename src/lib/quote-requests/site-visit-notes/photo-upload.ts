import {
  MAX_SITE_VISIT_PHOTO_BYTES,
  MAX_SITE_VISIT_PHOTOS,
  MAX_SITE_VISIT_VOICE_BYTES,
  QUOTE_REQUEST_STORAGE_BUCKET,
} from "@/lib/quote-requests/constants";

export { QUOTE_REQUEST_STORAGE_BUCKET };

export const SITE_VISIT_PHOTO_ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export const SITE_VISIT_AUDIO_ALLOWED_MIME = new Set([
  "audio/webm",
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/wav",
  "audio/ogg",
  "audio/x-m4a",
  "audio/m4a",
]);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isSiteVisitRequestId(value: string): boolean {
  return UUID_RE.test(value.trim());
}

export function normalizeSiteVisitPhotoMime(mime: string): string {
  const lower = mime.trim().toLowerCase();
  if (lower === "image/jpg") return "image/jpeg";
  return lower || "image/jpeg";
}

export function extFromSiteVisitPhotoMime(mime: string): string {
  switch (normalizeSiteVisitPhotoMime(mime)) {
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

export function normalizeSiteVisitAudioMime(mime: string): string {
  const lower = mime.trim().toLowerCase();
  if (lower === "audio/mp3") return "audio/mpeg";
  if (lower === "audio/m4a" || lower === "audio/x-m4a") return "audio/mp4";
  return lower || "audio/webm";
}

export function extFromSiteVisitAudioMime(mime: string): string {
  switch (normalizeSiteVisitAudioMime(mime)) {
    case "audio/webm":
      return "webm";
    case "audio/mpeg":
      return "mp3";
    case "audio/mp4":
      return "m4a";
    case "audio/wav":
      return "wav";
    case "audio/ogg":
      return "ogg";
    default:
      return "webm";
  }
}

export function buildSiteVisitPhotoPath(
  contractorId: string,
  requestId: string,
  photoId: string,
  ext: string
): string {
  return `${contractorId}/${requestId}/site-visit/photos/${photoId}.${ext}`;
}

export function buildSiteVisitVoicePath(
  contractorId: string,
  requestId: string,
  voiceId: string,
  ext: string
): string {
  return `${contractorId}/${requestId}/site-visit/voice/${voiceId}.${ext}`;
}

export function isValidSiteVisitPhotoPath(
  filePath: string,
  contractorId: string,
  requestId: string
): boolean {
  const prefix = `${contractorId}/${requestId}/site-visit/photos/`;
  if (!filePath.startsWith(prefix)) return false;
  const rest = filePath.slice(prefix.length);
  return !rest.includes("/") && !rest.includes("..") && rest.length > 0;
}

export function isValidSiteVisitVoicePath(
  filePath: string,
  contractorId: string,
  requestId: string
): boolean {
  const prefix = `${contractorId}/${requestId}/site-visit/voice/`;
  if (!filePath.startsWith(prefix)) return false;
  const rest = filePath.slice(prefix.length);
  return !rest.includes("/") && !rest.includes("..") && rest.length > 0;
}

export function validateSiteVisitPhotoMeta(meta: {
  mimeType: string;
  byteSize: number;
}): { ok: true; mime: string } | { ok: false; error: string } {
  const mime = normalizeSiteVisitPhotoMime(meta.mimeType);
  if (!SITE_VISIT_PHOTO_ALLOWED_MIME.has(mime)) {
    return { ok: false, error: "Photos must be JPEG, PNG, GIF, WebP, or HEIC." };
  }
  if (!Number.isFinite(meta.byteSize) || meta.byteSize <= 0) {
    return { ok: false, error: "Photo file is empty." };
  }
  if (meta.byteSize > MAX_SITE_VISIT_PHOTO_BYTES) {
    const maxMb = MAX_SITE_VISIT_PHOTO_BYTES / (1024 * 1024);
    return { ok: false, error: `Each photo must be ${maxMb} MB or smaller.` };
  }
  return { ok: true, mime };
}

export function validateSiteVisitAudioMeta(meta: {
  mimeType: string;
  byteSize: number;
}): { ok: true; mime: string } | { ok: false; error: string } {
  const mime = normalizeSiteVisitAudioMime(meta.mimeType);
  if (!SITE_VISIT_AUDIO_ALLOWED_MIME.has(mime) && !SITE_VISIT_AUDIO_ALLOWED_MIME.has(meta.mimeType.toLowerCase())) {
    return { ok: false, error: "Audio must be WebM, MP3, M4A, WAV, or OGG." };
  }
  if (!Number.isFinite(meta.byteSize) || meta.byteSize <= 0) {
    return { ok: false, error: "Audio file is empty." };
  }
  if (meta.byteSize > MAX_SITE_VISIT_VOICE_BYTES) {
    const maxMb = MAX_SITE_VISIT_VOICE_BYTES / (1024 * 1024);
    return { ok: false, error: `Audio must be ${maxMb} MB or smaller.` };
  }
  return { ok: true, mime };
}

export function validateSiteVisitPhotoCount(currentCount: number): { ok: true } | { ok: false; error: string } {
  if (currentCount >= MAX_SITE_VISIT_PHOTOS) {
    return { ok: false, error: `You can upload up to ${MAX_SITE_VISIT_PHOTOS} site visit photos.` };
  }
  return { ok: true };
}
