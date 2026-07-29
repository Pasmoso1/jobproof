import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  STUDIO_AUDIENCES,
  STUDIO_PLATFORMS,
  STUDIO_TAGLINE,
  STUDIO_THEMES,
  isStudioPlatformId,
  isStudioThemeId,
} from "@/lib/partners/studio/catalog";
import { generateStudioCopy } from "@/lib/partners/studio/copy";
import { buildCampaignAssetDrafts, buildQrImageUrl } from "@/lib/partners/studio/assets";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

describe("partner marketing studio catalog", () => {
  it("includes required themes, audiences, and platforms", () => {
    assert.ok(STUDIO_THEMES.some((t) => t.id === "everything_jobproof"));
    assert.ok(STUDIO_THEMES.some((t) => t.id === "getting_more_jobs"));
    assert.ok(STUDIO_AUDIENCES.length >= 10);
    assert.ok(STUDIO_PLATFORMS.some((p) => p.id === "facebook"));
    assert.ok(STUDIO_PLATFORMS.some((p) => p.id === "flyer"));
    assert.match(STUDIO_TAGLINE, /Win more work/i);
    assert.equal(isStudioThemeId("contracts"), true);
    assert.equal(isStudioThemeId("not-real"), false);
    assert.equal(isStudioPlatformId("linkedin"), true);
  });
});

describe("partner marketing studio copy", () => {
  it("personalizes copy with referral URL and full-platform messaging", () => {
    const copy = generateStudioCopy({
      theme: "everything_jobproof",
      audience: "roofers",
      organizationName: "ABC Roofing",
      referralUrl: "https://jobproof.ca/signup?ref=ABC123",
      isFounding: true,
      variant: "professional",
    });
    assert.match(copy.caption, /https:\/\/jobproof\.ca\/signup\?ref=ABC123/);
    assert.match(copy.caption, /ABC Roofing/);
    assert.match(copy.caption, /Founding Partner/);
    assert.match(copy.postBody, /Create quotes/i);
    assert.match(copy.postBody, /Manage change orders/i);
    assert.match(copy.emailSubject, /JobProof/);
    assert.match(copy.emailHtml, /Explore JobProof/);
  });

  it("supports short copy variants without dropping the referral link", () => {
    const copy = generateStudioCopy({
      theme: "professional_quotes",
      audience: "electricians",
      organizationName: "Spark Co",
      referralUrl: "https://jobproof.ca/signup?ref=ZZZ",
      isFounding: false,
      variant: "short",
    });
    assert.match(copy.caption, /ref=ZZZ/);
    assert.ok(copy.caption.length < 500);
  });
});

describe("partner marketing studio assets", () => {
  it("reuses Media Centre files and includes QR personalization", () => {
    const copy = generateStudioCopy({
      theme: "getting_paid_faster",
      audience: "general_contractors",
      organizationName: "Build Co",
      referralUrl: "https://jobproof.ca/signup?ref=BUILD1",
      isFounding: false,
      variant: "professional",
    });
    const drafts = buildCampaignAssetDrafts({
      platforms: ["facebook", "email", "flyer"],
      copy,
      referralUrl: "https://jobproof.ca/signup?ref=BUILD1",
    });
    assert.ok(drafts.some((d) => d.platform === "facebook"));
    assert.ok(drafts.some((d) => d.assetKind === "email"));
    assert.ok(drafts.some((d) => d.assetKind === "qr"));

    const facebook = drafts.find((d) => d.platform === "facebook")!;
    assert.ok(facebook.previewSrc?.startsWith("/media-kit/"));
    const absolute = join(root, "public", facebook.previewSrc!.replace(/^\//, ""));
    assert.equal(existsSync(absolute), true, `missing ${facebook.previewSrc}`);

    const flyer = drafts.find((d) => d.platform === "flyer")!;
    assert.ok(flyer.downloadHref?.endsWith(".pdf"));
    assert.ok(flyer.secondaryDownloadHref?.endsWith(".png"));

    const qr = buildQrImageUrl("https://jobproof.ca/signup?ref=BUILD1");
    assert.match(qr, /create-qr-code/);
    assert.match(qr, /BUILD1/);
  });
});

describe("partner marketing studio route wiring", () => {
  it("registers Marketing Studio in partner portal navigation", async () => {
    const layoutPath = join(
      root,
      "src/app/(partner)/partner/(portal)/layout.tsx"
    );
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(layoutPath, "utf8")
    );
    assert.match(source, /href: "\/partner\/studio"/);
    assert.match(source, /Marketing Studio/);
    assert.match(source, /href: "\/partner\/media"/);
  });

  it("keeps Media Centre route intact", async () => {
    const pagePath = join(
      root,
      "src/app/(partner)/partner/(portal)/media/page.tsx"
    );
    assert.equal(existsSync(pagePath), true);
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(pagePath, "utf8")
    );
    assert.match(source, /Brand Assets/);
    assert.match(source, /Partner Media Centre/);
    assert.doesNotMatch(source, /Partner Media Center/);
  });

  it("adds studio pages for landing, create, history, and campaign detail", () => {
    assert.equal(
      existsSync(
        join(root, "src/app/(partner)/partner/(portal)/studio/page.tsx")
      ),
      true
    );
    assert.equal(
      existsSync(
        join(root, "src/app/(partner)/partner/(portal)/studio/create/page.tsx")
      ),
      true
    );
    assert.equal(
      existsSync(
        join(root, "src/app/(partner)/partner/(portal)/studio/history/page.tsx")
      ),
      true
    );
    assert.equal(
      existsSync(
        join(
          root,
          "src/app/(partner)/partner/(portal)/studio/campaigns/[campaignId]/page.tsx"
        )
      ),
      true
    );
  });

  it("ships migration 064 for campaigns, logos, and storage RLS", async () => {
    const migration = join(
      root,
      "supabase/migrations/064_partner_marketing_studio.sql"
    );
    assert.equal(existsSync(migration), true);
    const sql = await import("node:fs/promises").then((fs) =>
      fs.readFile(migration, "utf8")
    );
    assert.match(sql, /partner_campaigns/);
    assert.match(sql, /partner_campaign_assets/);
    assert.match(sql, /partner_campaign_downloads/);
    assert.match(sql, /partner_uploaded_logos/);
    assert.match(sql, /partner-logos/);
    assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  });
});

