const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const QUOTE_SLUG_MIN_LENGTH = 3;
export const QUOTE_SLUG_MAX_LENGTH = 50;

export function normalizeQuoteSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function validateQuoteSlug(raw: string): { ok: true; slug: string } | { ok: false; error: string } {
  const slug = normalizeQuoteSlug(raw);
  if (!slug) {
    return { ok: false, error: "Your quote request link is required." };
  }
  if (slug.length < QUOTE_SLUG_MIN_LENGTH) {
    return { ok: false, error: "Your quote request link must be at least 3 characters." };
  }
  if (slug.length > QUOTE_SLUG_MAX_LENGTH) {
    return { ok: false, error: "Your quote request link must be 50 characters or less." };
  }
  if (!SLUG_PATTERN.test(slug)) {
    return {
      ok: false,
      error: "Use lowercase letters, numbers, and hyphens only (e.g. acme-painting).",
    };
  }
  return { ok: true, slug };
}

function trimSlugToLength(slug: string, maxLength: number): string {
  return slug.slice(0, maxLength).replace(/-+$/g, "");
}

/**
 * Converts a business name into a URL-safe slug ("Rénovations Côté & Fils" → "renovations-cote-and-fils").
 * Accents are folded and apostrophes dropped so names read naturally in the link.
 */
export function slugifyBusinessName(businessName: string): string {
  const folded = String(businessName ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/['\u2018\u2019`]/g, "");
  return trimSlugToLength(normalizeQuoteSlug(folded), QUOTE_SLUG_MAX_LENGTH);
}

export function suggestQuoteSlugFromBusinessName(businessName: string): string {
  return slugifyBusinessName(businessName);
}
