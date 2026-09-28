import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  allocateQuoteSlug,
  quoteSlugBaseFromBusinessName,
  quoteSlugCandidates,
  quoteSlugFromEnsureResult,
  type QuoteSlugClaimResult,
} from "@/lib/quote-requests/slug-allocation";
import { slugifyBusinessName, validateQuoteSlug } from "@/lib/quote-requests/slug";
import { buildPublicQuoteUrl } from "@/lib/quote-link-share";

function src(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

const ORIGIN = "https://jobproof.ca";
const PROFILE_UUID = "7c1f3a52-9e1b-4d7a-8f00-2b4c6d8e9f10";
const USER_UUID = "0a9b8c7d-6e5f-4a3b-2c1d-0e9f8a7b6c5d";

/** In-memory profiles table enforcing the lower(quote_slug) unique index. */
class FakeProfiles {
  private slugs = new Map<string, string | null>();

  add(profileId: string, slug: string | null = null) {
    this.slugs.set(profileId, slug);
  }

  slugOf(profileId: string): string | null {
    return this.slugs.get(profileId) ?? null;
  }

  claims = 0;

  async claim(profileId: string, candidate: string): Promise<QuoteSlugClaimResult> {
    await new Promise((r) => setImmediate(r));
    this.claims += 1;
    const lower = candidate.toLowerCase();
    for (const [id, slug] of this.slugs) {
      if (id !== profileId && slug?.toLowerCase() === lower) return { kind: "taken" };
    }
    if (this.slugs.get(profileId)) return { kind: "already_set" };
    this.slugs.set(profileId, candidate);
    return { kind: "claimed" };
  }

  allocate(profileId: string, businessName: string | null, currentSlug?: string | null) {
    return allocateQuoteSlug({
      currentSlug: currentSlug === undefined ? this.slugOf(profileId) : currentSlug,
      businessName,
      claim: (candidate) => this.claim(profileId, candidate),
      readCurrentSlug: async () => this.slugOf(profileId),
      randomSuffix: () => "x7k2q",
    });
  }
}

describe("business-name slug generation", () => {
  it("converts a normal business name", () => {
    assert.equal(slugifyBusinessName("Green Construction"), "green-construction");
  });

  it("lowercases capitalization", () => {
    assert.equal(slugifyBusinessName("GREEN Construction LTD"), "green-construction-ltd");
  });

  it("collapses spaces", () => {
    assert.equal(slugifyBusinessName("  Green    Construction  "), "green-construction");
  });

  it("handles punctuation", () => {
    assert.equal(slugifyBusinessName("Joe's Painting, Inc."), "joes-painting-inc");
    assert.equal(slugifyBusinessName("Smith & Sons"), "smith-and-sons");
    assert.equal(slugifyBusinessName("A.B.C. Roofing!!!"), "a-b-c-roofing");
    assert.equal(slugifyBusinessName("Joe\u2019s Decks"), "joes-decks");
  });

  it("folds accents and drops unsupported characters", () => {
    assert.equal(slugifyBusinessName("Rénovations Côté & Fils"), "renovations-cote-and-fils");
    assert.equal(slugifyBusinessName("Ärger Bau 🛠️ GmbH"), "arger-bau-gmbh");
  });

  it("caps length at 50 without a trailing hyphen", () => {
    const slug = slugifyBusinessName(`${"a".repeat(49)} painting`);
    assert.ok(slug.length <= 50);
    assert.doesNotMatch(slug, /-$/);
  });

  it("always produces a slug that passes the existing validation", () => {
    for (const name of ["Green Construction", "Rénovations Côté", "Joe's Painting", "123 Reno"]) {
      const base = quoteSlugBaseFromBusinessName(name);
      assert.ok(base);
      assert.deepEqual(validateQuoteSlug(base), { ok: true, slug: base });
    }
  });

  it("returns null when the business name is not usable", () => {
    assert.equal(quoteSlugBaseFromBusinessName(""), null);
    assert.equal(quoteSlugBaseFromBusinessName(null), null);
    assert.equal(quoteSlugBaseFromBusinessName("   "), null);
    assert.equal(quoteSlugBaseFromBusinessName("!!!"), null);
    assert.equal(quoteSlugBaseFromBusinessName("株式会社"), null);
    assert.equal(quoteSlugBaseFromBusinessName("JD"), null);
  });
});

describe("unique numeric suffixes", () => {
  it("builds base, base-2, base-3 …", () => {
    const c = quoteSlugCandidates("green-construction", 4);
    assert.deepEqual(c, [
      "green-construction",
      "green-construction-2",
      "green-construction-3",
      "green-construction-4",
    ]);
  });

  it("keeps suffixed candidates within 50 characters", () => {
    const base = "a".repeat(50);
    for (const c of quoteSlugCandidates(base, 25)) {
      assert.ok(c.length <= 50, c);
      assert.equal(validateQuoteSlug(c).ok, true);
    }
  });
});

describe("allocation", () => {
  it("gives an account without a slug its business-name slug", async () => {
    const db = new FakeProfiles();
    db.add("p1");
    const result = await db.allocate("p1", "Green Construction");
    assert.deepEqual(result, { status: "allocated", slug: "green-construction" });
    assert.equal(db.slugOf("p1"), "green-construction");
  });

  it("handles duplicate business names with numeric suffixes", async () => {
    const db = new FakeProfiles();
    db.add("a");
    db.add("b");
    db.add("c");
    assert.equal(quoteSlugFromEnsureResult(await db.allocate("a", "Green Construction")), "green-construction");
    assert.equal(quoteSlugFromEnsureResult(await db.allocate("b", "Green Construction")), "green-construction-2");
    assert.equal(quoteSlugFromEnsureResult(await db.allocate("c", "green construction")), "green-construction-3");
  });

  it("treats existing slugs case-insensitively like the unique index", async () => {
    const db = new FakeProfiles();
    db.add("owner", "Green-Construction");
    db.add("p2");
    const result = await db.allocate("p2", "Green Construction");
    assert.deepEqual(result, { status: "allocated", slug: "green-construction-2" });
  });

  it("never overwrites an existing contractor-selected slug", async () => {
    const db = new FakeProfiles();
    db.add("p1", "my-custom-link");
    const result = await db.allocate("p1", "Green Construction");
    assert.deepEqual(result, { status: "existing", slug: "my-custom-link" });
    assert.equal(db.slugOf("p1"), "my-custom-link");
    assert.equal(db.claims, 0);
  });

  it("returns the slug set by another request instead of overwriting it", async () => {
    const db = new FakeProfiles();
    db.add("p1", "chosen-in-settings");
    const result = await db.allocate("p1", "Green Construction", null);
    assert.deepEqual(result, { status: "existing", slug: "chosen-in-settings" });
    assert.equal(db.slugOf("p1"), "chosen-in-settings");
  });

  it("fails safely without writing when the business name is unusable", async () => {
    const db = new FakeProfiles();
    db.add("p1");
    for (const name of [null, "", "!!!"]) {
      assert.deepEqual(await db.allocate("p1", name), { status: "no_business_name" });
    }
    assert.equal(db.slugOf("p1"), null);
    assert.equal(db.claims, 0);
  });

  it("falls back to a random suffix after numeric suffixes are exhausted", async () => {
    const db = new FakeProfiles();
    for (const [i, slug] of quoteSlugCandidates("acme").entries()) db.add(`taken-${i}`, slug);
    db.add("p1");
    const result = await db.allocate("p1", "Acme");
    assert.deepEqual(result, { status: "allocated", slug: "acme-x7k2q" });
  });

  it("reports exhausted when every candidate is taken", async () => {
    const result = await allocateQuoteSlug({
      currentSlug: null,
      businessName: "Acme",
      claim: async () => ({ kind: "taken" }),
      readCurrentSlug: async () => null,
      randomSuffix: () => "zzzzz",
    });
    assert.deepEqual(result, { status: "failed", reason: "exhausted" });
  });

  it("stops on unexpected write errors instead of looping", async () => {
    let calls = 0;
    const result = await allocateQuoteSlug({
      currentSlug: null,
      businessName: "Acme Reno",
      claim: async () => {
        calls += 1;
        return { kind: "error", code: "42501" };
      },
      readCurrentSlug: async () => null,
    });
    assert.deepEqual(result, { status: "failed", reason: "write_error" });
    assert.equal(calls, 1);
  });
});

describe("concurrency", () => {
  it("gives two simultaneous same-name businesses different slugs without failing", async () => {
    const db = new FakeProfiles();
    db.add("a");
    db.add("b");
    const [ra, rb] = await Promise.all([
      db.allocate("a", "Green Construction"),
      db.allocate("b", "Green Construction"),
    ]);
    assert.equal(ra.status, "allocated");
    assert.equal(rb.status, "allocated");
    assert.deepEqual(
      [quoteSlugFromEnsureResult(ra), quoteSlugFromEnsureResult(rb)].sort(),
      ["green-construction", "green-construction-2"]
    );
  });

  it("handles many simultaneous allocations with all-unique results", async () => {
    const db = new FakeProfiles();
    const ids = Array.from({ length: 8 }, (_, i) => `p${i}`);
    ids.forEach((id) => db.add(id));
    const results = await Promise.all(ids.map((id) => db.allocate(id, "Green Construction")));
    const slugs = results.map(quoteSlugFromEnsureResult);
    assert.ok(slugs.every(Boolean));
    assert.equal(new Set(slugs).size, ids.length);
  });

  it("the same profile allocating twice at once ends with a single slug", async () => {
    const db = new FakeProfiles();
    db.add("p1");
    const [r1, r2] = await Promise.all([
      db.allocate("p1", "Green Construction", null),
      db.allocate("p1", "Green Construction", null),
    ]);
    const final = db.slugOf("p1");
    assert.equal(quoteSlugFromEnsureResult(r1), final);
    assert.equal(quoteSlugFromEnsureResult(r2), final);
  });
});

describe("public URL", () => {
  it("resolves to /quote/{slug} with no internal IDs", () => {
    const url = buildPublicQuoteUrl(ORIGIN, "green-construction-2");
    assert.equal(url, "https://jobproof.ca/quote/green-construction-2");
    assert.doesNotMatch(url!, new RegExp(`${PROFILE_UUID}|${USER_UUID}`));
    assert.doesNotMatch(url!, /[0-9a-f]{8}-[0-9a-f]{4}-/);
    assert.equal(new URL(url!).search, "");
  });

  it("slug is derived only from the business name, never IDs", () => {
    const allocationSource = src("src/lib/quote-requests/slug-allocation.ts");
    assert.doesNotMatch(allocationSource, /withSuffix\([^)]*profileId/);
    assert.doesNotMatch(allocationSource, /quoteSlugCandidates\([^)]*(profileId|user)/);
  });

  it("public route still looks contractors up by slug (existing links keep working)", () => {
    const publicSource = src("src/lib/quote-requests/public.ts");
    assert.match(publicSource, /\.ilike\("quote_slug", normalized\)/);
    const pageSource = src("src/app/quote/[slug]/page.tsx");
    assert.match(pageSource, /getContractorByQuoteSlug\(slug\)/);
  });

  it("claims are conditional so existing slugs are never rewritten", () => {
    const allocationSource = src("src/lib/quote-requests/slug-allocation.ts");
    assert.match(allocationSource, /\.update\(\{ quote_slug: candidate \}\)/);
    assert.match(allocationSource, /\.is\("quote_slug", null\)/);
    assert.match(allocationSource, /error\.code === "23505"/);
  });
});

describe("lifecycle wiring", () => {
  it("business-profile save (onboarding + settings) allocates when no slug exists", () => {
    const actions = src("src/app/(app)/actions.ts");
    const fn = actions.slice(actions.indexOf("export async function updateProfileBusinessInfo"));
    const body = fn.slice(0, fn.indexOf("export async function getStorageUsage"));
    assert.match(body, /"id, quote_slug, /);
    assert.match(body, /if \(!profile\.quote_slug\) \{\s*await ensureQuoteSlugForProfile\(supabase, \{/);
    assert.ok(body.indexOf("ensureQuoteSlugForProfile") > body.indexOf("maybeStartManagedTrial"));
  });

  it("dashboard lazily backfills only when the slug is missing and uses the result", () => {
    const dashboard = src("src/app/(app)/dashboard/page.tsx");
    assert.match(dashboard, /profile\?\.id && !profile\.quote_slug\s*\?\s*quoteSlugFromEnsureResult\(/);
    assert.match(dashboard, /buildPublicQuoteUrl\(resolveAppUrl\(\), quoteSlug\)/);
    assert.match(dashboard, /quoteUrl=\{quoteUrl\}/);
  });

  it("quote settings page backfills the same way", () => {
    const page = src("src/app/(app)/settings/quote-requests/page.tsx");
    assert.match(page, /loadedProfile\?\.id && !loadedProfile\.quote_slug/);
    assert.match(page, /ensureQuoteSlugForProfile\(supabase,/);
  });

  it("dashboard keeps the manual setup fallback", () => {
    const card = src("src/components/dashboard/get-more-work-card.tsx");
    assert.match(card, /Set up your quote link/);
  });

  it("settings page uses contractor-friendly link copy and keeps customization", () => {
    const form = src("src/app/(app)/settings/quote-requests/quote-request-settings-form.tsx");
    assert.match(form, /Your quote request link/);
    assert.match(
      form,
      /Share this link with customers so they can tell you about the work they need and\s+request a quote\./
    );
    assert.doesNotMatch(form, /Quote page URL/);
    assert.match(form, /name="quoteSlug"/);
    assert.match(form, /Suggest from name/);
  });
});
