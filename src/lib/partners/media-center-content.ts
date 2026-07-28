import {
  FOUNDING_REWARD_CAD,
  PARTNER_QUALIFICATION_DAYS,
  STANDARD_REWARD_CAD,
  type PartnerLevel,
} from "@/lib/partners/constants";
import { getPublicPlanPriceLine } from "@/lib/billing-plan-display";

export type MediaAsset = {
  id: string;
  name: string;
  description: string;
  previewSrc: string;
  previewAlt: string;
  dimensionsLabel: string;
  recommendedUse: string;
  availableFormats: string;
  previewTone?: "light" | "dark" | "checkered";
  downloads: Array<{ label: string; href: string; fileName: string }>;
};

export type CopyBlock = {
  id: string;
  title: string;
  intendedUse: string;
  body: string;
};

export type BrandColor = {
  name: string;
  hex: string;
  note?: string;
};

export type ComingSoonResource = {
  id: string;
  title: string;
  description: string;
};

export type MediaFaqItem = {
  question: string;
  answer: string;
};

export type EmailResource = {
  id: string;
  title: string;
  description: string;
  htmlHref?: string;
  htmlFileName?: string;
  textBody: string;
  subjects?: string[];
};

export const MEDIA_CENTER_NOTICE =
  "Please use only the approved assets and wording provided here. Do not alter the JobProof logo, make unsupported product claims, or imply that JobProof endorses your business.";

export const MEDIA_CENTER_MISSION =
  "Help contractors win more jobs, get paid faster, and protect every project.";

export const MEDIA_CENTER_POSITIONING =
  "JobProof is an all-in-one contractor business platform that helps contractors manage the customer journey from the initial quote request through approvals, project records, invoicing, payment, and ongoing business protection.";

export const MEDIA_CENTER_PERSONALITY = [
  "Professional",
  "Trustworthy",
  "Modern",
  "Contractor-first",
  "Efficient",
  "Clear",
  "Helpful",
] as const;

/** Canonical brand colours verified against JobProof logo assets. */
export const MEDIA_CENTER_BRAND_COLORS: BrandColor[] = [
  {
    name: "JobProof Blue",
    hex: "#2436BB",
    note: "Primary brand blue used across the product UI.",
  },
  {
    name: "Bright Blue",
    hex: "#2C37EC",
    note: "Accent blue from the brand assets.",
  },
  {
    name: "Soft Teal",
    hex: "#4DB6AC",
    note: "Supporting teal from the brand assets.",
  },
  {
    name: "Proof Teal",
    hex: "#4DBACC",
    note: "Used in logo accents and Proof lettering.",
  },
  {
    name: "Accent Orange",
    hex: "#F28C38",
    note: "Shield highlight and CTA accent.",
  },
  {
    name: "White",
    hex: "#FFFFFF",
    note: "Checkmark and Job lettering.",
  },
];

export const LOGO_USAGE_APPROVED = [
  "Use the supplied full-colour logo.",
  "Maintain the original aspect ratio.",
  "Leave adequate clear space around it.",
  "Use a high-resolution version appropriate to the placement.",
  "Place it on a background with strong contrast.",
] as const;

export const LOGO_USAGE_NOT_APPROVED = [
  "Stretching or compressing",
  "Rotating",
  "Recolouring",
  "Rearranging the shield and wordmark",
  "Adding new shadows, outlines, or effects",
  "Placing over visually busy imagery",
  "Cropping part of the logo",
  "Using a low-resolution file in a large placement",
] as const;

