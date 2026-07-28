import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  BRAND_GUIDELINES_ASSET,
  COMING_SOON_RESOURCES,
  MEDIA_BRAND_ASSETS,
  MEDIA_CENTER_NOTICE,
  MEDIA_EMAIL_RESOURCES,
  MEDIA_PRINT_ASSETS,
  MEDIA_SOCIAL_ASSETS,
  MEDIA_WEBSITE_ASSETS,
  PARTNER_COPY_LIBRARY,
  PARTNER_LINK_TOKEN,
  buildMediaCenterFaqs,
  partnerRewardFaqAnswer,
  personalizePartnerCopy,
} from "@/lib/partners/media-center-content";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function assertAssetFilesExist(
  assets: Array<{
    downloads: Array<{ href: string }>;
    previewSrc: string;
  }>
) {
  for (const asset of assets) {
    const preview = join(root, "public", asset.previewSrc.replace(/^\//, ""));
    assert.equal(existsSync(preview), true, `missing preview ${asset.previewSrc}`);
    for (const download of asset.downloads) {
      assert.ok(download.href.startsWith("/media-kit/"));
      const absolute = join(root, "public", download.href.replace(/^\//, ""));
      assert.equal(existsSync(absolute), true, `missing ${download.href}`);
    }
  }
}

describe("partner media center content", () => {
  it("includes required sections and approved notice copy", () => {
    assert.match(MEDIA_CENTER_NOTICE, /approved assets/i);
    assert.ok(MEDIA_BRAND_ASSETS.length >= 7);
    assert.ok(MEDIA_SOCIAL_ASSETS.length >= 5);
    assert.ok(MEDIA_WEBSITE_ASSETS.length >= 5);
    assert.ok(MEDIA_PRINT_ASSETS.length >= 4);
    assert.ok(MEDIA_EMAIL_RESOURCES.length >= 3);
    assert.ok(PARTNER_COPY_LIBRARY.length >= 8);
    assert.ok(BRAND_GUIDELINES_ASSET.downloads.length > 0);
  });

  it("points brand and media downloads at real public asset files", () => {
    assertAssetFilesExist(MEDIA_BRAND_ASSETS);
    assertAssetFilesExist(MEDIA_SOCIAL_ASSETS);
    assertAssetFilesExist(MEDIA_WEBSITE_ASSETS);
    assertAssetFilesExist(MEDIA_PRINT_ASSETS);
    assertAssetFilesExist([BRAND_GUIDELINES_ASSET]);
    for (const email of MEDIA_EMAIL_RESOURCES) {
      if (!email.htmlHref) continue;
      const absolute = join(root, "public", email.htmlHref.replace(/^\//, ""));
      assert.equal(existsSync(absolute), true, `missing ${email.htmlHref}`);
    }
  });

  it("does not label real assets as coming soon", () => {
    for (const resource of COMING_SOON_RESOURCES) {
      assert.ok(!("href" in resource));
      assert.ok(resource.title.length > 0);
      assert.ok(
        !MEDIA_BRAND_ASSETS.some((a) => a.name === resource.title),
        `brand asset incorrectly coming soon: ${resource.title}`
      );
    }
  });

  it("personalizes copy with the partner referral URL when available", () => {
    const sample = PARTNER_COPY_LIBRARY.find((b) =>
      b.body.includes(PARTNER_LINK_TOKEN)
    );
    assert.ok(sample);
    const personalized = personalizePartnerCopy(
      sample!.body,
      "https://jobproof.ca/signup?ref=ABC123"
    );
    assert.doesNotMatch(personalized, /\[PARTNER LINK\]/);
    assert.match(personalized, /https:\/\/jobproof\.ca\/signup\?ref=ABC123/);
    assert.equal(
      personalizePartnerCopy(sample!.body, null).includes(PARTNER_LINK_TOKEN),
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
    assert.match(source, /Brand Assets/);
    assert.match(source, /Social Media Kit/);
    assert.match(source, /Partner Copy Library/);
  });
});
