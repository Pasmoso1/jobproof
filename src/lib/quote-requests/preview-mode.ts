/** Query flag that opens the public quote form as a contractor preview (no live submit). */
export const QUOTE_FORM_PREVIEW_PARAM = "preview";
export const QUOTE_FORM_PREVIEW_VALUE = "1";

export const QUOTE_FORM_PREVIEW_BANNER =
  "You're previewing what customers see. This preview never sends a live quote request.";

export const QUOTE_FORM_PREVIEW_SUBMIT_LABEL = "Preview only — submissions aren't sent";

export function isQuoteFormPreviewMode(
  searchParams: URLSearchParams | Record<string, string | string[] | undefined> | null | undefined
): boolean {
  if (!searchParams) return false;
  if (searchParams instanceof URLSearchParams) {
    return searchParams.get(QUOTE_FORM_PREVIEW_PARAM) === QUOTE_FORM_PREVIEW_VALUE;
  }
  const raw = searchParams[QUOTE_FORM_PREVIEW_PARAM];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return String(value ?? "").trim() === QUOTE_FORM_PREVIEW_VALUE;
}

export function buildQuoteFormPreviewUrl(quoteUrl: string): string {
  const trimmed = quoteUrl.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    url.searchParams.set(QUOTE_FORM_PREVIEW_PARAM, QUOTE_FORM_PREVIEW_VALUE);
    return url.toString();
  } catch {
    const joiner = trimmed.includes("?") ? "&" : "?";
    return `${trimmed}${joiner}${QUOTE_FORM_PREVIEW_PARAM}=${QUOTE_FORM_PREVIEW_VALUE}`;
  }
}