export const MEDIA_BRAND_ASSETS: MediaAsset[] = [
  {
    id: "primary-horizontal",
    name: "Primary Horizontal Logo",
    description: "Full-colour horizontal lockup for primary brand placements.",
    recommendedUse:
      "Websites, presentations, newsletters, and larger digital placements.",
    availableFormats: "PNG · transparent",
    previewSrc: "/media-kit/logos/jobproof-primary-horizontal.png",
    previewAlt: "JobProof primary horizontal logo",
    dimensionsLabel: "Large transparent PNG",
    previewTone: "checkered",
    downloads: [
      {
        label: "Download PNG",
        href: "/media-kit/logos/jobproof-primary-horizontal.png",
        fileName: "jobproof-primary-horizontal.png",
      },
    ],
  },
  {
    id: "secondary-horizontal",
    name: "Secondary Horizontal Logo",
    description: "Medium horizontal lockup for everyday marketing use.",
    recommendedUse: "Website headers, partner pages, and mid-size placements.",
    availableFormats: "PNG · transparent",
    previewSrc: "/media-kit/logos/jobproof-secondary-horizontal.png",
    previewAlt: "JobProof secondary horizontal logo",
    dimensionsLabel: "Medium transparent PNG",
    previewTone: "checkered",
    downloads: [
      {
        label: "Download PNG",
        href: "/media-kit/logos/jobproof-secondary-horizontal.png",
        fileName: "jobproof-secondary-horizontal.png",
      },
    ],
  },
  {
    id: "compact-horizontal",
    name: "Compact Horizontal Logo",
    description: "Narrow lockup for constrained layouts.",
    recommendedUse: "Email headers, sponsor rows, and compact navigation.",
    availableFormats: "PNG · transparent",
    previewSrc: "/media-kit/logos/jobproof-compact-horizontal.png",
    previewAlt: "JobProof compact horizontal logo",
    dimensionsLabel: "Compact transparent PNG",
    previewTone: "checkered",
    downloads: [
      {
        label: "Download PNG",
        href: "/media-kit/logos/jobproof-compact-horizontal.png",
        fileName: "jobproof-compact-horizontal.png",
      },
    ],
  },
  {
    id: "shield-icon",
    name: "Shield Icon",
    description: "Standalone JobProof shield mark.",
    recommendedUse:
      "Profile images, app references, social avatars, and small placements.",
    availableFormats: "PNG · 1024 / 512 / 256 / 128 / 64 / 32",
    previewSrc: "/media-kit/icons/jobproof-shield-256.png",
    previewAlt: "JobProof shield icon",
    dimensionsLabel: "Multiple PNG sizes",
    previewTone: "checkered",
    downloads: [
      {
        label: "1024×1024",
        href: "/media-kit/icons/jobproof-shield-1024.png",
        fileName: "jobproof-shield-1024.png",
      },
      {
        label: "512×512",
        href: "/media-kit/icons/jobproof-shield-512.png",
        fileName: "jobproof-shield-512.png",
      },
      {
        label: "256×256",
        href: "/media-kit/icons/jobproof-shield-256.png",
        fileName: "jobproof-shield-256.png",
      },
      {
        label: "128×128",
        href: "/media-kit/icons/jobproof-shield-128.png",
        fileName: "jobproof-shield-128.png",
      },
      {
        label: "64×64",
        href: "/media-kit/icons/jobproof-shield-64.png",
        fileName: "jobproof-shield-64.png",
      },
      {
        label: "32×32",
        href: "/media-kit/icons/jobproof-shield-32.png",
        fileName: "jobproof-shield-32.png",
      },
    ],
  },
  {
    id: "app-light",
    name: "Light App Icon",
    description: "Shield on a light square for light surfaces.",
    recommendedUse: "White or light backgrounds and app-style placements.",
    availableFormats: "PNG · 512×512",
    previewSrc: "/media-kit/icons/jobproof-app-light-512.png",
    previewAlt: "JobProof light app icon",
    dimensionsLabel: "512×512 PNG",
    previewTone: "light",
    downloads: [
      {
        label: "Download PNG",
        href: "/media-kit/icons/jobproof-app-light-512.png",
        fileName: "jobproof-app-light-512.png",
      },
    ],
  },
  {
    id: "app-dark",
    name: "Dark App Icon",
    description: "Shield on a dark square for dark surfaces.",
    recommendedUse: "Dark backgrounds and app-style placements.",
    availableFormats: "PNG · 512×512",
    previewSrc: "/media-kit/icons/jobproof-app-dark-512.png",
    previewAlt: "JobProof dark app icon",
    dimensionsLabel: "512×512 PNG",
    previewTone: "dark",
    downloads: [
      {
        label: "Download PNG",
        href: "/media-kit/icons/jobproof-app-dark-512.png",
        fileName: "jobproof-app-dark-512.png",
      },
    ],
  },
  {
    id: "favicons",
    name: "Favicons",
    description: "Browser and bookmark icons from the approved favicon pack.",
    recommendedUse: "Website tabs, bookmarks, and PWA icons.",
    availableFormats: "PNG · ICO · SVG",
    previewSrc: "/media-kit/favicons/jobproof-favicon-32.png",
    previewAlt: "JobProof favicon",
    dimensionsLabel: "16 / 32 / 96 PNG · ICO · SVG",
    previewTone: "light",
    downloads: [
      {
        label: "32×32 PNG",
        href: "/media-kit/favicons/jobproof-favicon-32.png",
        fileName: "jobproof-favicon-32.png",
      },
      {
        label: "16×16 PNG",
        href: "/media-kit/favicons/jobproof-favicon-16.png",
        fileName: "jobproof-favicon-16.png",
      },
      {
        label: "96×96 PNG",
        href: "/media-kit/favicons/jobproof-favicon-96.png",
        fileName: "jobproof-favicon-96.png",
      },
      {
        label: "Download ICO",
        href: "/media-kit/favicons/jobproof-favicon.ico",
        fileName: "jobproof-favicon.ico",
      },
      {
        label: "Download SVG",
        href: "/media-kit/favicons/jobproof-favicon.svg",
        fileName: "jobproof-favicon.svg",
      },
    ],
  },
];

