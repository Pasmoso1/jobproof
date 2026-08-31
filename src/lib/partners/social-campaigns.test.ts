import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  MEDIA_SOCIAL_CAMPAIGNS,
  SOCIAL_CAMPAIGN_STUDIO_DEFAULTS,
} from "@/lib/partners/social-campaigns";
import {
  PARTNER_LINK_TOKEN,
  personalizePartnerCopy,
} from "@/lib/partners/media-center-content";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

const EXPECTED_IDS = [
  "win-more-work",
  "turn-quotes-into-jobs",
  "easier-to-hire",
  "get-paid",
  "protect-earned-revenue",
  "quote-to-payment",
] as const;

const FORMAT_IDS = ["square", "portrait", "story", "linkedin", "x"] as const;

describe("Media Kit v2 social campaigns", () => {
  it("defines six growth-first campaigns with platform formats", () => {
    assert.equal(MEDIA_SOCIAL_CAMPAIGNS.length, 6);
    assert.deepEqual(
      MEDIA_SOCIAL_CAMPAIGNS.map((c) => c.id),
      [...EXPECTED_IDS]
    );

    for (const campaign of MEDIA_SOCIAL_CAMPAIGNS) {
      assert.ok(campaign.title.length > 0);
      assert.ok(campaign.headline.length > 0);
      assert.ok(campaign.shortDescription.length > 0);
      assert.equal(campaign.formats.length, 5);
      assert.deepEqual(
        campaign.formats.map((f) => f.id),
        [...FORMAT_IDS]
      );
      for (const format of campaign.formats) {
        assert.equal(
          format.href,
          `/media-kit/social/${campaign.folder}/jobproof-${campaign.id}-${format.id}.png`
        );
        assert.equal(
          format.fileName,
          `jobproof-${campaign.id}-${format.id}.png`
        );
        const absolute = join(root, "public", format.href.replace(/^\//, ""));
        assert.equal(
          existsSync(absolute),
          true,
          `missing campaign asset ${format.href}`
        );
      }
    }
  });

  it("ships expected pixel dimensions per format", () => {
    const expected: Record<string, [number, number]> = {
      square: [1080, 1080],
      portrait: [1080, 1350],
      story: [1080, 1920],
      linkedin: [1200, 627],
      x: [1600, 900],
    };
    for (const campaign of MEDIA_SOCIAL_CAMPAIGNS) {
      for (const format of campaign.formats) {
        const [w, h] = expected[format.id];
        assert.equal(format.width, w);
        assert.equal(format.height, h);
      }
    }
  });

  it("pairs each campaign with a caption that personalizes the referral URL", () => {
    for (const campaign of MEDIA_SOCIAL_CAMPAIGNS) {
      assert.match(campaign.caption, /\[PARTNER LINK\]/);
      assert.equal(PARTNER_LINK_TOKEN, "[PARTNER LINK]");
      const personalized = personalizePartnerCopy(
        campaign.caption,
        "https://jobproof.ca/signup?ref=TESTCODE"
      );
      assert.doesNotMatch(personalized, /\[PARTNER LINK\]/);
      assert.match(
        personalized,
        /https:\/\/jobproof\.ca\/signup\?ref=TESTCODE/
      );
      assert.ok(
        personalizePartnerCopy(campaign.caption, null).includes(
          PARTNER_LINK_TOKEN
        )
      );
    }
  });

  it("avoids guaranteed-results marketing claims", () => {
    const banned =
      /guarantees? more jobs|increase your income|guaranteed revenue|guaranteed faster payment|guaranteed conversion|get paid faster|\d+%\s*(more|increase)/i;
    for (const campaign of MEDIA_SOCIAL_CAMPAIGNS) {
      const blob = [
        campaign.title,
        campaign.shortDescription,
        campaign.headline,
        campaign.supportingLine,
        campaign.cta,
        campaign.caption,
      ].join("\n");
      assert.doesNotMatch(blob, banned);
    }
  });

  it("exposes Studio defaults under the win-more-work campaign folder", () => {
    for (const href of Object.values(SOCIAL_CAMPAIGN_STUDIO_DEFAULTS)) {
      assert.match(href, /^\/media-kit\/social\/win-more-work\//);
      assert.equal(
        existsSync(join(root, "public", href.replace(/^\//, ""))),
        true,
        `missing studio default ${href}`
      );
    }
  });
});
