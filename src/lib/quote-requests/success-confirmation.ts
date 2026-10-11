/** Confirmation lines on the public quote-request success page. */

export const SUBMITTED_PHOTOS_PARAM = "photos";

/** Missing or malformed values count as zero so the page never claims photos it didn't receive. */
export function parseSubmittedPhotoCount(raw: string | string[] | undefined | null): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const trimmed = String(value ?? "").trim();
  if (!/^\d{1,3}$/.test(trimmed)) return 0;
  return Number(trimmed);
}

export function buildQuoteRequestReceipts(photoCount: number): string[] {
  const receipts: string[] = [];
  if (photoCount === 1) receipts.push("Photo received.");
  else if (photoCount > 1) receipts.push("Photos received.");
  receipts.push("Project details received.", "Contact information received.");
  return receipts;
}