export const BRAND_GUIDELINES_ASSET: MediaAsset = {
  id: "brand-guidelines",
  name: "Brand Guidelines",
  description:
    "Approved logo usage, spacing, colour palette, backgrounds, typography, and tone of voice.",
  recommendedUse: "Share with designers, marketers, and co-branded partners.",
  availableFormats: "PDF",
  previewSrc: "/media-kit/logos/jobproof-secondary-horizontal.png",
  previewAlt: "JobProof brand guidelines preview",
  dimensionsLabel: "PDF download",
  previewTone: "light",
  downloads: [
    {
      label: "Download PDF",
      href: "/media-kit/brand/jobproof-brand-guidelines.pdf",
      fileName: "jobproof-brand-guidelines.pdf",
    },
  ],
};

export const MEDIA_SOCIAL_ASSETS: MediaAsset[] = [
  {
    id: "facebook-post",
    name: "Facebook Post",
    description: "Square graphic for Facebook feed posts.",
    recommendedUse: "Organic posts and paid Facebook placements.",
    availableFormats: "PNG · 1080×1080",
    previewSrc: "/media-kit/social/jobproof-facebook-post-1080.png",
    previewAlt: "JobProof Facebook post graphic",
    dimensionsLabel: "1080×1080",
    downloads: [
      {
        label: "Download PNG",
        href: "/media-kit/social/jobproof-facebook-post-1080.png",
        fileName: "jobproof-facebook-post-1080.png",
      },
    ],
  },
  {
    id: "instagram-post",
    name: "Instagram Post",
    description: "Square graphic for Instagram feed posts.",
    recommendedUse: "Instagram feed and carousel covers.",
    availableFormats: "PNG · 1080×1080",
    previewSrc: "/media-kit/social/jobproof-instagram-post-1080.png",
    previewAlt: "JobProof Instagram post graphic",
    dimensionsLabel: "1080×1080",
    downloads: [
      {
        label: "Download PNG",
        href: "/media-kit/social/jobproof-instagram-post-1080.png",
        fileName: "jobproof-instagram-post-1080.png",
      },
    ],
  },
  {
    id: "instagram-story",
    name: "Instagram Story",
    description: "Vertical story graphic.",
    recommendedUse: "Instagram and Facebook Stories.",
    availableFormats: "PNG · 1080×1920",
    previewSrc: "/media-kit/social/jobproof-instagram-story-1080x1920.png",
    previewAlt: "JobProof Instagram story graphic",
    dimensionsLabel: "1080×1920",
    downloads: [
      {
        label: "Download PNG",
        href: "/media-kit/social/jobproof-instagram-story-1080x1920.png",
        fileName: "jobproof-instagram-story-1080x1920.png",
      },
    ],
  },
  {
    id: "linkedin-graphic",
    name: "LinkedIn Graphic",
    description: "Landscape graphic for LinkedIn posts.",
    recommendedUse: "LinkedIn organic posts and company updates.",
    availableFormats: "PNG · 1200×627",
    previewSrc: "/media-kit/social/jobproof-linkedin-1200x627.png",
    previewAlt: "JobProof LinkedIn graphic",
    dimensionsLabel: "1200×627",
    downloads: [
      {
        label: "Download PNG",
        href: "/media-kit/social/jobproof-linkedin-1200x627.png",
        fileName: "jobproof-linkedin-1200x627.png",
      },
    ],
  },
  {
    id: "twitter-graphic",
    name: "X / Twitter Graphic",
    description: "Wide graphic for X posts.",
    recommendedUse: "X / Twitter feed posts and cards.",
    availableFormats: "PNG · 1600×900",
    previewSrc: "/media-kit/social/jobproof-twitter-1600x900.png",
    previewAlt: "JobProof X / Twitter graphic",
    dimensionsLabel: "1600×900",
    downloads: [
      {
        label: "Download PNG",
        href: "/media-kit/social/jobproof-twitter-1600x900.png",
        fileName: "jobproof-twitter-1600x900.png",
      },
    ],
  },
];

