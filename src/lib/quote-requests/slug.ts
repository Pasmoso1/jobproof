const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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
    return { ok: false, error: "Quote page URL is required." };
  }
  if (slug.length < 3) {
    return { ok: false, error: "Quote page URL must be at least 3 characters." };
  }
  if (slug.length > 50) {
    return { ok: false, error: "Quote page URL must be 50 characters or less." };
  }
  if (!SLUG_PATTERN.test(slug)) {
    return {
      ok: false,
      error: "Use lowercase letters, numbers, and hyphens only (e.g. acme-painting).",
    };
  }
  return { ok: true, slug };
}

export function suggestQuoteSlugFromBusinessName(businessName: string): string {
  return normalizeQuoteSlug(businessName).slice(0, 50);
}
