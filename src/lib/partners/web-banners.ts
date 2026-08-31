/**
 * JobProof Media Kit v2 — Website & Display Banner definitions.
 * Paths must match scripts/partner-media-web-banners.mjs output.
 */

export type WebBannerCampaignId =
  | "win-more-work"
  | "complete-journey"
  | "protect-earned-revenue";

export type WebBannerFormatGroupId =
  | "hero-1920x480"
  | "banner-1600x400"
  | "leaderboard-728x90"
  | "rectangle-300x250"
  | "skyscraper-160x600";

export type WebBannerAsset = {
  id: string;
  campaignId: WebBannerCampaignId;
  campaignTitle: string;
  headline: string;
  supporting: string | null;
  cta: string;
  href: string;
  fileName: string;
  width: number;
  height: number;
  dimensionsLabel: string;
};

export type WebBannerFormatGroup = {
  id: WebBannerFormatGroupId;
  section: "website" | "display";
  title: string;
  dimensionsLabel: string;
  width: number;
  height: number;
  recommendedUse: string;
  /** Preview presentation hint for the Media Centre card. */
  previewStyle: "wide" | "leaderboard" | "rectangle" | "skyscraper";
  assets: WebBannerAsset[];
};

function assetPath(
  folder: string,
  slug: string,
  width: number,
  height: number
): { href: string; fileName: string } {
  const fileName = `jobproof-${slug}-${width}x${height}.png`;
  return {
    href: `/media-kit/web/${folder}/${fileName}`,
    fileName,
  };
}

const CAMPAIGN_META: Record<
  WebBannerCampaignId,
  { title: string; headline: string; supporting: string | null; cta: string }
> = {
  "win-more-work": {
    title: "Win More Work",
    headline: "Win more work.",
    supporting: "Turn more opportunities into paying jobs.",
    cta: "Try JobProof",
  },
  "complete-journey": {
    title: "Complete Journey",
    headline: "Win the job. Manage the work. Get paid.",
    supporting: "From quote request to payment — in one place.",
    cta: "Try JobProof",
  },
  "protect-earned-revenue": {
    title: "Protect What You've Earned",
    headline: "Protect what you've earned.",
    supporting:
      "Contracts, changes, approvals and job records in one place.",
    cta: "Learn more",
  },
};

function makeAssets(
  folder: string,
  width: number,
  height: number,
  campaignIds: WebBannerCampaignId[],
  overrides?: Partial<
    Record<
      WebBannerCampaignId,
      { headline?: string; supporting?: string | null; cta?: string }
    >
  >
): WebBannerAsset[] {
  return campaignIds.map((campaignId) => {
    const meta = CAMPAIGN_META[campaignId];
    const over = overrides?.[campaignId];
    const { href, fileName } = assetPath(folder, campaignId, width, height);
    return {
      id: `${folder}-${campaignId}`,
      campaignId,
      campaignTitle: meta.title,
      headline: over?.headline ?? meta.headline,
      supporting:
        over?.supporting !== undefined ? over.supporting : meta.supporting,
      cta: over?.cta ?? meta.cta,
      href,
      fileName,
      width,
      height,
      dimensionsLabel: `${width}×${height}`,
    };
  });
}

export const MEDIA_WEB_BANNER_GROUPS: WebBannerFormatGroup[] = [
  {
    id: "hero-1920x480",
    section: "website",
    title: "1920×480 Hero",
    dimensionsLabel: "1920×480",
    width: 1920,
    height: 480,
    recommendedUse: "Partner site heroes and landing page headers.",
    previewStyle: "wide",
    assets: makeAssets("hero-1920x480", 1920, 480, [
      "win-more-work",
      "complete-journey",
      "protect-earned-revenue",
    ]),
  },
  {
    id: "banner-1600x400",
    section: "website",
    title: "1600×400 Banner",
    dimensionsLabel: "1600×400",
    width: 1600,
    height: 400,
    recommendedUse: "Website headers and campaign pages.",
    previewStyle: "wide",
    assets: makeAssets("banner-1600x400", 1600, 400, [
      "win-more-work",
      "complete-journey",
      "protect-earned-revenue",
    ]),
  },
  {
    id: "leaderboard-728x90",
    section: "display",
    title: "728×90 Leaderboard",
    dimensionsLabel: "728×90",
    width: 728,
    height: 90,
    recommendedUse: "Association sites, newsletters, and display placements.",
    previewStyle: "leaderboard",
    assets: makeAssets(
      "leaderboard-728x90",
      728,
      90,
      ["win-more-work", "complete-journey"],
      {
        "win-more-work": {
          headline: "Win more work with JobProof",
          supporting: null,
          cta: "Try JobProof",
        },
        "complete-journey": {
          headline: "Win the job. Manage the work. Get paid.",
          supporting: null,
          cta: "Learn more",
        },
      }
    ),
  },
  {
    id: "rectangle-300x250",
    section: "display",
    title: "300×250 Medium Rectangle",
    dimensionsLabel: "300×250",
    width: 300,
    height: 250,
    recommendedUse: "Sidebars, content embeds, and standard display ads.",
    previewStyle: "rectangle",
    assets: makeAssets(
      "rectangle-300x250",
      300,
      250,
      ["win-more-work", "complete-journey", "protect-earned-revenue"],
      {
        "win-more-work": {
          supporting: "Turn opportunities into paying jobs.",
        },
        "complete-journey": {
          supporting: null,
        },
        "protect-earned-revenue": {
          supporting: "Clear records from contract to payment.",
          cta: "Learn more",
        },
      }
    ),
  },
  {
    id: "skyscraper-160x600",
    section: "display",
    title: "160×600 Skyscraper",
    dimensionsLabel: "160×600",
    width: 160,
    height: 600,
    recommendedUse: "Sidebar advertising and directory sites.",
    previewStyle: "skyscraper",
    assets: makeAssets(
      "skyscraper-160x600",
      160,
      600,
      ["win-more-work", "complete-journey"],
      {
        "win-more-work": {
          headline: "Win more work.",
          supporting: "Turn more opportunities into paying jobs.",
          cta: "Try JobProof",
        },
        "complete-journey": {
          headline: "Win the job. Manage the work. Get paid.",
          supporting: null,
          cta: "Learn more",
        },
      }
    ),
  },
];

/** Default Studio / legacy website path — Campaign A 1600×400. */
export const WEB_BANNER_STUDIO_DEFAULT =
  "/media-kit/web/banner-1600x400/jobproof-win-more-work-1600x400.png";

/** Legacy Media Centre flat list paths (Campaign A compatibility copies). */
export const WEB_BANNER_LEGACY_COMPAT_PATHS = [
  "/media-kit/website/jobproof-banner-1920.png",
  "/media-kit/website/jobproof-banner-1600.png",
  "/media-kit/website/jobproof-banner-728x90.png",
  "/media-kit/website/jobproof-banner-300x250.png",
  "/media-kit/website/jobproof-banner-160x600.png",
] as const;

export function allWebBannerAssets(): WebBannerAsset[] {
  return MEDIA_WEB_BANNER_GROUPS.flatMap((g) => g.assets);
}
