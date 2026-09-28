import type { SupabaseClient } from "@supabase/supabase-js";
import {
  QUOTE_SLUG_MAX_LENGTH,
  slugifyBusinessName,
  validateQuoteSlug,
} from "@/lib/quote-requests/slug";

/**
 * Automatic quote-request link allocation.
 *
 * Uniqueness is enforced by the existing `idx_profiles_quote_slug` unique index on
 * lower(quote_slug). Each claim is a conditional update that only writes when the profile
 * still has no slug, so a contractor-selected slug is never overwritten and two concurrent
 * claims for the same candidate resolve to one winner (the loser gets 23505 and moves on).
 */

export const MAX_NUMERIC_SUFFIX = 25;
export const RANDOM_SUFFIX_ATTEMPTS = 3;

export type QuoteSlugClaimResult =
  | { kind: "claimed" }
  | { kind: "taken" }
  | { kind: "already_set" }
  | { kind: "error"; code?: string };

export type EnsureQuoteSlugResult =
  | { status: "existing"; slug: string }
  | { status: "allocated"; slug: string }
  | { status: "no_business_name" }
  | { status: "failed"; reason: "exhausted" | "write_error" };

/** Base slug for a business name, or null when the name can't produce a valid link. */
export function quoteSlugBaseFromBusinessName(
  businessName: string | null | undefined
): string | null {
  const base = slugifyBusinessName(String(businessName ?? ""));
  const check = validateQuoteSlug(base);
  return check.ok && check.slug === base ? base : null;
}

function withSuffix(base: string, suffix: string): string {
  const room = QUOTE_SLUG_MAX_LENGTH - suffix.length - 1;
  const head = base.slice(0, room).replace(/-+$/g, "");
  return `${head}-${suffix}`;
}

/** green-construction, green-construction-2, … green-construction-{MAX_NUMERIC_SUFFIX}. */
export function quoteSlugCandidates(base: string, maxNumericSuffix = MAX_NUMERIC_SUFFIX): string[] {
  const candidates = [base];
  for (let n = 2; n <= maxNumericSuffix; n += 1) {
    candidates.push(withSuffix(base, String(n)));
  }
  return candidates;
}

function defaultRandomSuffix(): string {
  return Math.random().toString(36).slice(2, 7).padEnd(5, "0");
}

export async function allocateQuoteSlug(input: {
  currentSlug: string | null | undefined;
  businessName: string | null | undefined;
  claim: (candidate: string) => Promise<QuoteSlugClaimResult>;
  readCurrentSlug: () => Promise<string | null>;
  randomSuffix?: () => string;
  maxNumericSuffix?: number;
}): Promise<EnsureQuoteSlugResult> {
  const existing = String(input.currentSlug ?? "").trim();
  if (existing) return { status: "existing", slug: existing };

  const base = quoteSlugBaseFromBusinessName(input.businessName);
  if (!base) return { status: "no_business_name" };

  const randomSuffix = input.randomSuffix ?? defaultRandomSuffix;
  const candidates = [
    ...quoteSlugCandidates(base, input.maxNumericSuffix),
    ...Array.from({ length: RANDOM_SUFFIX_ATTEMPTS }, () => withSuffix(base, randomSuffix())),
  ];

  for (const candidate of candidates) {
    const result = await input.claim(candidate);
    if (result.kind === "claimed") return { status: "allocated", slug: candidate };
    if (result.kind === "taken") continue;
    if (result.kind === "already_set") {
      const current = String((await input.readCurrentSlug()) ?? "").trim();
      return current
        ? { status: "existing", slug: current }
        : { status: "failed", reason: "write_error" };
    }
    return { status: "failed", reason: "write_error" };
  }
  return { status: "failed", reason: "exhausted" };
}

/**
 * Gives a profile a quote-request link if it has none. Safe to call repeatedly: once a slug
 * exists it returns immediately without writing. Never throws.
 */
export async function ensureQuoteSlugForProfile(
  supabase: SupabaseClient,
  input: {
    profileId: string;
    currentSlug: string | null | undefined;
    businessName: string | null | undefined;
  }
): Promise<EnsureQuoteSlugResult> {
  try {
    const result = await allocateQuoteSlug({
      currentSlug: input.currentSlug,
      businessName: input.businessName,
      claim: async (candidate) => {
        const { data, error } = await supabase
          .from("profiles")
          .update({ quote_slug: candidate })
          .eq("id", input.profileId)
          .is("quote_slug", null)
          .select("id");
        if (error) {
          return error.code === "23505" ? { kind: "taken" } : { kind: "error", code: error.code };
        }
        return Array.isArray(data) && data.length > 0 ? { kind: "claimed" } : { kind: "already_set" };
      },
      readCurrentSlug: async () => {
        const { data } = await supabase
          .from("profiles")
          .select("quote_slug")
          .eq("id", input.profileId)
          .maybeSingle();
        return data?.quote_slug ? String(data.quote_slug) : null;
      },
    });
    if (result.status === "allocated") {
      console.info("[quote-slug]", JSON.stringify({ status: "allocated" }));
    } else if (result.status === "failed") {
      console.warn("[quote-slug]", JSON.stringify({ status: "failed", reason: result.reason }));
    }
    return result;
  } catch (err) {
    console.error(
      "[quote-slug]",
      JSON.stringify({
        status: "failed",
        reason: "exception",
        error_name: err instanceof Error ? err.name : "unknown",
      })
    );
    return { status: "failed", reason: "write_error" };
  }
}

export function quoteSlugFromEnsureResult(result: EnsureQuoteSlugResult): string | null {
  return result.status === "existing" || result.status === "allocated" ? result.slug : null;
}
