import type { StudioPlatformId } from "@/lib/partners/studio/catalog";
import type { GeneratedCopy } from "@/lib/partners/studio/copy";
import { buildCoBrandDataUrl } from "@/lib/partners/studio/co-brand";
import { SOCIAL_CAMPAIGN_STUDIO_DEFAULTS } from "@/lib/partners/social-campaigns";
import { WEB_BANNER_STUDIO_DEFAULT } from "@/lib/partners/web-banners";

export type CampaignAssetDraft = {
  /** Wizard platform id, or "qr" / "co_brand" for referral / co-brand assets. */
  platform: StudioPlatformId | "qr" | "co_brand";
  assetKind: "graphic" | "email" | "print" | "qr" | "banner" | "co_brand";
  title: string;
  previewSrc: string | null;
  downloadHref: string | null;
  downloadFileName: string | null;
  secondaryDownloadHref: string | null;
  secondaryDownloadFileName: string | null;
  caption: string | null;
  postBody: string | null;
  emailHtml: string | null;
  emailText: string | null;
  emailSubject: string | null;
  sortOrder: number;
  metadata: Record<string, unknown>;
};

/** Map platforms to Media Kit v2 campaign graphics — do not duplicate files. */
const PLATFORM_MEDIA: Record<
  StudioPlatformId,
  {
    kind: CampaignAssetDraft["assetKind"];
    title: string;
    previewSrc: string | null;
    downloadHref: string | null;
    downloadFileName: string | null;
    secondaryDownloadHref?: string | null;
    secondaryDownloadFileName?: string | null;
  }
> = {
  facebook: {
    kind: "graphic",
    title: "Facebook",
    previewSrc: SOCIAL_CAMPAIGN_STUDIO_DEFAULTS.square,
    downloadHref: SOCIAL_CAMPAIGN_STUDIO_DEFAULTS.square,
    downloadFileName: "jobproof-win-more-work-square.png",
  },
  instagram_post: {
    kind: "graphic",
    title: "Instagram Post",
    previewSrc: SOCIAL_CAMPAIGN_STUDIO_DEFAULTS.square,
    downloadHref: SOCIAL_CAMPAIGN_STUDIO_DEFAULTS.square,
    downloadFileName: "jobproof-win-more-work-square.png",
  },
  instagram_story: {
    kind: "graphic",
    title: "Instagram Story",
    previewSrc: SOCIAL_CAMPAIGN_STUDIO_DEFAULTS.story,
    downloadHref: SOCIAL_CAMPAIGN_STUDIO_DEFAULTS.story,
    downloadFileName: "jobproof-win-more-work-story.png",
  },
  linkedin: {
    kind: "graphic",
    title: "LinkedIn",
    previewSrc: SOCIAL_CAMPAIGN_STUDIO_DEFAULTS.linkedin,
    downloadHref: SOCIAL_CAMPAIGN_STUDIO_DEFAULTS.linkedin,
    downloadFileName: "jobproof-win-more-work-linkedin.png",
  },
  x: {
    kind: "graphic",
    title: "X",
    previewSrc: SOCIAL_CAMPAIGN_STUDIO_DEFAULTS.x,
    downloadHref: SOCIAL_CAMPAIGN_STUDIO_DEFAULTS.x,
    downloadFileName: "jobproof-win-more-work-x.png",
  },
  email: {
    kind: "email",
    title: "Email",
    previewSrc: "/media-kit/logos/jobproof-compact-horizontal.png",
    downloadHref: "/media-kit/email/introduction-email.html",
    downloadFileName: "jobproof-campaign-email.html",
  },
  website_banner: {
    kind: "banner",
    title: "Website Banner",
    previewSrc: WEB_BANNER_STUDIO_DEFAULT,
    downloadHref: WEB_BANNER_STUDIO_DEFAULT,
    downloadFileName: "jobproof-win-more-work-1600x400.png",
  },
  rack_card: {
    kind: "print",
    title: "Rack Card",
    /** Static base assets; personalized downloads live in Media Centre API. */
    previewSrc: "/media-kit/print/jobproof-rack-card.png",
    downloadHref: "/media-kit/print/jobproof-rack-card.pdf",
    downloadFileName: "jobproof-rack-card.pdf",
    secondaryDownloadHref: "/media-kit/print/jobproof-rack-card.png",
    secondaryDownloadFileName: "jobproof-rack-card.png",
  },
  flyer: {
    kind: "print",
    title: "Flyer",
    previewSrc: "/media-kit/print/jobproof-flyer-letter.png",
    downloadHref: "/media-kit/print/jobproof-flyer-letter.pdf",
    downloadFileName: "jobproof-flyer-letter.pdf",
    secondaryDownloadHref: "/media-kit/print/jobproof-flyer-letter.png",
    secondaryDownloadFileName: "jobproof-flyer-letter.png",
  },
  poster: {
    kind: "print",
    title: "Poster",
    previewSrc: "/media-kit/print/jobproof-poster.png",
    downloadHref: "/media-kit/print/jobproof-poster.pdf",
    downloadFileName: "jobproof-poster.pdf",
    secondaryDownloadHref: "/media-kit/print/jobproof-poster.png",
    secondaryDownloadFileName: "jobproof-poster.png",
  },
};

