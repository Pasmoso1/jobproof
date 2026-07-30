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
import { MEDIA_SOCIAL_ASSETS } from "@/lib/partners/media-center-content";
import { buildCampaignAssetDrafts } from "@/lib/partners/studio/assets";
import { generateStudioCopy } from "@/lib/partners/studio/copy";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const linkedinPng = join(
  root,
  "public/media-kit/social",
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
    // Must clear the old broken height*0.28 placement (~176) that overlapped the logo.
    assert.ok(
      headlineBaseline > Math.round(LINKEDIN_SOCIAL_LAYOUT.height * 0.28),
      "LinkedIn headline must sit below the legacy fraction-based Y"
    );
  });

  it("exported LinkedIn PNG keeps a measurable blue gap under the logo plate", async () => {
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

    // Dense white in the logo x-range near the top = logo plate.
    // Cap the search below y=200 so headline glyphs are not mistaken for the plate.
    let logoPlateMaxY = -1;
    for (let y = 0; y < 200; y++) {
      let dense = 0;
      for (let x = 48; x < 430; x++) {
        if (isWhite((y * w + x) * 4)) dense++;
      }
      if (dense > 200) logoPlateMaxY = y;
    }
    assert.ok(logoPlateMaxY > 40, "logo plate not found");
    assert.ok(
      logoPlateMaxY < 200,
      `logo plate unexpectedly low (y=${logoPlateMaxY})`
    );

    let headlineMinY = -1;
    for (let y = logoPlateMaxY + 1; y < 450; y++) {
      let outsideLogo = 0;
      for (let x = 430; x < 950; x++) {
        if (isWhite((y * w + x) * 4)) outsideLogo++;
      }
      if (outsideLogo > 20) {
        headlineMinY = y;
        break;
      }
    }
    assert.ok(headlineMinY > 0, "headline not found below logo");
    const pixelGap = headlineMinY - logoPlateMaxY;
    assert.ok(
      pixelGap >= 24,
      `logo plate (y=${logoPlateMaxY}) must clear headline (y=${headlineMinY}) by >= 24px (got ${pixelGap})`
    );
  });

  it("ships a 1200×627 LinkedIn PNG with the full primary logo present", async () => {
    assert.equal(existsSync(linkedinPng), true);
    const meta = await sharp(linkedinPng).metadata();
    assert.equal(meta.width, 1200);
    assert.equal(meta.height, 627);

    // Primary horizontal logo must exist and be wider than tall (full wordmark).
    const logo = await sharp(primaryLogo).metadata();
    assert.ok((logo.width ?? 0) > (logo.height ?? 0));
    assert.ok((logo.width ?? 0) >= 1000);
  });

  it("Media Centre and Marketing Studio both reference the same LinkedIn path", () => {
    const mediaAsset = MEDIA_SOCIAL_ASSETS.find((a) => a.id === "linkedin-graphic");
    assert.ok(mediaAsset);
    assert.equal(mediaAsset!.previewSrc, LINKEDIN_SOCIAL_LAYOUT.publicPath);
    assert.equal(
      mediaAsset!.downloads[0]?.href,
      LINKEDIN_SOCIAL_LAYOUT.publicPath
    );

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

  it("applies logoHeadlineGap only to the LinkedIn compose call", async () => {
    const source = await readFile(
      join(root, "scripts/build-partner-media-kit.mjs"),
      "utf8"
    );
    assert.match(source, /LINKEDIN_SOCIAL_LAYOUT/);
    assert.match(source, /logoHeadlineGap:\s*LINKEDIN_SOCIAL_LAYOUT\.logoHeadlineGap/);

    // Other social platforms must not pass logoHeadlineGap.
    const facebookBlock = source.match(
      /fileName:\s*"jobproof-facebook-post-1080\.png"[\s\S]*?logoWidth:\s*\d+/
    );
    assert.ok(facebookBlock);
    assert.doesNotMatch(facebookBlock![0], /logoHeadlineGap/);

    const instagramBlock = source.match(
      /fileName:\s*"jobproof-instagram-post-1080\.png"[\s\S]*?logoWidth:\s*\d+/
    );
    assert.ok(instagramBlock);
    assert.doesNotMatch(instagramBlock![0], /logoHeadlineGap/);

    const twitterBlock = source.match(
      /fileName:\s*"jobproof-twitter-1600x900\.png"[\s\S]*?logoWidth:\s*\d+/
    );
    assert.ok(twitterBlock);
    assert.doesNotMatch(twitterBlock![0], /logoHeadlineGap/);
  });
});
