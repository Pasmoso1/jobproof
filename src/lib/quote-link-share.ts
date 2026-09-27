/**
 * Helpers for sharing a contractor's public quote-request page (`/quote/[slug]`).
 * Only the public slug is ever placed in the URL or message.
 */

export const QUOTE_REQUEST_SETTINGS_PATH = "/settings/quote-requests";

export function buildPublicQuoteUrl(
  appOrigin: string,
  quoteSlug: string | null | undefined
): string | null {
  const slug = String(quoteSlug ?? "").trim().toLowerCase();
  if (!slug) return null;
  return `${appOrigin.trim().replace(/\/+$/, "")}/quote/${encodeURIComponent(slug)}`;
}

export function buildQuoteLinkMessage(input: {
  businessName?: string | null;
  quoteUrl: string;
}): string {
  const business = String(input.businessName ?? "").trim();
  const intro = business ? `Hi, it's ${business}.` : "Hi!";
  return `${intro} Tell us what you need and request a quote here: ${input.quoteUrl}`;
}

/**
 * Normalizes a customer mobile number for an `sms:` link.
 * Returns digits (with a leading "+" when supplied) or null when it doesn't look like a phone number.
 */
export function normalizeCustomerMobileNumber(raw: string): string | null {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return null;
  if (/[^\d\s()+.-]/.test(trimmed)) return null;
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return null;
  return hasPlus ? `+${digits}` : digits;
}

/** `?&body=` is accepted by both iOS Messages and Android SMS apps. */
export function buildSmsHref(phone: string, body: string): string {
  return `sms:${phone}?&body=${encodeURIComponent(body)}`;
}