export const MEDIA_WEBSITE_ASSETS: MediaAsset[] = [
  {
    id: "banner-1920",
    name: "1920px Banner",
    description: "Wide website hero banner.",
    recommendedUse: "Partner sites and landing page heroes.",
    availableFormats: "PNG · 1920×480",
    previewSrc: "/media-kit/website/jobproof-banner-1920.png",
    previewAlt: "JobProof 1920px website banner",
    dimensionsLabel: "1920×480",
    downloads: [
      {
        label: "Download PNG",
        href: "/media-kit/website/jobproof-banner-1920.png",
        fileName: "jobproof-banner-1920.png",
      },
    ],
  },
  {
    id: "banner-1600",
    name: "1600px Banner",
    description: "Standard website banner.",
    recommendedUse: "Website headers and campaign pages.",
    availableFormats: "PNG · 1600×400",
    previewSrc: "/media-kit/website/jobproof-banner-1600.png",
    previewAlt: "JobProof 1600px website banner",
    dimensionsLabel: "1600×400",
    downloads: [
      {
        label: "Download PNG",
        href: "/media-kit/website/jobproof-banner-1600.png",
        fileName: "jobproof-banner-1600.png",
      },
    ],
  },
  {
    id: "banner-728x90",
    name: "728×90 Banner",
    description: "Leaderboard display banner.",
    recommendedUse: "Association sites and ad placements.",
    availableFormats: "PNG · 728×90",
    previewSrc: "/media-kit/website/jobproof-banner-728x90.png",
    previewAlt: "JobProof 728x90 banner",
    dimensionsLabel: "728×90",
    downloads: [
      {
        label: "Download PNG",
        href: "/media-kit/website/jobproof-banner-728x90.png",
        fileName: "jobproof-banner-728x90.png",
      },
    ],
  },
  {
    id: "banner-300x250",
    name: "300×250 Banner",
    description: "Medium rectangle display banner.",
    recommendedUse: "Sidebars and content embeds.",
    availableFormats: "PNG · 300×250",
    previewSrc: "/media-kit/website/jobproof-banner-300x250.png",
    previewAlt: "JobProof 300x250 banner",
    dimensionsLabel: "300×250",
    downloads: [
      {
        label: "Download PNG",
        href: "/media-kit/website/jobproof-banner-300x250.png",
        fileName: "jobproof-banner-300x250.png",
      },
    ],
  },
  {
    id: "banner-160x600",
    name: "160×600 Banner",
    description: "Wide skyscraper display banner.",
    recommendedUse: "Sidebar advertising and directory sites.",
    availableFormats: "PNG · 160×600",
    previewSrc: "/media-kit/website/jobproof-banner-160x600.png",
    previewAlt: "JobProof 160x600 banner",
    dimensionsLabel: "160×600",
    downloads: [
      {
        label: "Download PNG",
        href: "/media-kit/website/jobproof-banner-160x600.png",
        fileName: "jobproof-banner-160x600.png",
      },
    ],
  },
];

