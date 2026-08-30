import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PARTNER_TRAINING_ARTICLES,
  getPartnerTrainingArticle,
} from "@/lib/partners/content/training";
import { PARTNER_SALES_COPY } from "@/lib/partners/content/resources";
import {
  FOUNDING_REWARD_CAD,
  PARTNER_QUALIFICATION_DAYS,
  STANDARD_REWARD_CAD,
  partnerFacingRewardStatusLabel,
  rewardAmountForPartner,
} from "@/lib/partners/constants";
import { STUDIO_TAGLINE, STUDIO_THEMES } from "@/lib/partners/studio/catalog";
import { MEDIA_CENTER_MISSION, PARTNER_COPY_LIBRARY } from "@/lib/partners/media-center-content";
import { ORGANIZATION_PARTNERS_HERO } from "@/lib/partners/content/organizations";
import { PARTNER_PAYMENT_METHOD_LABEL } from "@/lib/partners/payment-details";

const root = process.cwd();

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

const GUARANTEED_INCOME_PATTERNS = [
  /JobProof will make you more money/i,
  /JobProof guarantees more jobs/i,
  /increase your revenue by \d/i,
  /you will close more jobs/i,
  /double your business/i,
  /earn more instantly/i,
  /make thousands more/i,
  /\bguaranteed income\b/i,
  /\bguaranteed jobs\b/i,
  /\bguaranteed revenue\b/i,
];

const PARTNER_FACING_CONTENT = [
  "src/lib/partners/content/training.ts",
  "src/lib/partners/content/resources.ts",
  "src/lib/partners/content/faqs.ts",
  "src/lib/partners/content/organizations.ts",
  "src/lib/partners/media-center-content.ts",
  "src/lib/partners/studio/copy.ts",
  "src/lib/partners/studio/catalog.ts",
  "src/app/partners/page.tsx",
  "src/app/(partner)/partner/(portal)/resources/page.tsx",
];

describe("Partner growth positioning", () => {
  it("How to introduce JobProof leads with winning work, not save-time/disputes-first close", () => {
    const article = getPartnerTrainingArticle("how-to-introduce");
    assert.ok(article);
    assert.match(article!.body, /winning more work and making more money/i);
    assert.match(article!.body, /The main message/);
    assert.match(
      article!.body,
      /isn't just about paperwork\. It's a business tool designed to help contractors win more work/i
    );
    assert.doesNotMatch(
      article!.body,
      /Avoid overselling features\. Focus on saving time, looking professional, and reducing disputes/i
    );
    assert.match(article!.body, /turn more opportunities into paying jobs/i);
  });

  it("training includes growth outcomes and the JobProof conversation framework", () => {
    const titles = PARTNER_TRAINING_ARTICLES.map((a) => a.slug);
    assert.ok(titles.includes("jobproof-conversation"));
    assert.ok(titles.includes("outcomes-before-features"));
    const conversation = getPartnerTrainingArticle("jobproof-conversation");
    assert.match(conversation!.body, /Find the pain/);
    assert.match(conversation!.body, /Lead with the outcome/);
    assert.match(conversation!.body, /Share your referral link/);
    const outcomes = getPartnerTrainingArticle("outcomes-before-features");
    assert.match(outcomes!.body, /Help turn quote requests into paying jobs/i);
    assert.match(outcomes!.body, /protect the revenue they've earned/i);
  });

  it("resources sales copy leads with opportunities into paying jobs", () => {
    assert.match(PARTNER_SALES_COPY.introduction, /turn opportunities into paying jobs/i);
    assert.match(PARTNER_SALES_COPY.socialShort, /quote request to payment/i);
    assert.match(PARTNER_SALES_COPY.mainMessage, /win more work, make more money/i);
    assert.equal(PARTNER_SALES_COPY.conversationSteps.length, 5);
  });

  it("Marketing Studio tagline and themes prioritize growth outcomes", () => {
    assert.match(STUDIO_TAGLINE, /Win more work/i);
    assert.match(STUDIO_TAGLINE, /Make more money/i);
    assert.doesNotMatch(STUDIO_TAGLINE, /Stay organized\. Get paid\. Protect every job/);
    const winWork = STUDIO_THEMES.find((t) => t.id === "getting_more_jobs");
    assert.equal(winWork?.label, "Win More Work");
    assert.match(winWork!.description, /paying jobs/i);
  });

  it("Media Centre mission and copy library lead with growth", () => {
    assert.match(MEDIA_CENTER_MISSION, /win more work/i);
    assert.match(MEDIA_CENTER_MISSION, /make more money/i);
    const tagline = PARTNER_COPY_LIBRARY.find((b) => b.id === "tagline");
    assert.match(tagline!.body, /Win more work\. Make more money/i);
    const oneSentence = PARTNER_COPY_LIBRARY.find((b) => b.id === "one-sentence");
    assert.match(oneSentence!.body, /turn opportunities into paying jobs/i);
  });

  it("Organization Partner messaging leads with win more work / grow", () => {
    assert.equal(ORGANIZATION_PARTNERS_HERO.memberBenefits[0], "Win more jobs");
    assert.match(ORGANIZATION_PARTNERS_HERO.subtitle, /win more work/i);
    assert.match(ORGANIZATION_PARTNERS_HERO.supporting, /more than documentation/i);
  });

  it("does not introduce guaranteed-income language in partner-facing content", () => {
    for (const rel of PARTNER_FACING_CONTENT) {
      const source = read(rel);
      for (const pattern of GUARANTEED_INCOME_PATTERNS) {
        assert.doesNotMatch(source, pattern, `${rel} matched ${pattern}`);
      }
    }
  });

  it("reward amounts and 90-day qualification remain unchanged", () => {
    assert.equal(FOUNDING_REWARD_CAD, 150);
    assert.equal(STANDARD_REWARD_CAD, 100);
    assert.equal(PARTNER_QUALIFICATION_DAYS, 90);
    assert.equal(
      rewardAmountForPartner({ partner_level: "founding", partner_type: "creator" }),
      150
    );
    assert.equal(
      rewardAmountForPartner({ partner_level: "standard", partner_type: "marketing" }),
      100
    );
    assert.equal(
      rewardAmountForPartner({ partner_level: "standard", partner_type: "organization" }),
      150
    );
  });

  it("partner-facing payout terminology and Interac payment method remain unchanged", () => {
    assert.equal(partnerFacingRewardStatusLabel("pending"), "Pending qualification");
    assert.equal(partnerFacingRewardStatusLabel("qualified"), "Qualified");
    assert.equal(partnerFacingRewardStatusLabel("approved"), "Qualified");
    assert.equal(partnerFacingRewardStatusLabel("needs_review"), "Qualified");
    assert.equal(partnerFacingRewardStatusLabel("paid"), "Paid");
    assert.equal(PARTNER_PAYMENT_METHOD_LABEL, "Interac e-Transfer");
  });

  it("grouped payout batch RPC migration remains present", () => {
    const migration = read("supabase/migrations/067_partner_batch_payouts.sql");
    assert.match(migration, /record_partner_batch_payout/);
    assert.match(migration, /needs_review/);
  });
});
