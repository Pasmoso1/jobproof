import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  filterRecordsByPartnerType,
  normalizePartnerType,
  partnerCategoryLabel,
  partnerTypeMeta,
  rewardAmountForLevel,
  rewardAmountForPartner,
} from "@/lib/partners/constants";
import {
  MARKETING_PROMOTION_METHODS,
  validateTypeSpecificApplicationFields,
} from "@/lib/partners/apply-profiles";
import { getStudioPresetsForPartnerType } from "@/lib/partners/studio/presets";
import { ORGANIZATION_CAMPAIGN_PRESETS } from "@/lib/partners/studio/organization-presets";
import { MARKETING_PARTNER_POLICY } from "@/lib/partners/content/resources";
import { ORGANIZATION_PARTNER_KIT } from "@/lib/partners/organization-partner-kit";
import {
  parsePartnerApplicationFormData,
  validatePartnerApplication,
} from "@/lib/partners/submit-application";
import { prepareOrganizationApplicationFormData } from "@/lib/partners/submit-organization-application";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function creatorForm(overrides?: Record<string, string>): FormData {
  const fd = new FormData();
  fd.set("organization_name", "Site Videos");
  fd.set("contact_name", "Alex Creator");
  fd.set("email", "alex@example.com");
  fd.set("partner_type", "creator");
  fd.set("primary_platform", "youtube");
  fd.set("website", "https://youtube.com/@sitevideos");
  fd.set("estimated_audience", "8000");
  fd.set("reason", "Weekly contractor jobsite videos.");
  fd.set("agreement_accepted", "on");
  fd.set("username", "alexcreator");
  fd.set("password", "secret12");
  fd.set("confirm_password", "secret12");
  for (const [k, v] of Object.entries(overrides ?? {})) fd.set(k, v);
  return fd;
}

function marketingForm(overrides?: Record<string, string>): FormData {
  const fd = new FormData();
  fd.set("organization_name", "North Media Co");
  fd.set("contact_name", "Sam Marketer");
  fd.set("email", "sam@example.com");
  fd.set("partner_type", "marketing");
  fd.set("promotion_method", "paid_media");
  fd.set("website", "https://northmedia.example");
  fd.set("reason", "Paid search and contractor newsletters.");
  fd.set("agreement_accepted", "on");
  fd.set("username", "sammarketer");
  fd.set("password", "secret12");
  fd.set("confirm_password", "secret12");
  for (const [k, v] of Object.entries(overrides ?? {})) fd.set(k, v);
  return fd;
}

describe("partner type normalization and rewards", () => {
  it("maps legacy individual types to creator and keeps organization", () => {
    assert.equal(normalizePartnerType("influencer"), "creator");
    assert.equal(normalizePartnerType("existing_contractor"), "creator");
    assert.equal(normalizePartnerType("business_coach"), "creator");
    assert.equal(normalizePartnerType("creator"), "creator");
    assert.equal(normalizePartnerType("marketing"), "marketing");
    assert.equal(normalizePartnerType("organization"), "organization");
    assert.equal(normalizePartnerType("trade_organization"), "organization");
    assert.equal(partnerCategoryLabel("influencer"), "Creator");
    assert.equal(partnerCategoryLabel("marketing"), "Marketing");
    assert.equal(partnerCategoryLabel("organization"), "Organization");
  });

  it("returns correct reward amounts per partner type and level", () => {
    assert.equal(rewardAmountForLevel("standard"), 100);
    assert.equal(rewardAmountForLevel("founding"), 150);
    // Organization always $150 regardless of level
    assert.equal(
      rewardAmountForPartner({ partner_level: "standard", partner_type: "organization" }),
      150,
      "org standard must be 150"
    );
    assert.equal(
      rewardAmountForPartner({ partner_level: "founding", partner_type: "organization" }),
      150,
      "org founding must be 150"
    );
    // Creator follows level
    assert.equal(
      rewardAmountForPartner({ partner_level: "standard", partner_type: "creator" }),
      100
    );
    assert.equal(
      rewardAmountForPartner({ partner_level: "founding", partner_type: "creator" }),
      150
    );
    // Marketing follows level
    assert.equal(
      rewardAmountForPartner({ partner_level: "standard", partner_type: "marketing" }),
      100
    );
    assert.equal(
      rewardAmountForPartner({ partner_level: "founding", partner_type: "marketing" }),
      150
    );
  });

  it("filters admin records by canonical partner type", () => {
    const rows = [
      { partner_type_value: "creator" },
      { partner_type_value: "marketing" },
      { partner_type_value: "organization" },
      { partner_type_value: "influencer" },
    ];
    assert.equal(filterRecordsByPartnerType(rows, "all").length, 4);
    assert.equal(filterRecordsByPartnerType(rows, "creator").length, 2);
    assert.equal(filterRecordsByPartnerType(rows, "marketing").length, 1);
    assert.equal(filterRecordsByPartnerType(rows, "organization").length, 1);
  });
});