export const MEDIA_PRINT_ASSETS: MediaAsset[] = [
  {
    id: "flyer-letter",
    name: "8.5×11 Flyer",
    description: "Letter-size flyer at print resolution.",
    recommendedUse: "Handouts, leave-behinds, and association desks.",
    availableFormats: "PDF · PNG · 300 DPI",
    previewSrc: "/media-kit/print/jobproof-flyer-letter.png",
    previewAlt: "JobProof letter flyer",
    dimensionsLabel: "8.5×11 · 300 DPI",
    downloads: [
      {
        label: "Download PDF",
        href: "/media-kit/print/jobproof-flyer-letter.pdf",
        fileName: "jobproof-flyer-letter.pdf",
      },
      {
        label: "Download PNG",
        href: "/media-kit/print/jobproof-flyer-letter.png",
        fileName: "jobproof-flyer-letter.png",
      },
    ],
  },
  {
    id: "rack-card",
    name: "Rack Card",
    description: "Tall rack card for display stands.",
    recommendedUse: "Trade shows, lobbies, and partner counters.",
    availableFormats: "PDF · PNG · 300 DPI",
    previewSrc: "/media-kit/print/jobproof-rack-card.png",
    previewAlt: "JobProof rack card",
    dimensionsLabel: "4×9 · 300 DPI",
    downloads: [
      {
        label: "Download PDF",
        href: "/media-kit/print/jobproof-rack-card.pdf",
        fileName: "jobproof-rack-card.pdf",
      },
      {
        label: "Download PNG",
        href: "/media-kit/print/jobproof-rack-card.png",
        fileName: "jobproof-rack-card.png",
      },
    ],
  },
  {
    id: "flyer-halfpage",
    name: "Half-page Flyer",
    description: "Compact half-page promotional flyer.",
    recommendedUse: "Inserts, folders, and event packages.",
    availableFormats: "PDF · PNG · 300 DPI",
    previewSrc: "/media-kit/print/jobproof-flyer-halfpage.png",
    previewAlt: "JobProof half-page flyer",
    dimensionsLabel: "Half-page · 300 DPI",
    downloads: [
      {
        label: "Download PDF",
        href: "/media-kit/print/jobproof-flyer-halfpage.pdf",
        fileName: "jobproof-flyer-halfpage.pdf",
      },
      {
        label: "Download PNG",
        href: "/media-kit/print/jobproof-flyer-halfpage.png",
        fileName: "jobproof-flyer-halfpage.png",
      },
    ],
  },
  {
    id: "poster",
    name: "Poster",
    description: "Large-format poster for events.",
    recommendedUse: "Workshops, booths, and community events.",
    availableFormats: "PDF · PNG · 300 DPI",
    previewSrc: "/media-kit/print/jobproof-poster.png",
    previewAlt: "JobProof poster",
    dimensionsLabel: "11×17 · 300 DPI",
    downloads: [
      {
        label: "Download PDF",
        href: "/media-kit/print/jobproof-poster.pdf",
        fileName: "jobproof-poster.pdf",
      },
      {
        label: "Download PNG",
        href: "/media-kit/print/jobproof-poster.png",
        fileName: "jobproof-poster.png",
      },
    ],
  },
];

const PARTNER_LINK_TOKEN = "[PARTNER LINK]";

export const MEDIA_EMAIL_RESOURCES: EmailResource[] = [
  {
    id: "introduction-email",
    title: "Introduction email",
    description: "HTML and plain-text introduction partners can send to contractors.",
    htmlHref: "/media-kit/email/introduction-email.html",
    htmlFileName: "introduction-email.html",
    textBody: `Help contractors win more jobs and get paid faster

JobProof is an all-in-one contractor platform for quotes, contracts, change orders, invoices, documentation, and dispute protection—so contractors can present a professional image and protect every project.

Share JobProof: ${PARTNER_LINK_TOKEN}`,
    subjects: [
      "A simpler way for contractors to quote, contract, and get paid",
      "Help your network look more professional on every job",
      "Quotes, contracts, change orders, and invoices—in one place",
    ],
  },
  {
    id: "referral-email",
    title: "Referral email",
    description: "Short personal referral note with your partner link.",
    htmlHref: "/media-kit/email/referral-email.html",
    htmlFileName: "referral-email.html",
    textBody: `Hi,

I wanted to share JobProof with you. It’s built for contractors who need professional quotes, contracts, change orders, invoices, documentation, and clearer payment workflows—with records that support dispute protection.

Learn more: ${PARTNER_LINK_TOKEN}

Happy to answer questions if helpful.`,
  },
  {
    id: "reminder-email",
    title: "Reminder email",
    description: "Follow-up reminder for contacts who already received an intro.",
    htmlHref: "/media-kit/email/reminder-email.html",
    htmlFileName: "reminder-email.html",
    textBody: `Hi,

Quick reminder about JobProof—the contractor platform for quotes, contracts, change orders, invoices, and job documentation that helps teams look professional and get paid with more confidence.

Here’s the link again: ${PARTNER_LINK_TOKEN}`,
  },
];

