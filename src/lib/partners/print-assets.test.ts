import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import {
  MEDIA_PRINT_RESOURCES,
  PRINT_ASSET_IDS,
  PRINT_LEGACY_COMPAT_PATHS,
  PRINT_QR_SLOTS,
  resolvePrintBasePngPublicPath,
} from "@/lib/partners/print-assets";
import {
  generateReferralQrPng,
  validateReferralUrlForQr,
} from "@/lib/partners/print-personalize";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("Media Kit v2 print resources", () => {
  it("defines four print resource groups with QR slot metadata", () => {
    assert.equal(MEDIA_PRINT_RESOURCES.length, 4);
    assert.deepEqual(PRINT_ASSET_IDS, [
      "full-page",
      "half-page",
      "rack-card-front",
      "rack-card-back",
      "poster",
    ]);

    const rack = MEDIA_PRINT_RESOURCES.find((r) => r.id === "rack-card");
    assert.ok(rack);
    assert.deepEqual(rack!.sides, ["front", "back"]);
    assert.equal(rack!.hasPersonalizedQr, true);

    assert.ok(PRINT_QR_SLOTS["full-page"].size > 0);
    assert.ok(!("rack-card-back" in PRINT_QR_SLOTS));
  });

  it("ships PNG assets at declared paths and dimensions after build", async () => {
    for (const resource of MEDIA_PRINT_RESOURCES) {
      const absolute = join(
        root,
        "public",
        resource.basePreviewSrc.replace(/^\//, "")
      );
      assert.equal(existsSync(absolute), true, `missing ${resource.basePreviewSrc}`);
      const meta = await sharp(absolute).metadata();
      assert.equal(meta.width, resource.width, resource.basePreviewSrc);
      assert.equal(meta.height, resource.height, resource.basePreviewSrc);
    }

    for (const assetId of PRINT_ASSET_IDS) {
      const href = resolvePrintBasePngPublicPath(assetId);
      const absolute = join(root, "public", href.replace(/^\//, ""));
      assert.equal(existsSync(absolute), true, `missing ${href}`);
    }

    for (const legacy of PRINT_LEGACY_COMPAT_PATHS) {
      const absolute = join(root, "public", legacy.replace(/^\//, ""));
      assert.equal(existsSync(absolute), true, `missing legacy ${legacy}`);
    }

    const slotsPath = join(root, "public/media-kit/print/qr-slots.json");
    assert.equal(existsSync(slotsPath), true);
    const slots = JSON.parse(await readFile(slotsPath, "utf8"));
    assert.ok(slots.qrSlots["full-page"]);
    assert.ok(slots.specs.poster);
  });

  it("avoids unsupported faster-payment claims in print compositor", async () => {
    const banned = /get paid faster|guaranteed faster payment/i;
    const compositor = await readFile(
      join(root, "scripts/partner-media-print.mjs"),
      "utf8"
    );
    assert.doesNotMatch(compositor, banned);
    assert.match(compositor, /buildAllPrintAssets/);
    assert.match(compositor, /PRINT_QR_SLOTS/);
  });

  it("generates high-contrast QR PNG for a sample referral URL", async () => {
    const url = "https://jobproof.ca/signup?ref=TESTCODE";
    assert.equal(validateReferralUrlForQr(url), true);
    assert.equal(validateReferralUrlForQr("https://jobproof.ca/partners"), false);

    const buf = await generateReferralQrPng(url, 256);
    assert.ok(buf.length > 100);
    const meta = await sharp(buf).metadata();
    assert.equal(meta.width, 256);
    assert.equal(meta.height, 256);
  });

  it("API route uses active partner session helper", async () => {
    const route = await readFile(
      join(
        root,
        "src/app/api/partner/media/print/[assetId]/route.ts"
      ),
      "utf8"
    );
    assert.match(route, /getActivePartnerForCurrentUser/);
    assert.match(route, /buildPartnerReferralUrl/);
    assert.match(route, /personalizePrintAsset/);
  });

  it("Media Centre uses PrintResourceCard with personalized previews", async () => {
    const page = await readFile(
      join(root, "src/app/(partner)/partner/(portal)/media/page.tsx"),
      "utf8"
    );
    const card = await readFile(
      join(root, "src/components/partners/media/print-resource-card.tsx"),
      "utf8"
    );

    assert.match(page, /Print Resources/);
    assert.match(page, /MEDIA_PRINT_RESOURCES/);
    assert.match(page, /PrintResourceCard/);
    assert.doesNotMatch(page, /MEDIA_PRINT_ASSETS/);

    assert.match(card, /aspectRatio|aspect-ratio/i);
    assert.match(card, /object-contain/);
    assert.match(card, /min-h-11/);
    assert.match(card, /Personalized QR unavailable|referral link is not ready/i);
    assert.match(card, /Your QR code links contractors/i);
    assert.match(card, /\/api\/partner\/media\/print/);
    assert.doesNotMatch(card, /object-cover/);
  });

  it("builder delegates print output to the print compositor", async () => {
    const source = await readFile(
      join(root, "scripts/build-partner-media-kit.mjs"),
      "utf8"
    );
    assert.match(source, /buildAllPrintAssets/);
    assert.match(source, /partner-media-print/);
    assert.doesNotMatch(source, /buildPrintFlyer/);
  });
});
