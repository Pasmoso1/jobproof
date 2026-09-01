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
  "Help contractors win more work, make more money, get paid, and protect the revenue they've earned.";

export const MEDIA_CENTER_POSITIONING =
  "JobProof is a contractor business platform designed to help turn more opportunities into paying jobs — from the initial quote request through quotes, contracts, change orders, invoicing, payment, and job records that help protect earned revenue.";

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
    description:
      "Full standard horizontal lockup with generous safe spacing for websites, presentations, and large placements.",
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
    description:
      "Full standard horizontal lockup with slightly tighter transparent padding for common marketing placements.",
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
    description:
      "Full JobProof wordmark with reduced outer padding only—never cropped or abbreviated.",
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

export const MEDIA_SOCIAL_ASSETS: MediaAsset[] = [];
/** @deprecated Use MEDIA_SOCIAL_CAMPAIGNS from social-campaigns.ts */

/** @deprecated Use MEDIA_WEB_BANNER_GROUPS from web-banners.ts */
export const MEDIA_WEBSITE_ASSETS: MediaAsset[] = [];

/** @deprecated Use MEDIA_PRINT_RESOURCES from print-assets.ts */
export const MEDIA_PRINT_ASSETS: MediaAsset[] = [];

const PARTNER_LINK_TOKEN = "[PARTNER LINK]";

export const MEDIA_EMAIL_RESOURCES: EmailResource[] = [
  {
    id: "introduction-email",
    title: "Introduction email",
    description: "HTML and plain-text introduction partners can send to contractors.",
    htmlHref: "/media-kit/email/introduction-email.html",
    htmlFileName: "introduction-email.html",
    textBody: `Win more work. Run a better business.

JobProof gives contractors tools to help turn opportunities into paying jobs — from quote requests and professional quotes to contracts, change orders, invoices and job documentation.

Share JobProof: ${PARTNER_LINK_TOKEN}`,
    subjects: [
      "Tools to help turn opportunities into paying jobs",
      "From quote request to payment — in one place",
      "Help contractors win more work and get paid",
    ],
  },
  {
    id: "referral-email",
    title: "Referral email",
    description: "Short personal referral note with your partner link.",
    htmlHref: "/media-kit/email/referral-email.html",
    htmlFileName: "referral-email.html",
    textBody: `Hi,

I wanted to share JobProof with you. It’s designed to help contractors turn more opportunities into paying jobs — from quote requests through quotes, contracts, changes, invoicing, and documentation that helps protect the work they’ve earned.

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

Quick reminder about JobProof — a business platform designed to help contractors win more work, manage jobs professionally, get paid, and protect the revenue they’ve earned.

Here’s the link again: ${PARTNER_LINK_TOKEN}`,
  },
];

export const EMAIL_SUBJECT_SUGGESTIONS = [
  "Tools to help turn opportunities into paying jobs",
  "From quote request to payment — in one place",
  "Help contractors win more work and get paid",
  "Make it easier for customers to hire you",
  "Win the job. Manage the work. Get paid.",
  "Grow your contracting business with better tools",
  "More than job documentation — a business platform",
] as const;