export const EMAIL_SUBJECT_SUGGESTIONS = [
  "A simpler way for contractors to quote, contract, and get paid",
  "Help your network look more professional on every job",
  "Quotes, contracts, change orders, and invoices—in one place",
  "Protect every project with clearer documentation",
  "Share JobProof with contractors who want faster payments",
  "From first quote to final invoice—without the paperwork scramble",
  "A Canadian platform built for growing trade businesses",
] as const;

export const PARTNER_COPY_LIBRARY: CopyBlock[] = [
  {
    id: "tagline",
    title: "Tagline",
    intendedUse: "Headlines and short brand lines.",
    body: "Win more jobs. Get paid faster. Protect every project.",
  },
  {
    id: "one-sentence",
    title: "One sentence",
    intendedUse: "Bios, directories, and short intros.",
    body: "JobProof helps contractors manage quotes, contracts, change orders, invoices, and documentation in one professional platform.",
  },
  {
    id: "short-description",
    title: "Short description",
    intendedUse: "Website snippets and partner directories.",
    body: "JobProof is an all-in-one contractor platform for quotes, contracts, change orders, invoices, documentation, and dispute protection—helping teams look professional and get paid with more confidence.",
  },
  {
    id: "long-description",
    title: "Long description",
    intendedUse: "About pages, newsletters, and press-style blurbs.",
    body: `JobProof is a Canadian contractor business platform designed to help independent contractors and growing trade businesses operate more professionally and confidently.

Instead of juggling disconnected tools for quoting, approvals, change orders, job records, invoicing, and payment follow-up, JobProof brings the customer journey together in one place. Contractors can present a stronger professional image, keep clearer documentation, and protect every project with organized records.

JobProof is intended for renovators, landscapers, roofers, painters, plumbers, electricians, HVAC professionals, and other service-based contractors.`,
  },
  {
    id: "facebook-copy",
    title: "Facebook",
    intendedUse: "Facebook posts and captions.",
    body: `Contractors deserve systems that match the quality of their work. JobProof helps with quotes, contracts, change orders, invoices, and documentation—so you can look professional, get paid faster, and protect every project. Learn more: ${PARTNER_LINK_TOKEN}`,
  },
  {
    id: "instagram-copy",
    title: "Instagram",
    intendedUse: "Instagram captions.",
    body: `From first quote to final invoice—keep the job organized. JobProof supports contracts, change orders, documentation, and faster payments for contractors who want a more professional image. ${PARTNER_LINK_TOKEN}`,
  },
  {
    id: "linkedin-copy",
    title: "LinkedIn",
    intendedUse: "LinkedIn posts.",
    body: `Growing contracting businesses need clear systems for quoting, contracting, change management, invoicing, and documentation. JobProof is built to support that journey in one professional platform—helping contractors win more work, get paid faster, and protect every project. ${PARTNER_LINK_TOKEN}`,
  },
  {
    id: "website-copy",
    title: "Website",
    intendedUse: "Partner website sections.",
    body: `JobProof is the contractor platform for quotes, contracts, change orders, invoices, documentation, and dispute-ready records. Share it with contractors who want a more professional customer experience and stronger payment confidence.`,
  },
  {
    id: "email-copy",
    title: "Email",
    intendedUse: "Email body snippets.",
    body: `I recommend JobProof for contractors who want professional quotes and contracts, clearer change orders, organized documentation, and smoother invoicing. You can explore it here: ${PARTNER_LINK_TOKEN}`,
  },
  {
    id: "sms-copy",
    title: "SMS",
    intendedUse: "Short text messages.",
    body: `JobProof helps contractors with quotes, contracts, invoices & documentation. Check it out: ${PARTNER_LINK_TOKEN}`,
  },
  {
    id: "referral-cta",
    title: "Referral CTA",
    intendedUse: "Buttons, banners, and closing lines.",
    body: `Ready to run jobs more professionally? Start with JobProof: ${PARTNER_LINK_TOKEN}`,
  },
];

/** Resources that do not yet have production files. */
export const COMING_SOON_RESOURCES: ComingSoonResource[] = [
  {
    id: "webinar-deck",
    title: "Webinar presentation",
    description: "Approved slides for partner webinars and lunch-and-learns.",
  },
  {
    id: "logo-svg-pack",
    title: "Logo SVG / PDF pack",
    description:
      "Vector logo exports will be added when official SVG/PDF masters are available. PNG logo files are ready now.",
  },
];

export function personalizePartnerCopy(
  body: string,
  referralUrl: string | null
): string {
  if (!referralUrl) return body;
  return body.split(PARTNER_LINK_TOKEN).join(referralUrl);
}

