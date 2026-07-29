import type { StudioPlatformId } from "@/lib/partners/studio/catalog";
import type { GeneratedCopy } from "@/lib/partners/studio/copy";

export type CampaignAssetDraft = {
  /** Wizard platform id, or "qr" for referral QR assets. */
  platform: StudioPlatformId | "qr";
  assetKind: "graphic" | "email" | "print" | "qr" | "banner";
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

/** Map platforms to existing Media Centre assets — do not duplicate files. */
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
    previewSrc: "/media-kit/social/jobproof-facebook-post-1080.png",
    downloadHref: "/media-kit/social/jobproof-facebook-post-1080.png",
    downloadFileName: "jobproof-facebook-post-1080.png",
  },
  instagram_post: {
    kind: "graphic",
    title: "Instagram Post",
    previewSrc: "/media-kit/social/jobproof-instagram-post-1080.png",
    downloadHref: "/media-kit/social/jobproof-instagram-post-1080.png",
    downloadFileName: "jobproof-instagram-post-1080.png",
  },
  instagram_story: {
    kind: "graphic",
    title: "Instagram Story",
    previewSrc: "/media-kit/social/jobproof-instagram-story-1080x1920.png",
    downloadHref: "/media-kit/social/jobproof-instagram-story-1080x1920.png",
    downloadFileName: "jobproof-instagram-story-1080x1920.png",
  },
  linkedin: {
    kind: "graphic",
    title: "LinkedIn",
    previewSrc: "/media-kit/social/jobproof-linkedin-1200x627.png",
    downloadHref: "/media-kit/social/jobproof-linkedin-1200x627.png",
    downloadFileName: "jobproof-linkedin-1200x627.png",
  },
  x: {
    kind: "graphic",
    title: "X",
    previewSrc: "/media-kit/social/jobproof-twitter-1600x900.png",
    downloadHref: "/media-kit/social/jobproof-twitter-1600x900.png",
    downloadFileName: "jobproof-twitter-1600x900.png",
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
    previewSrc: "/media-kit/website/jobproof-banner-1600.png",
    downloadHref: "/media-kit/website/jobproof-banner-1600.png",
    downloadFileName: "jobproof-banner-1600.png",
  },
  rack_card: {
    kind: "print",
    title: "Rack Card",
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

  return drafts;
}
