import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import {
  MEDIA_WEB_BANNER_GROUPS,
  WEB_BANNER_LEGACY_COMPAT_PATHS,
  WEB_BANNER_STUDIO_DEFAULT,
  allWebBannerAssets,
} from "@/lib/partners/web-banners";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("Media Kit v2 website & display banners", () => {
  it("defines five format groups with growth-first campaigns", () => {
    assert.equal(MEDIA_WEB_BANNER_GROUPS.length, 5);
    assert.deepEqual(
      MEDIA_WEB_BANNER_GROUPS.map((g) => g.id),
      [
        "hero-1920x480",
        "banner-1600x400",
        "leaderboard-728x90",
        "rectangle-300x250",
        "skyscraper-160x600",
      ]
    );

    const hero = MEDIA_WEB_BANNER_GROUPS.find((g) => g.id === "hero-1920x480");
    assert.ok(hero);
    assert.equal(hero!.assets.length, 3);
    assert.deepEqual(
      hero!.assets.map((a) => a.campaignId),
      ["win-more-work", "complete-journey", "protect-earned-revenue"]
    );

    const leaderboard = MEDIA_WEB_BANNER_GROUPS.find(
      (g) => g.id === "leaderboard-728x90"
    );
    assert.equal(leaderboard!.assets.length, 2);
    assert.ok(
      !leaderboard!.assets.some((a) => a.campaignId === "protect-earned-revenue")
    );

    const sky = MEDIA_WEB_BANNER_GROUPS.find(
      (g) => g.id === "skyscraper-160x600"
    );
    assert.equal(sky!.assets.length, 2);
  });

  it("ships PNG assets at the declared paths and dimensions", async () => {
    const assets = allWebBannerAssets();
    assert.ok(assets.length >= 13);

    for (const asset of assets) {
      const absolute = join(root, "public", asset.href.replace(/^\//, ""));
      assert.equal(existsSync(absolute), true, `missing ${asset.href}`);
      const meta = await sharp(absolute).metadata();
      assert.equal(meta.width, asset.width, asset.href);
      assert.equal(meta.height, asset.height, asset.href);
    }

    for (const legacy of WEB_BANNER_LEGACY_COMPAT_PATHS) {
      const absolute = join(root, "public", legacy.replace(/^\//, ""));
      assert.equal(existsSync(absolute), true, `missing legacy ${legacy}`);
    }

    assert.equal(
      existsSync(
        join(root, "public", WEB_BANNER_STUDIO_DEFAULT.replace(/^\//, ""))
      ),
      true
    );
  });

  it("avoids unsupported faster-payment claims in banner copy and compositor", async () => {
    const banned = /get paid faster|guaranteed faster payment/i;
    for (const asset of allWebBannerAssets()) {
      const blob = [asset.headline, asset.supporting ?? "", asset.cta].join(
        "\n"
      );
      assert.doesNotMatch(blob, banned);
    }

    const compositor = await readFile(
      join(root, "scripts/partner-media-web-banners.mjs"),
      "utf8"
    );
    assert.doesNotMatch(compositor, banned);
    assert.match(compositor, /buildAllWebBanners/);
    assert.match(compositor, /WEB_BANNER_CAMPAIGNS/);
  });

  it("Media Centre uses format-group cards with aspect-ratio previews", async () => {
    const page = await readFile(
      join(root, "src/app/(partner)/partner/(portal)/media/page.tsx"),
      "utf8"
    );
    const card = await readFile(
      join(
        root,
        "src/components/partners/media/web-banner-format-group-card.tsx"
      ),
      "utf8"
    );

    assert.match(page, /Website & Display Banners/);
    assert.match(page, /MEDIA_WEB_BANNER_GROUPS/);
    assert.match(page, /WebBannerFormatGroupCard/);
    assert.doesNotMatch(page, /MEDIA_WEBSITE_ASSETS/);

    assert.match(card, /aspectRatio/);
    assert.match(card, /object-contain/);
    assert.match(card, /Copy referral link/);
    assert.match(card, /min-h-11/);
    assert.doesNotMatch(card, /object-cover/);
  });

  it("builder uses the transparent primary logo for web banners", async () => {
    const source = await readFile(
      join(root, "scripts/build-partner-media-kit.mjs"),
      "utf8"
    );
    assert.match(source, /buildAllWebBanners/);
    assert.match(source, /partner-media-web-banners/);
    assert.match(source, /jobproof-primary-horizontal\.png/);
  });
});
