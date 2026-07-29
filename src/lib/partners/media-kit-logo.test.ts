import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { MEDIA_BRAND_ASSETS } from "@/lib/partners/media-center-content";
import { buildCampaignAssetDrafts } from "@/lib/partners/studio/assets";
import { generateStudioCopy } from "@/lib/partners/studio/copy";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

const HORIZONTAL_LOGOS = [
  "public/media-kit/logos/jobproof-primary-horizontal.png",
  "public/media-kit/logos/jobproof-secondary-horizontal.png",
  "public/media-kit/logos/jobproof-compact-horizontal.png",
] as const;

async function alphaPadding(relativePath: string) {
  const absolute = join(root, relativePath);
  const { data, info } = await sharp(absolute)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let minX = info.width;
  let maxX = -1;
  let minY = info.height;
  let maxY = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const a = data[(y * info.width + x) * 4 + 3];
      if (a > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  assert.ok(maxX >= minX, `${relativePath} has no opaque pixels`);
  return {
    width: info.width,
    height: info.height,
    leftPad: minX,
    rightPad: info.width - 1 - maxX,
    topPad: minY,
    bottomPad: info.height - 1 - maxY,
  };
}

describe("partner media-kit horizontal logos", () => {
  it("ships canonical primary, secondary, and compact horizontal logos", () => {
    for (const rel of HORIZONTAL_LOGOS) {
      assert.equal(existsSync(join(root, rel)), true, `missing ${rel}`);
    }
    const brandLogos = MEDIA_BRAND_ASSETS.filter((a) =>
      a.id.includes("horizontal")
    );
    assert.equal(brandLogos.length, 3);
    for (const asset of brandLogos) {
      assert.match(asset.previewSrc, /jobproof-(primary|secondary|compact)-horizontal\.png$/);
    }
  });

  it("keeps safe transparent padding so the wordmark is not edge-clipped", async () => {
    for (const rel of HORIZONTAL_LOGOS) {
      const pad = await alphaPadding(rel);
      assert.ok(
        pad.rightPad >= 8,
        `${rel} rightPad=${pad.rightPad} — rightmost pixels must not touch the final column`
      );
      assert.ok(
        pad.leftPad >= 8,
        `${rel} leftPad=${pad.leftPad} — leftmost pixels must not touch the first column`
      );
      assert.ok(pad.width > pad.height, `${rel} should remain a wide horizontal lockup`);
    }
  });

  it("does not use the obsolete cropped sheet coordinates in the builder", async () => {
    const source = await readFile(
      join(root, "scripts/build-partner-media-kit.mjs"),
      "utf8"
    );
    // Obsolete hard-coded sheet crop that clipped the wordmark.
    assert.doesNotMatch(source, /top:\s*420/);
    assert.doesNotMatch(
      source,
      /\.extract\(\s*\{\s*left:\s*80\s*,\s*top:\s*420/
    );
    assert.doesNotMatch(
      source,
      /extractLogoKeepWhites\(primarySourceBuf/
    );
    assert.match(source, /jobproof-logo\.png\.png/);
    assert.match(source, /ensureSafePadding/);
    assert.match(source, /primaryHorizontal/);
    assert.match(source, /findNonWhiteBounds/);
  });
});

describe("partner media and studio logo previews", () => {
  it("uses contain-style rendering for Media Centre and Studio logo previews", async () => {
    const files = [
      "src/components/partners/media/media-asset-card.tsx",
      "src/components/partners/studio/studio-asset-card.tsx",
      "src/components/partners/studio/studio-logo-uploader.tsx",
      "src/app/(partner)/partner/(portal)/media/page.tsx",
    ];
    for (const rel of files) {
      const source = await readFile(join(root, rel), "utf8");
      assert.match(source, /object-contain/);
      assert.doesNotMatch(
        source,
        /object-cover/,
        `${rel} must not use object-cover for logo/media previews`
      );
    }
  });

  it("Studio campaign drafts reference corrected media-kit logo and social files", () => {
    const copy = generateStudioCopy({
      theme: "everything_jobproof",
      audience: "roofers",
      organizationName: "Test Co",
      referralUrl: "https://jobproof.ca/signup?ref=TEST",
      isFounding: false,
      variant: "professional",
    });
    const drafts = buildCampaignAssetDrafts({
      platforms: [
        "facebook",
        "instagram_post",
        "instagram_story",
        "linkedin",
        "x",
        "email",
        "website_banner",
        "flyer",
      ],
      copy,
      referralUrl: "https://jobproof.ca/signup?ref=TEST",
    });

    for (const draft of drafts) {
      if (!draft.previewSrc) continue;
      if (draft.assetKind === "qr" || draft.previewSrc.startsWith("https://")) {
        assert.match(draft.previewSrc, /create-qr-code|media-kit/);
        continue;
      }
      assert.ok(
        draft.previewSrc.startsWith("/media-kit/"),
        `unexpected preview ${draft.previewSrc}`
      );
      assert.doesNotMatch(draft.previewSrc, /cropped|legacy|old/i);
      const absolute = join(root, "public", draft.previewSrc.replace(/^\//, ""));
      assert.equal(existsSync(absolute), true, `missing ${draft.previewSrc}`);
    }

    const email = drafts.find((d) => d.platform === "email");
    assert.ok(email?.previewSrc?.includes("jobproof-compact-horizontal.png"));
  });
});

describe("Canadian Media Centre spelling", () => {
  it("uses Centre in partner navigation and Media Centre page copy", async () => {
    const layout = await readFile(
      join(root, "src/app/(partner)/partner/(portal)/layout.tsx"),
      "utf8"
    );
    const mediaPage = await readFile(
      join(root, "src/app/(partner)/partner/(portal)/media/page.tsx"),
      "utf8"
    );
    const studioPage = await readFile(
      join(root, "src/app/(partner)/partner/(portal)/studio/page.tsx"),
      "utf8"
    );
    const faqs = await readFile(
      join(root, "src/lib/partners/media-center-content.ts"),
      "utf8"
    );

    assert.match(layout, /label:\s*"Media Centre"/);
    assert.doesNotMatch(layout, /Media Center/);
    assert.match(mediaPage, /Partner Media Centre/);
    assert.doesNotMatch(mediaPage, /Partner Media Center/);
    assert.match(studioPage, /Open Media Centre/);
    assert.match(studioPage, /Built on Media Centre/);
    assert.doesNotMatch(studioPage, /Media Center/);
    assert.match(faqs, /this Media Centre whenever possible/);
    assert.doesNotMatch(faqs, /this Media Center whenever possible/);
  });

  it("keeps the /partner/media route while using Centre in UI labels", async () => {
    const layout = await readFile(
      join(root, "src/app/(partner)/partner/(portal)/layout.tsx"),
      "utf8"
    );
    assert.match(layout, /href:\s*"\/partner\/media"/);
    assert.match(layout, /Media Centre/);
  });
});
