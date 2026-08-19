import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  ORGANIZATION_AUDIENCE_CARDS,
  ORGANIZATION_FAQS,
  ORGANIZATION_HOW_STEPS,
  ORGANIZATION_PARTNERS_HERO,
  ORGANIZATION_PARTNERS_META,
  ORGANIZATION_WHY_CARDS,
} from "@/lib/partners/content/organizations";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

describe("association & organization partners page", () => {
  it("ships required SEO metadata and org-focused hero copy", () => {
    assert.match(ORGANIZATION_PARTNERS_META.title, /Association & Organization Partners/);
    assert.match(ORGANIZATION_PARTNERS_META.title, /JobProof/);
    assert.match(ORGANIZATION_PARTNERS_META.description, /members/i);
    assert.match(ORGANIZATION_PARTNERS_HERO.headline, /member benefit/i);
    assert.ok(ORGANIZATION_PARTNERS_HERO.memberBenefits.includes("Win more jobs"));
    assert.ok(
      ORGANIZATION_PARTNERS_HERO.memberBenefits.includes("Create professional quotes")
    );
    assert.equal(
      ORGANIZATION_PARTNERS_HERO.primaryCta.href,
      "/partners/organizations/apply"
    );
    // No Schedule a Demo secondary CTA
    assert.ok(
      !("secondaryCta" in ORGANIZATION_PARTNERS_HERO),
      "hero must not have a secondaryCta"
    );
  });

  it("covers why cards, audience types, how-it-works, and FAQs", () => {
    assert.ok(ORGANIZATION_WHY_CARDS.length >= 6);
    assert.ok(ORGANIZATION_AUDIENCE_CARDS.some((c) => c.title.includes("Chamber")));
    assert.ok(ORGANIZATION_AUDIENCE_CARDS.some((c) => c.title.includes("Buying Group")));
    assert.equal(ORGANIZATION_HOW_STEPS.length, 4);
    assert.ok(ORGANIZATION_FAQS.some((f) => /cost/i.test(f.question)));
    assert.ok(ORGANIZATION_FAQS.some((f) => /webinars/i.test(f.question)));
    assert.ok(ORGANIZATION_FAQS.some((f) => /earn/i.test(f.question)));
    // FAQ answer should state $150 CAD fixed reward — no Founding/Standard distinction
    assert.ok(
      ORGANIZATION_FAQS.some((f) => /\$150 CAD/i.test(f.answer))
    );
    assert.ok(
      !ORGANIZATION_FAQS.some((f) => /\$100/i.test(f.answer)),
      "FAQ must not mention $100 for org partners"
    );
  });

  it("registers the public route and portal callouts", async () => {
    const pagePath = join(root, "src/app/partners/organizations/page.tsx");
    assert.equal(existsSync(pagePath), true);

    const page = await readFile(pagePath, "utf8");
    assert.match(page, /ORGANIZATION_PARTNERS_HERO/);
    assert.match(page, /ORGANIZATION_PARTNERS_META/);
    // Success Examples section removed
    assert.doesNotMatch(page, /Illustrative examples/);
    assert.doesNotMatch(page, /Schedule a Demo/);
    assert.doesNotMatch(page, /only a documentation/i);

    const landing = await readFile(
      join(root, "src/app/partners/page.tsx"),
      "utf8"
    );
    assert.match(landing, /\/partners\/organizations/);

    const dashboard = await readFile(
      join(root, "src/app/(partner)/partner/(portal)/page.tsx"),
      "utf8"
    );
    assert.match(dashboard, /OrganizationPartnerCallout/);

    const studio = await readFile(
      join(root, "src/app/(partner)/partner/(portal)/studio/page.tsx"),
      "utf8"
    );
    assert.match(studio, /OrganizationPartnerCallout/);

    const media = await readFile(
      join(root, "src/app/(partner)/partner/(portal)/media/page.tsx"),
      "utf8"
    );
    assert.match(media, /OrganizationPartnerCallout/);

    const resources = await readFile(
      join(root, "src/app/(partner)/partner/(portal)/resources/page.tsx"),
      "utf8"
    );
    assert.match(resources, /OrganizationPartnerCallout/);
  });
});