export const PARTNER_COPY_LIBRARY: CopyBlock[] = [
  {
    id: "tagline",
    title: "Tagline",
    intendedUse: "Headlines and short brand lines.",
    body: "Win more work. Make more money. Get paid. Protect what you've earned.",
  },
  {
    id: "one-sentence",
    title: "One sentence",
    intendedUse: "Bios, directories, and short intros.",
    body: "JobProof gives contractors tools to help turn opportunities into paying jobs — from quote requests and professional quotes to contracts, change orders, invoices and job documentation.",
  },
  {
    id: "short-description",
    title: "Short description",
    intendedUse: "Website snippets and partner directories.",
    body: "JobProof is a contractor business platform designed to help win more work, manage the path from inquiry to payment, and protect the revenue contractors have earned — with quotes, contracts, change orders, invoices, and job records in one place.",
  },
  {
    id: "long-description",
    title: "Long description",
    intendedUse: "About pages, newsletters, and press-style blurbs.",
    body: `JobProof is a Canadian contractor business platform designed to help independent contractors and growing trade businesses win more work and run stronger businesses.

Instead of juggling disconnected tools for quoting, approvals, change orders, job records, invoicing, and payment follow-up, JobProof brings the customer journey together in one place. Contractors get tools to help turn opportunities into paying jobs, invoice clearly, and protect the revenue they've earned with organized records.

Saving time, looking professional, staying organized, and reducing disputes remain important benefits — they support the bigger goal of growing a successful contracting business.

JobProof is intended for renovators, landscapers, roofers, painters, plumbers, electricians, HVAC professionals, and other service-based contractors.`,
  },
  {
    id: "facebook-copy",
    title: "Facebook",
    intendedUse: "Facebook posts and captions.",
    body: `More jobs. Better processes. Better protection. JobProof helps contractors manage the journey from quote request to payment — so they can win more work, get paid, and protect the revenue they've earned. Learn more: ${PARTNER_LINK_TOKEN}`,
  },
  {
    id: "instagram-copy",
    title: "Instagram",
    intendedUse: "Instagram captions.",
    body: `Win the job. Manage the work. Get paid. JobProof gives contractors tools to help turn opportunities into paying jobs — from quote requests to invoices and job records. ${PARTNER_LINK_TOKEN}`,
  },
  {
    id: "linkedin-copy",
    title: "LinkedIn",
    intendedUse: "LinkedIn posts.",
    body: `Growing contracting businesses need clear systems for capturing opportunities, quoting, contracting, change management, invoicing, and documentation. JobProof is built to support that journey — helping contractors win more work, get paid, and protect the revenue they've earned. ${PARTNER_LINK_TOKEN}`,
  },
  {
    id: "website-copy",
    title: "Website",
    intendedUse: "Partner website sections.",
    body: `JobProof is designed to help contractors turn more opportunities into paying jobs — from quote requests and professional quotes to contracts, change orders, invoices, and documentation that helps protect earned revenue.`,
  },
  {
    id: "email-copy",
    title: "Email",
    intendedUse: "Email body snippets.",
    body: `I recommend JobProof for contractors who want better tools to win work, respond to quote requests, create professional quotes and contracts, manage changes, invoice customers, and protect the revenue they've earned. You can explore it here: ${PARTNER_LINK_TOKEN}`,
  },
  {
    id: "sms-copy",
    title: "SMS",
    intendedUse: "Short text messages.",
    body: `JobProof helps contractors win more work & get paid — from quote request to invoice. Check it out: ${PARTNER_LINK_TOKEN}`,
  },
  {
    id: "referral-cta",
    title: "Referral CTA",
    intendedUse: "Buttons, banners, and closing lines.",
    body: `Ready to grow your contracting business with better tools? Start with JobProof: ${PARTNER_LINK_TOKEN}`,
  },
  {
    id: "social-short",
    title: "Short social",
    intendedUse: "Captions and bios.",
    body: `More jobs. Better processes. Better protection. JobProof helps contractors manage the journey from quote request to payment.`,
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
        "JobProof is a contractor business platform designed to help contractors win more work, manage the path from quote request to payment, get paid, and protect the revenue they've earned.",
    },
    {
      question: "Who is JobProof for?",
      answer:
        "JobProof is intended for independent contractors and growing trade businesses, including renovators, landscapers, roofers, painters, plumbers, electricians, HVAC professionals, and similar service-based businesses.",
    },
    {
      question: "Is JobProof only a job-documentation app?",
      answer:
        "No. Project documentation is one important part of JobProof, but the platform is designed to help contractors turn opportunities into paying jobs, handle approvals and changes, invoice customers, get paid, and protect earned revenue.",
    },
    {
      question: "What subscription plans are available?",
      answer: `JobProof currently offers Essential at ${essential} and Professional at ${professional}. Exact plan features and taxes are shown during signup and billing.`,
    },
    {
      question: "How do partner referrals work?",
      answer: `Each approved partner receives a referral code or link. A referral is permanently attributed according to JobProof referral rules. Rewards qualify after the referred contractor remains a paying subscriber for ${PARTNER_QUALIFICATION_DAYS} consecutive days and are paid by Interac e-Transfer.`,
    },
    {
      question: "How much do partners earn?",
      answer: partnerRewardFaqAnswer(level),
    },
    {
      question: "Can I change the JobProof logo or write my own claims?",
      answer:
        "Partners may create their own honest commentary, but they should not alter the JobProof logo, misrepresent the product, make unsupported claims, or imply an endorsement that JobProof has not approved. Use the approved assets and wording in this Media Centre whenever possible.",
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
    body: "Win more work. Make more money. Get paid. Protect what you've earned.",
  },
  {
    id: "15-second",
    title: "15-second pitch",
    intendedUse: "Quick verbal introductions.",
    body: "JobProof is a business platform built for contractors. It gives tools to help turn opportunities into paying jobs — from quote requests and quotes to contracts, change orders, invoices, and documentation that helps protect earned revenue.",
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