export function buildQrImageUrl(referralUrl: string, size = 512): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(referralUrl)}`;
}

export function buildCampaignAssetDrafts(input: {
  platforms: StudioPlatformId[];
  copy: GeneratedCopy;
  referralUrl: string;
  organizationName?: string;
  organizationLogoUrl?: string | null;
  includeCoBrand?: boolean;
}): CampaignAssetDraft[] {
  const drafts: CampaignAssetDraft[] = [];
  let order = 0;

  for (const platform of input.platforms) {
    const media = PLATFORM_MEDIA[platform];
    const isEmail = platform === "email";
    const isSocial = [
      "facebook",
      "instagram_post",
      "instagram_story",
      "linkedin",
      "x",
    ].includes(platform);

    drafts.push({
      platform,
      assetKind: media.kind,
      title: media.title,
      previewSrc: media.previewSrc,
      downloadHref: isEmail ? null : media.downloadHref,
      downloadFileName: isEmail ? null : media.downloadFileName,
      secondaryDownloadHref: media.secondaryDownloadHref ?? null,
      secondaryDownloadFileName: media.secondaryDownloadFileName ?? null,
      caption: isSocial ? input.copy.caption : null,
      postBody: platform === "linkedin" || platform === "facebook" ? input.copy.postBody : isSocial ? input.copy.caption : null,
      emailHtml: isEmail ? input.copy.emailHtml : null,
      emailText: isEmail ? input.copy.emailText : null,
      emailSubject: isEmail ? input.copy.emailSubject : null,
      sortOrder: order++,
      metadata: {
        source: "media-kit",
        personalized: true,
      },
    });
  }

  // Always include referral QR for the campaign
  const qr = buildQrImageUrl(input.referralUrl, 512);
  const qrPrint = buildQrImageUrl(input.referralUrl, 1024);
  drafts.push({
    platform: "qr",
    assetKind: "qr",
    title: "Referral QR Code",
    previewSrc: qr,
    downloadHref: qr,
    downloadFileName: "jobproof-partner-referral-qr.png",
    secondaryDownloadHref: qrPrint,
    secondaryDownloadFileName: "jobproof-partner-referral-qr-print.png",
    caption: null,
    postBody: null,
    emailHtml: null,
    emailText: null,
    emailSubject: null,
    sortOrder: order++,
    metadata: {
      source: "qr-api",
      referralUrl: input.referralUrl,
      printSize: 1024,
    },
  });

  if (input.includeCoBrand && input.organizationName) {
    const recommendedBy = buildCoBrandDataUrl({
      organizationName: input.organizationName,
      referralUrl: input.referralUrl,
      organizationLogoUrl: input.organizationLogoUrl,
      layout: "recommended_by",
      headline: input.copy.headline,
    });
    const logoStack = buildCoBrandDataUrl({
      organizationName: input.organizationName,
      referralUrl: input.referralUrl,
      organizationLogoUrl: input.organizationLogoUrl,
      layout: "logo_stack",
      headline: input.copy.headline,
    });

    drafts.push({
      platform: "co_brand",
      assetKind: "co_brand",
      title: "Co-branded Graphic (Recommended by)",
      previewSrc: recommendedBy,
      downloadHref: recommendedBy,
      downloadFileName: "jobproof-cobrand-recommended-by.svg",
      secondaryDownloadHref: logoStack,
      secondaryDownloadFileName: "jobproof-cobrand-logo-stack.svg",
      caption: null,
      postBody: null,
      emailHtml: null,
      emailText: null,
      emailSubject: null,
      sortOrder: order++,
      metadata: {
        source: "co-brand",
        organizationName: input.organizationName,
        hasOrganizationLogo: Boolean(input.organizationLogoUrl),
        layouts: ["recommended_by", "logo_stack"],
      },
    });
  }

  return drafts;
}