describe("partner marketing studio actions type-erasure safety", () => {
  const actionsPath = join(root, "src/lib/partners/studio/actions.ts");
  const bannedTypeNames = [
    "StudioAudienceId",
    "StudioThemeId",
    "StudioStyleId",
    "StudioCopyVariantId",
    "StudioGoalId",
    "StudioPlatformId",
  ] as const;

  it("use-server actions module does not export or re-export TypeScript-only types", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(actionsPath, "utf8")
    );

    assert.match(source, /^["']use server["']/m);
    assert.doesNotMatch(source, /\bexport\s+type\b/);
    assert.doesNotMatch(source, /\bexport\s+interface\b/);
    assert.doesNotMatch(source, /\bexport\s+type\s*\{/);

    for (const name of bannedTypeNames) {
      assert.doesNotMatch(
        source,
        new RegExp(`export\\s+type\\s*\\{[^}]*\\b${name}\\b`),
        `must not re-export ${name}`
      );
      assert.doesNotMatch(
        source,
        new RegExp(`export\\s*\\{[^}]*\\b${name}\\b`),
        `must not value-export ${name}`
      );
      // Types may only appear via `import type`
      const valueImport = new RegExp(
        `import\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from`
      );
      if (valueImport.test(source)) {
        assert.match(
          source,
          new RegExp(`import\\s+type\\s*\\{[^}]*\\b${name}\\b`),
          `${name} must use import type, not a value import`
        );
        assert.doesNotMatch(
          source,
          new RegExp(
            `import\\s*\\{(?:(?!type)[^}])*\\b${name}\\b[^}]*\\}\\s*from\\s*["']@/lib/partners/studio/catalog["']`
          ),
          `${name} must not be mixed into a runtime catalog import`
        );
      }
    }

    assert.match(source, /export async function createStudioCampaign/);
    assert.match(source, /export async function regenerateStudioCampaignCopy/);
    assert.match(source, /export async function uploadPartnerStudioLogo/);
  });

  it("transpiled studio actions module erases Studio*Id type identifiers", async () => {
    const ts = await import("typescript");
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(actionsPath, "utf8")
    );
    const code = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        esModuleInterop: true,
        verbatimModuleSyntax: true,
        isolatedModules: true,
      },
      fileName: "actions.ts",
    }).outputText;

    for (const name of bannedTypeNames) {
      assert.doesNotMatch(code, new RegExp(`\\b${name}\\b`), name);
    }
    assert.match(code, /\bcreateStudioCampaign\b/);
    assert.match(code, /\blistPartnerCampaigns\b/);
  });

  it("studio UI imports Studio*Id types from catalog, not actions", async () => {
    const files = [
      "src/components/partners/studio/studio-campaign-wizard.tsx",
      "src/components/partners/studio/studio-copy-variant-bar.tsx",
      "src/components/partners/studio/studio-asset-card.tsx",
      "src/app/(partner)/partner/(portal)/studio/page.tsx",
      "src/app/(partner)/partner/(portal)/studio/create/page.tsx",
      "src/app/(partner)/partner/(portal)/studio/history/page.tsx",
      "src/app/(partner)/partner/(portal)/studio/campaigns/[campaignId]/page.tsx",
    ];

    for (const rel of files) {
      const source = await import("node:fs/promises").then((fs) =>
        fs.readFile(join(root, rel), "utf8")
      );
      for (const name of bannedTypeNames) {
        assert.doesNotMatch(
          source,
          new RegExp(
            `import\\s+(type\\s+)?\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from\\s*["']@/lib/partners/studio/actions["']`
          ),
          `${rel} must not import ${name} from actions.ts`
        );
      }
      assert.doesNotMatch(
        source,
        /import\s+type\s*\{[^}]*StudioCampaignAssetRow[^}]*\}\s*from\s*["']@\/lib\/partners\/studio\/actions["']/,
        `${rel} must not import StudioCampaignAssetRow from actions.ts`
      );
    }

    const wizard = await import("node:fs/promises").then((fs) =>
      fs.readFile(
        join(root, "src/components/partners/studio/studio-campaign-wizard.tsx"),
        "utf8"
      )
    );
    assert.match(
      wizard,
      /import\s*\{[^}]*type\s+StudioThemeId[^}]*\}\s*from\s*["']@\/lib\/partners\/studio\/catalog["']/
    );
  });
});
