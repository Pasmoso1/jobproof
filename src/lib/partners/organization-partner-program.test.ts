import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  ORGANIZATION_PARTNER_TYPE,
  partnerCategoryLabel,
  rewardAmountForLevel,
  rewardAmountForPartner,
} from "@/lib/partners/constants";
import {
  buildOrganizationKitContext,
  ORGANIZATION_PARTNER_KIT,
} from "@/lib/partners/organization-partner-kit";
import {
  getOrganizationLandingVariant,
  ORGANIZATION_LANDING_SLUGS,
} from "@/lib/partners/content/organization-landing-pages";
import { ORGANIZATION_CAMPAIGN_PRESETS } from "@/lib/partners/studio/organization-presets";
import { buildCoBrandSvg } from "@/lib/partners/studio/co-brand";
import { buildCampaignAssetDrafts } from "@/lib/partners/studio/assets";
import { generateStudioCopy } from "@/lib/partners/studio/copy";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("organization partner rewards", () => {
  it("uses Founding/Standard amounts regardless of organization type", () => {
    assert.equal(
      rewardAmountForPartner({
        partner_level: "standard",
        partner_type: ORGANIZATION_PARTNER_TYPE,
      }),
      100
    );
    assert.equal(
      rewardAmountForPartner({
        partner_level: "founding",
        partner_type: ORGANIZATION_PARTNER_TYPE,
      }),
      150
    );
    assert.equal(rewardAmountForLevel("standard"), 100);
    assert.equal(rewardAmountForLevel("founding"), 150);
    assert.equal(partnerCategoryLabel(ORGANIZATION_PARTNER_TYPE), "Organization");
    assert.equal(partnerCategoryLabel("influencer"), "Creator");
  });
});

describe("organization partner kit", () => {
  it("includes required personalized resources", () => {
    const required = [
      "member-benefit-one-pager",
      "newsletter-article",
      "newsletter-graphic",
      "website-banner",
      "member-email-html",
      "member-email-text",
      "welcome-package-insert",
      "conference-flyer",
      "conference-poster",
      "trade-show-qr-sign",
      "presentation-slides",
      "frequently-asked-questions",
      "partner-overview-pdf",
    ];
    for (const id of required) {
      assert.ok(
        ORGANIZATION_PARTNER_KIT.some((item) => item.id === id),
        `missing kit item ${id}`
      );
    }

    const ctx = buildOrganizationKitContext({
      organizationName: "Metro Chamber",
      referralUrl: "https://jobproof.ca/signup?ref=CHAMBER1",
      referralCode: "CHAMBER1",
      origin: "https://jobproof.ca",
    });
    const onePager = ORGANIZATION_PARTNER_KIT.find(
      (i) => i.id === "member-benefit-one-pager"
    )!;
    const html = onePager.build(ctx);
    assert.match(html, /CHAMBER1/);
    assert.match(html, /signup\?ref=CHAMBER1/);
    assert.match(html, /\$150 CAD/);
    assert.match(html, /Metro Chamber/);
  });
});

describe("organization landing page variants", () => {
  it("supports required industry slugs with shared architecture", () => {
    for (const slug of [
      "chamber",
      "home-builders",
      "electrical",
      "landscaping",
    ]) {
      const variant = getOrganizationLandingVariant(slug);
      assert.ok(variant, `missing variant ${slug}`);
      assert.ok(variant!.hero.headline.length > 10);
      assert.ok(variant!.industryExamples.length >= 1);
      assert.ok(variant!.memberExamples.length >= 1);
      assert.ok(variant!.marketingExamples.length >= 1);
    }
    assert.ok(ORGANIZATION_LANDING_SLUGS.length >= 4);
    assert.equal(getOrganizationLandingVariant("not-a-real-slug"), null);
  });

  it("registers apply and slug routes", async () => {
    assert.equal(
      existsSync(join(root, "src/app/partners/organizations/apply/page.tsx")),
      true
    );
    assert.equal(
      existsSync(join(root, "src/app/partners/organizations/[slug]/page.tsx")),
      true
    );
    assert.equal(
      existsSync(
        join(root, "supabase/migrations/065_organization_partner_program.sql")
      ),
      true
    );
    const migration = await readFile(
      join(root, "supabase/migrations/065_organization_partner_program.sql"),
      "utf8"
    );
    assert.match(migration, /organization_partner_profiles/);
    assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
  });
});

describe("organization marketing studio enhancements", () => {
  it("provides organization campaign presets", () => {
    assert.ok(ORGANIZATION_CAMPAIGN_PRESETS.length >= 8);
    assert.ok(
      ORGANIZATION_CAMPAIGN_PRESETS.some((p) => p.id === "monthly_newsletter")
    );
    assert.ok(
      ORGANIZATION_CAMPAIGN_PRESETS.some((p) => p.id === "trade_show")
    );
  });

  it("builds co-brand assets with logo, JobProof branding, QR, and referral URL", () => {
    const svg = buildCoBrandSvg({
      organizationName: "Home Builders Assoc",
      referralUrl: "https://jobproof.ca/signup?ref=HBA1",
      organizationLogoUrl: "https://cdn.example/logo.png",
      layout: "recommended_by",
    });
    assert.match(svg, /Home Builders Assoc|cdn\.example\/logo\.png/);
    assert.match(svg, /jobproof-primary-horizontal/);
    assert.match(svg, /create-qr-code/);
    assert.match(svg, /ref=HBA1/);
    assert.match(svg, /Powered by JobProof|RECOMMENDED BY/);

    const copy = generateStudioCopy({
      theme: "everything_jobproof",
      audience: "trade_associations",
      organizationName: "Home Builders Assoc",
      referralUrl: "https://jobproof.ca/signup?ref=HBA1",
      isFounding: false,
      variant: "professional",
    });
    const drafts = buildCampaignAssetDrafts({
      platforms: ["linkedin"],
      copy,
      referralUrl: "https://jobproof.ca/signup?ref=HBA1",
      organizationName: "Home Builders Assoc",
      organizationLogoUrl: "https://cdn.example/logo.png",
      includeCoBrand: true,
    });
    assert.ok(drafts.some((d) => d.assetKind === "co_brand"));
    assert.ok(drafts.some((d) => d.assetKind === "qr"));
  });
});
