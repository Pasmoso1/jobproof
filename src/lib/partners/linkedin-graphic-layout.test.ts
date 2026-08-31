import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import {
  LINKEDIN_SOCIAL_LAYOUT,
  linkedinHeadlineTop,
  linkedinHeadlineY,
  linkedinLogoBottom,
} from "../../../scripts/partner-media-linkedin-layout.mjs";
import { MEDIA_SOCIAL_CAMPAIGNS } from "@/lib/partners/social-campaigns";
import { buildCampaignAssetDrafts } from "@/lib/partners/studio/assets";
import { generateStudioCopy } from "@/lib/partners/studio/copy";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const linkedinPng = join(
  root,
  "public/media-kit/social",
  "win-more-work",
  LINKEDIN_SOCIAL_LAYOUT.fileName
);
const primaryLogo = join(
  root,
  "public/media-kit/logos/jobproof-primary-horizontal.png"
);

describe("LinkedIn social graphic layout", () => {
  it("exposes layout constants that keep the headline below the logo", async () => {
    assert.equal(LINKEDIN_SOCIAL_LAYOUT.width, 1200);
    assert.equal(LINKEDIN_SOCIAL_LAYOUT.height, 627);
    assert.ok(LINKEDIN_SOCIAL_LAYOUT.logoHeadlineGap >= 28);

    const logoMeta = await sharp(primaryLogo)
      .resize({
        width: LINKEDIN_SOCIAL_LAYOUT.logoWidth,
        fit: "inside",
        withoutEnlargement: true,
      })
      .png()
      .toBuffer()
      .then((buf) => sharp(buf).metadata());
    const logoH = logoMeta.height ?? 0;
    assert.ok(logoH > 0);

    const logoBottom = linkedinLogoBottom(logoH);
    const headlineTop = linkedinHeadlineTop(logoH);
    const headlineBaseline = linkedinHeadlineY(logoH);
    const gap = headlineTop - logoBottom;

    assert.ok(
      logoBottom < headlineTop,
      `logo bottom (${logoBottom}) must end above headline top (${headlineTop})`
    );
    assert.ok(
      gap >= LINKEDIN_SOCIAL_LAYOUT.logoHeadlineGap,
      `safe vertical gap between logo and headline glyphs must be >= ${LINKEDIN_SOCIAL_LAYOUT.logoHeadlineGap} (got ${gap})`
    );
    assert.equal(
      headlineBaseline,
      headlineTop +
        Math.round(
          LINKEDIN_SOCIAL_LAYOUT.headlineFontSize *
            LINKEDIN_SOCIAL_LAYOUT.headlineAscentRatio
        )
    );
    assert.ok(
      headlineBaseline > Math.round(LINKEDIN_SOCIAL_LAYOUT.height * 0.28),
      "LinkedIn headline must sit below the legacy fraction-based Y"
    );
  });

  it("exported LinkedIn PNG has no white logo plate and readable white headline", async () => {
    assert.equal(existsSync(linkedinPng), true);
    const { data, info } = await sharp(linkedinPng)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    assert.equal(info.width, 1200);
    assert.equal(info.height, 627);

    const w = info.width;
    const isWhite = (i: number) =>
      data[i] > 250 && data[i + 1] > 250 && data[i + 2] > 250 && data[i + 3] > 200;

    // Dense white rows in the logo band would indicate the old opaque plate.
    let plateRows = 0;
    let maxWhiteRun = 0;
    for (let y = 20; y < 160; y++) {
      let white = 0;
      let run = 0;
      let rowMax = 0;
      for (let x = 40; x < 400; x++) {
        if (isWhite((y * w + x) * 4)) {
          white++;
          run++;
          rowMax = Math.max(rowMax, run);
        } else {
          run = 0;
        }
      }
      maxWhiteRun = Math.max(maxWhiteRun, rowMax);
      if (white > 200) plateRows++;
    }
    assert.equal(plateRows, 0, "LinkedIn graphic must not show a dense white logo plate");
    assert.ok(
      maxWhiteRun < 100,
      `unexpected long white run in logo band (${maxWhiteRun}px)`
    );

    // Headline glyphs exist in the mid band (layout places copy below the logo).
    let headlineRows = 0;
    for (let y = 180; y < 320; y++) {
      let glyphs = 0;
      for (let x = 60; x < 900; x++) {
        if (isWhite((y * w + x) * 4)) glyphs++;
      }
      if (glyphs > 20) headlineRows++;
    }
    assert.ok(headlineRows >= 8, "expected white headline glyphs below the logo");
  });

  it("ships a 1200×627 LinkedIn PNG with the full primary logo present", async () => {
    assert.equal(existsSync(linkedinPng), true);
    const meta = await sharp(linkedinPng).metadata();
    assert.equal(meta.width, 1200);
    assert.equal(meta.height, 627);

    const logo = await sharp(primaryLogo).metadata();
    assert.ok((logo.width ?? 0) > (logo.height ?? 0));
    assert.ok((logo.width ?? 0) >= 1000);
  });

  it("Media Centre campaigns and Marketing Studio reference win-more-work LinkedIn path", () => {
    const winMore = MEDIA_SOCIAL_CAMPAIGNS.find((c) => c.id === "win-more-work");
    assert.ok(winMore);
    const linkedinFormat = winMore!.formats.find((f) => f.id === "linkedin");
    assert.ok(linkedinFormat);
    assert.equal(linkedinFormat!.href, LINKEDIN_SOCIAL_LAYOUT.publicPath);

    const copy = generateStudioCopy({
      theme: "everything_jobproof",
      audience: "roofers",
      organizationName: "Test Co",
      referralUrl: "https://jobproof.ca/signup?ref=TEST",
      isFounding: false,
      variant: "professional",
    });
    const drafts = buildCampaignAssetDrafts({
      platforms: ["linkedin"],
      copy,
      referralUrl: "https://jobproof.ca/signup?ref=TEST",
    });
    const linkedin = drafts.find((d) => d.platform === "linkedin");
    assert.ok(linkedin);
    assert.equal(linkedin!.previewSrc, LINKEDIN_SOCIAL_LAYOUT.publicPath);
    assert.equal(linkedin!.downloadHref, LINKEDIN_SOCIAL_LAYOUT.publicPath);
  });

  it("builds LinkedIn via the social campaign compositor (not legacy per-platform compose)", async () => {
    const source = await readFile(
      join(root, "scripts/build-partner-media-kit.mjs"),
      "utf8"
    );
    assert.match(source, /buildAllSocialCampaigns/);
    assert.match(source, /partner-media-social-campaigns/);
    assert.doesNotMatch(source, /await composeSocialGraphic/);
    assert.match(source, /Remove obsolete Wave-1 platform-first/);
  });
});
