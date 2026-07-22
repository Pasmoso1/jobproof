import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  ABOUT_JOBPROOF_BLOCKS,
  COMING_SOON_RESOURCES,
  MEDIA_BRAND_ASSETS,
  MEDIA_CENTER_NOTICE,
  NEWSLETTER_FEATURE_ARTICLE,
  PARTNER_LINK_TOKEN,
  QUICK_PITCH_BLOCKS,
  SOCIAL_CAPTION_BLOCKS,
  buildMediaCenterFaqs,
  partnerRewardFaqAnswer,
  personalizePartnerCopy,
} from "@/lib/partners/media-center-content";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("partner media center content", () => {
  it("includes required sections and approved notice copy", () => {
    assert.match(MEDIA_CENTER_NOTICE, /approved assets/i);
    assert.ok(ABOUT_JOBPROOF_BLOCKS.some((b) => b.id === "full-description"));
    assert.ok(QUICK_PITCH_BLOCKS.some((b) => b.id === "60-second"));
    assert.ok(SOCIAL_CAPTION_BLOCKS.length >= 6);
    assert.match(NEWSLETTER_FEATURE_ARTICLE.title, /Better Business Systems/i);
  });

  it("points brand downloads at real public asset files", () => {
    for (const asset of MEDIA_BRAND_ASSETS) {
      for (const download of asset.downloads) {
        assert.ok(download.href.startsWith("/media-kit/"));
        const absolute = join(root, "public", download.href.replace(/^\//, ""));
        assert.equal(existsSync(absolute), true, `missing ${download.href}`);
      }
    }
  });

  it("does not give coming-soon resources fake download links", () => {
    for (const resource of COMING_SOON_RESOURCES) {
      assert.ok(!("href" in resource));
      assert.ok(resource.title.length > 0);
    }
  });

  it("personalizes captions with the partner referral URL when available", () => {
    const sample = SOCIAL_CAPTION_BLOCKS[0]!;
    assert.match(sample.body, new RegExp(PARTNER_LINK_TOKEN.replace(/[[\]]/g, "\\$&")));
    const personalized = personalizePartnerCopy(
      sample.body,
      "https://jobproof.ca/signup?ref=ABC123"
    );
    assert.doesNotMatch(personalized, /\[PARTNER LINK\]/);
    assert.match(personalized, /https:\/\/jobproof\.ca\/signup\?ref=ABC123/);
    assert.equal(
      personalizePartnerCopy(sample.body, null).includes(PARTNER_LINK_TOKEN),
      true
    );
  });

  it("does not assume every partner receives the same reward amount", () => {
    const founding = partnerRewardFaqAnswer("founding");
    const standard = partnerRewardFaqAnswer("standard");
    assert.match(founding, /\$150 CAD/);
    assert.match(standard, /\$100 CAD/);
    assert.notEqual(founding, standard);

    const foundingFaqs = buildMediaCenterFaqs("founding");
    const rewardFaq = foundingFaqs.find((f) => f.question.includes("earn"));
    assert.ok(rewardFaq);
    assert.match(rewardFaq!.answer, /Founding Partner/);
    assert.match(rewardFaq!.answer, /\$150 CAD/);
  });

  it("uses codebase pricing for plan FAQ answers", () => {
    const faqs = buildMediaCenterFaqs("standard");
    const plans = faqs.find((f) => f.question.includes("subscription plans"));
    assert.ok(plans);
    assert.match(plans!.answer, /\$39 CAD\/month/);
    assert.match(plans!.answer, /\$59 CAD\/month/);
  });
});

describe("partner media center route access conventions", () => {
  it("registers Media Center in partner portal navigation", async () => {
    const layoutPath = join(
      root,
      "src/app/(partner)/partner/(portal)/layout.tsx"
    );
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(layoutPath, "utf8")
    );
    assert.match(source, /href: "\/partner\/media"/);
    assert.match(source, /Media Center/);
    assert.match(source, /getActivePartnerForCurrentUser/);
  });

  it("gates the media page with the active-partner session helper", async () => {
    const pagePath = join(
      root,
      "src/app/(partner)/partner/(portal)/media/page.tsx"
    );
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(pagePath, "utf8")
    );
    assert.match(source, /getActivePartnerForCurrentUser/);
    assert.match(source, /redirect\("\/login\?next=\/partner\/media"\)/);
    assert.match(source, /Partner Media Center/);
  });
});
