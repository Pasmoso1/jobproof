/**
 * Helpers for sharing a contractor's public quote-request page (`/quote/[slug]`).
 * Only the public slug is ever placed in the URL or message.
 */

export const QUOTE_REQUEST_SETTINGS_PATH = "/settings/quote-requests";
export const COMPLETE_BUSINESS_PROFILE_PATH = "/onboarding/business-profile";

export function buildPublicQuoteUrl(
  appOrigin: string,
  quoteSlug: string | null | undefined
): string | null {
  const slug = String(quoteSlug ?? "").trim().toLowerCase();
  if (!slug) return null;
  return `${appOrigin.trim().replace(/\/+$/, "")}/quote/${encodeURIComponent(slug)}`;
}

export const QUOTE_LINK_WEBSITE_GUIDANCE =
  "Use this link on your website, social profiles, email signature or anywhere customers request a quote.";

/** Message text before the link, used on its own when a share target receives the URL separately. */
export function buildQuoteLinkIntro(businessName?: string | null): string {
  const business = String(businessName ?? "").replace(/\s+/g, " ").trim();
  const opener = business ? `Thanks for contacting ${business}!` : "Thanks for getting in touch!";
  return `${opener}\n\nTo help us understand your project and prepare your quote, please tell us what you need and upload a few photos of the work area using the link below.`;
}

/**
 * The link sits alone on the last line with nothing appended, so SMS apps can auto-link the
 * received message without picking up trailing punctuation.
 */
export function buildQuoteLinkMessage(input: {
  businessName?: string | null;
  quoteUrl: string;
}): string {
  return `${buildQuoteLinkIntro(input.businessName)}\n\n${input.quoteUrl}`;
}

/**
 * Normalizes a customer mobile number for an `sms:` link.
 * 10-digit (or 1 + 10-digit) North American numbers become E.164 (+1XXXXXXXXXX); numbers entered
 * with a leading "+" keep it. Returns null when the input doesn't look like a phone number.
 */
export function normalizeCustomerMobileNumber(raw: string): string | null {
  const trimmed = String(raw ?? "").replace(/[\u2010-\u2015\u2212]/g, "-").trim();
  if (!trimmed) return null;
  if (/[^\d\s()+.-]/.test(trimmed)) return null;
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return null;
  if (hasPlus) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return digits;
}

/**
 * RFC 5724 `sms:` URI. The body is percent-encoded as a whole (spaces → %20, newlines → %0A,
 * "&" → %26), so the decoded body the Messages app inserts is byte-for-byte the message.
 */
export function buildSmsHref(phone: string, body: string): string {
  return `sms:${phone}?body=${encodeURIComponent(body)}`;
}