describe("partner application types", () => {
  it("accepts a creator application with platform and audience fields", () => {
    const parsed = parsePartnerApplicationFormData(creatorForm());
    assert.equal(parsed.partnerType, "creator");
    assert.match(parsed.promotionPlan, /YouTube/);
    const errors = {
      ...validateTypeSpecificApplicationFields(creatorForm()),
      ...validatePartnerApplication(parsed, { requirePassword: true }),
    };
    assert.deepEqual(errors, {});
  });

  it("accepts a marketing application without requiring an audience", () => {
    const fd = marketingForm();
    fd.set("estimated_audience", "");
    const parsed = parsePartnerApplicationFormData(fd);
    assert.equal(parsed.partnerType, "marketing");
    assert.match(parsed.promotionPlan, /Paid media/);
    const errors = {
      ...validateTypeSpecificApplicationFields(fd),
      ...validatePartnerApplication(parsed, { requirePassword: true }),
    };
    assert.deepEqual(errors, {});
    assert.ok(MARKETING_PROMOTION_METHODS.some((m) => m.value === "paid_media"));
  });

  it("rejects a creator application missing platform", () => {
    const fd = creatorForm({ primary_platform: "" });
    const errors = validateTypeSpecificApplicationFields(fd);
    assert.ok(errors.primary_platform);
  });

  it("still prepares organization applications as partner_type organization", () => {
    const fd = new FormData();
    fd.set("organization_name", "Metro Chamber");
    fd.set("organization_type", "chamber_of_commerce");
    fd.set("contact_name", "Pat Contact");
    fd.set("channel_newsletter", "on");
    fd.set("email", "pat@chamber.example");
    fd.set("agreement_accepted", "on");
    fd.set("username", "metrochamber");
    fd.set("password", "secret12");
    fd.set("confirm_password", "secret12");
    const prepared = prepareOrganizationApplicationFormData(fd);
    assert.equal(prepared.ok, true);
    if (!prepared.ok) return;
    assert.equal(prepared.formData.get("partner_type"), "organization");
  });
});

describe("dashboard and studio personalization", () => {
  it("returns type-specific dashboard copy", () => {
    assert.match(partnerTypeMeta("creator").dashboardIntro, /audience/i);
    assert.match(partnerTypeMeta("marketing").dashboardIntro, /qualified contractor/i);
    assert.match(partnerTypeMeta("organization").dashboardIntro, /members/i);
  });

  it("returns studio presets for each partner type", () => {
    const creator = getStudioPresetsForPartnerType("creator");
    const marketing = getStudioPresetsForPartnerType("marketing");
    const organization = getStudioPresetsForPartnerType("organization");
    assert.ok(creator.some((p) => p.id === "instagram_post"));
    assert.ok(creator.some((p) => p.id === "podcast_mention"));
    assert.ok(marketing.some((p) => p.id === "website_banner"));
    assert.ok(marketing.some((p) => p.id === "newsletter_promotion"));
    assert.equal(organization.length, ORGANIZATION_CAMPAIGN_PRESETS.length);
    assert.ok(organization.some((p) => p.id === "member_announcement"));
  });

  it("keeps organization kit and marketing policy available", () => {
    assert.ok(ORGANIZATION_PARTNER_KIT.length >= 10);
    assert.ok(MARKETING_PARTNER_POLICY.mustNot.length >= 8);
    assert.match(MARKETING_PARTNER_POLICY.intro, /does not automatically cover advertising/i);
  });
});

describe("apply page copy and security", () => {
  it("does not include the removed password security helper sentence", async () => {
    const apply = await readFile(
      join(root, "src/app/partners/apply/page.tsx"),
      "utf8"
    );
    assert.doesNotMatch(
      apply,
      /Passwords are stored securely by JobProof authentication/,
      "security helper sentence must be removed from apply page"
    );
    // Password field and min-length hint must still be present
    assert.match(apply, /PasswordField/);
    assert.match(apply, /PARTNER_PASSWORD_MIN_LENGTH/);
  });

  it("org apply page contains $150 and not $100", async () => {
    const orgApply = await readFile(
      join(root, "src/app/partners/organizations/apply/page.tsx"),
      "utf8"
    );
    assert.match(orgApply, /\$150 CAD/);
    assert.doesNotMatch(orgApply, /\$100/);
    assert.doesNotMatch(orgApply, /Founding.*\$150.*Standard.*\$100/);
  });
});

describe("partner type migration and routes", () => {
  it("ships migration 066 and unified apply cards", async () => {
    const migration = join(
      root,
      "supabase/migrations/066_partner_types_creator_marketing_organization.sql"
    );
    assert.equal(existsSync(migration), true);
    const sql = await readFile(migration, "utf8");
    assert.match(sql, /partner_type = 'creator'/);
    assert.match(sql, /profile_details/);

    const apply = await readFile(
      join(root, "src/app/partners/apply/page.tsx"),
      "utf8"
    );
    assert.match(apply, /PartnerTypeCards/);
    assert.match(apply, /primary_platform/);
    assert.match(apply, /promotion_method/);

    const landing = await readFile(join(root, "src/app/partners/page.tsx"), "utf8");
    assert.match(landing, /Choose how you partner with JobProof/);
    assert.match(landing, /type\.ctaLabel/);
    assert.match(landing, /PARTNER_TYPES/);

    const layout = await readFile(
      join(root, "src/app/(partner)/partner/(portal)/layout.tsx"),
      "utf8"
    );
    assert.doesNotMatch(layout, /Organization Dashboard/);
    assert.match(layout, /href: "\/partner\/studio"/);
    assert.match(layout, /href: "\/partner\/media"/);
  });
});