export function partnerRewardFaqAnswer(level: PartnerLevel): string {
  const amount =
    level === "founding" ? FOUNDING_REWARD_CAD : STANDARD_REWARD_CAD;
  const label = level === "founding" ? "Founding Partner" : "Standard Partner";
  return `As a ${label}, your standard one-time reward is $${amount} CAD for each qualified referral. Founding Partners and Standard Partners may have different reward amounts, and custom agreements may apply to strategic organizations. Always follow the reward amount shown in your Partner Portal.`;
}

export function buildMediaCenterFaqs(level: PartnerLevel): MediaFaqItem[] {
  const essential = getPublicPlanPriceLine("essential", "standard");
  const professional = getPublicPlanPriceLine("professional", "standard");
  return [
    {
      question: "What is JobProof?",
      answer:
        "JobProof is an all-in-one contractor business platform designed to help contractors manage the customer journey, operate professionally, get paid with greater confidence, and maintain stronger project records.",
    },
    {
      question: "Who is JobProof for?",
      answer:
        "JobProof is intended for independent contractors and growing trade businesses, including renovators, landscapers, roofers, painters, plumbers, electricians, HVAC professionals, and similar service-based businesses.",
    },
    {
      question: "Is JobProof only a job-documentation app?",
      answer:
        "No. Project documentation is one important part of JobProof, but the broader platform is focused on helping contractors manage the customer journey, win work, handle approvals and changes, invoice customers, get paid, and protect their projects.",
    },
    {
      question: "What subscription plans are available?",
      answer: `JobProof currently offers Essential at ${essential} and Professional at ${professional}. Exact plan features and taxes are shown during signup and billing.`,
    },
    {
      question: "How do partner referrals work?",
      answer: `Each approved partner receives a referral code or link. A referral is permanently attributed according to JobProof referral rules. Rewards become eligible only after the referred contractor remains a paying subscriber for ${PARTNER_QUALIFICATION_DAYS} consecutive days, and payouts are reviewed manually.`,
    },
    {
      question: "How much do partners earn?",
      answer: partnerRewardFaqAnswer(level),
    },
    {
      question: "Can I change the JobProof logo or write my own claims?",
      answer:
        "Partners may create their own honest commentary, but they should not alter the JobProof logo, misrepresent the product, make unsupported claims, or imply an endorsement that JobProof has not approved. Use the approved assets and wording in this Media Center whenever possible.",
    },
  ];
}

export const MEDIA_CONTACT = {
  heading: "Need help with partner marketing?",
  body: "Contact the JobProof Partner Team for co-branded materials, campaign questions, or approval of custom promotional content.",
  email: "partners@jobproof.ca",
} as const;

export { PARTNER_LINK_TOKEN };

/** @deprecated Kept for older tests/imports — prefer PARTNER_COPY_LIBRARY. */
export const ABOUT_JOBPROOF_BLOCKS = PARTNER_COPY_LIBRARY.filter((b) =>
  ["short-description", "long-description", "one-sentence"].includes(b.id)
);

/** @deprecated Prefer PARTNER_COPY_LIBRARY tagline / pitches. */
export const QUICK_PITCH_BLOCKS: CopyBlock[] = [
  {
    id: "one-line",
    title: "One-line pitch",
    intendedUse: "Headlines, captions, and short intros.",
    body: "Win more jobs. Get paid faster. Protect every project.",
  },
  {
    id: "15-second",
    title: "15-second pitch",
    intendedUse: "Quick verbal introductions.",
    body: "JobProof is an all-in-one business platform built for contractors. It helps organize quotes, contracts, change orders, invoices, documentation, and payment protection in one place.",
  },
];

/** @deprecated Prefer PARTNER_COPY_LIBRARY social entries. */
export const SOCIAL_CAPTION_BLOCKS = PARTNER_COPY_LIBRARY.filter((b) =>
  ["facebook-copy", "instagram-copy", "linkedin-copy"].includes(b.id)
);

export const NEWSLETTER_BLOCKS: CopyBlock[] = [];
export const NEWSLETTER_FEATURE_ARTICLE = {
  id: "newsletter-500",
  title: "Partner copy library",
  intendedUse: "See Partner Copy Library section.",
  body: PARTNER_COPY_LIBRARY.find((b) => b.id === "long-description")?.body ?? "",
} as const;
