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
  downloads: Array<{ label: string; href: string; fileName: string }>;
  comingSoonFormats?: string[];
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

/** Canonical brand colours verified against JobProofLG.png and app tokens. */
export const MEDIA_CENTER_BRAND_COLORS: BrandColor[] = [
  {
    name: "JobProof Blue",
    hex: "#2436BB",
    note: "Primary brand blue used across the product UI.",
  },
  {
    name: "Bright Blue",
    hex: "#2C37EC",
    note: "Accent blue from the brand sheet.",
  },
  {
    name: "Soft Teal",
    hex: "#4DB6AC",
    note: "Supporting teal from the brand sheet.",
  },
  {
    name: "Proof Teal",
    hex: "#4DBACC",
    note: "Used in logo accents and Proof lettering.",
  },
  {
    name: "Accent Orange",
    hex: "#F28C38",
    note: "Shield highlight accent.",
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
      "Suggested use: websites, newsletters, presentations, and larger placements.",
    previewSrc: "/media-kit/logos/jobproof-primary-horizontal.png",
    previewAlt: "JobProof primary horizontal logo",
    dimensionsLabel: "PNG · transparent · large lockup",
    downloads: [
      {
        label: "Download PNG",
        href: "/media-kit/logos/jobproof-primary-horizontal.png",
        fileName: "jobproof-primary-horizontal.png",
      },
    ],
    comingSoonFormats: ["SVG", "PDF"],
  },
  {
    id: "secondary-horizontal",
    name: "Secondary Horizontal Logo",
    description: "Suggested use: compact website and marketing placements.",
    previewSrc: "/media-kit/logos/jobproof-secondary-horizontal.png",
    previewAlt: "JobProof secondary horizontal logo",
    dimensionsLabel: "PNG · transparent · medium lockup",
    downloads: [
      {
        label: "Download PNG",
        href: "/media-kit/logos/jobproof-secondary-horizontal.png",
        fileName: "jobproof-secondary-horizontal.png",
      },
    ],
    comingSoonFormats: ["SVG"],
  },
  {
    id: "compact-horizontal",
    name: "Compact Horizontal Logo",
    description: "Suggested use: narrow headers, sponsor rows, and email graphics.",
    previewSrc: "/media-kit/logos/jobproof-compact-horizontal.png",
    previewAlt: "JobProof compact horizontal logo",
    dimensionsLabel: "PNG · ~320px wide",
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
    description:
      "Suggested use: profile images, app references, social graphics, and small placements.",
    previewSrc: "/media-kit/icons/jobproof-shield-256.png",
    previewAlt: "JobProof shield icon",
    dimensionsLabel: "PNG · 1024 / 512 / 256 / 128 / 64 / 32",
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
    description: "Suggested use: white or light backgrounds.",
    previewSrc: "/media-kit/icons/jobproof-app-light-512.png",
    previewAlt: "JobProof light app icon",
    dimensionsLabel: "PNG · 512×512",
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
    description: "Suggested use: dark backgrounds and app-style placements.",
    previewSrc: "/media-kit/icons/jobproof-app-dark-512.png",
    previewAlt: "JobProof dark app icon",
    dimensionsLabel: "PNG · 512×512",
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
    description: "Small site icons for browsers and bookmarks.",
    previewSrc: "/media-kit/favicons/jobproof-favicon-32.png",
    previewAlt: "JobProof favicon",
    dimensionsLabel: "PNG · 32×32 and 16×16",
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
    ],
    comingSoonFormats: ["ICO"],
  },
  {
    id: "source-sheet",
    name: "Source Brand Sheet",
    description: "Original JobProof logo sheet for reference and future replacements.",
    previewSrc: "/media-kit/icons/jobproof-shield-128.png",
    previewAlt: "JobProof brand mark preview",
    dimensionsLabel: "PNG · full source sheet",
    downloads: [
      {
        label: "Download source sheet",
        href: "/media-kit/source/JobProofLG.png",
        fileName: "JobProofLG.png",
      },
    ],
    comingSoonFormats: ["ZIP pack"],
  },
];

export const ABOUT_JOBPROOF_BLOCKS: CopyBlock[] = [
  {
    id: "short-description",
    title: "Short description",
    intendedUse: "Bios, directories, and short introductions.",
    body: "JobProof helps contractors win more jobs, get paid faster, and protect every project with one professional business platform.",
  },
  {
    id: "standard-description",
    title: "Standard description",
    intendedUse: "Websites, partner pages, and general marketing.",
    body: "JobProof is an all-in-one contractor business platform that helps manage each stage of the customer journey—from quote requests and professional estimates to approvals, contracts, customer communication, change orders, project records, invoices, and payment protection. Instead of juggling disconnected tools and paperwork, contractors can keep their work organized in one place while delivering a more professional customer experience.",
  },
  {
    id: "full-description",
    title: "Full description",
    intendedUse: "Longer introductions, newsletters, and press-style blurbs.",
    body: `JobProof is a Canadian contractor business platform designed to help independent contractors and growing trade businesses operate more professionally, efficiently, and confidently.

Contractors often manage leads, quotes, contracts, customer communication, job records, change orders, invoices, and payment follow-up through a mixture of paper documents, text messages, spreadsheets, email, and separate software tools. JobProof brings these important parts of the customer journey together in one organized platform.

The platform is being built to help contractors respond to opportunities faster, prepare professional customer-facing documents, maintain clear approvals and project records, manage changes, invoice accurately, and preserve the information needed to protect their work. This can reduce administrative friction, improve the customer experience, and give contractors better visibility into each job from the first request through final payment.

JobProof is intended for independent contractors and small trade businesses, including renovators, landscapers, roofers, painters, plumbers, electricians, HVAC professionals, and other service-based contractors.

The JobProof mission is simple: help contractors win more jobs, get paid faster, and protect every project.`,
  },
];

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
    body: "JobProof is an all-in-one business platform built for contractors. It helps organize the customer journey from the first quote request through project approvals, invoicing, payment, and business protection.",
  },
  {
    id: "30-second",
    title: "30-second pitch",
    intendedUse: "Networking conversations and short videos.",
    body: "JobProof helps independent contractors and growing trade businesses replace scattered paperwork, messages, spreadsheets, and disconnected apps with one professional platform. It supports the customer journey from quoting and approvals through project records, change orders, invoicing, and payment protection, helping contractors save time, improve the customer experience, and protect their work.",
  },
  {
    id: "60-second",
    title: "60-second pitch",
    intendedUse: "Longer speaking opportunities and webinars.",
    body: "Running a contracting business involves much more than completing the physical work. Contractors also need to respond to leads, prepare professional quotes, secure approvals, communicate with customers, manage changes, keep reliable project records, invoice accurately, and follow up on payment. JobProof is being built to bring that customer journey together in one professional contractor platform. The goal is to help contractors operate more efficiently, present a stronger customer experience, get paid with greater confidence, and maintain the records needed to protect every project.",
  },
];

const PARTNER_LINK_TOKEN = "[PARTNER LINK]";

export const SOCIAL_CAPTION_BLOCKS: CopyBlock[] = [
  {
    id: "business-growth",
    title: "Business growth",
    intendedUse: "LinkedIn, Facebook, and newsletter social posts.",
    body: `Strong contracting businesses need strong systems. JobProof helps contractors organize the customer journey, respond professionally, stay on top of project details, and build a business that is easier to manage and grow. Learn more through my partner link: ${PARTNER_LINK_TOKEN}`,
  },
  {
    id: "professionalism",
    title: "Professionalism",
    intendedUse: "Posts about customer experience and reputation.",
    body: `Customers notice how a contractor communicates, quotes, documents, and follows up. JobProof is designed to help contractors deliver a more organized and professional experience from the first request through final payment. Learn more: ${PARTNER_LINK_TOKEN}`,
  },
  {
    id: "get-paid-faster",
    title: "Get paid faster",
    intendedUse: "Posts about invoicing and payment follow-up.",
    body: `Getting the work done is only part of running a successful contracting business. Clear approvals, organized records, accurate invoices, and professional follow-up can make payment easier. JobProof brings those steps together in one contractor-focused platform. ${PARTNER_LINK_TOKEN}`,
  },
  {
    id: "protect-every-project",
    title: "Protect every project",
    intendedUse: "Posts about documentation and approvals.",
    body: `Verbal agreements and scattered messages can create problems when a project changes. JobProof helps contractors keep important job information, approvals, changes, and records organized so they are better prepared if questions arise. ${PARTNER_LINK_TOKEN}`,
  },
  {
    id: "all-in-one-platform",
    title: "All-in-one platform",
    intendedUse: "Posts about simplifying contractor workflows.",
    body: `Quotes in one place. Messages somewhere else. Photos on a phone. Invoices in another app. JobProof is being built to bring the contractor customer journey together in one professional platform. ${PARTNER_LINK_TOKEN}`,
  },
  {
    id: "canadian-company",
    title: "Canadian company",
    intendedUse: "Posts highlighting JobProof as a Canadian platform.",
    body: `JobProof is a Canadian contractor business platform built to help independent contractors and growing trade businesses win more jobs, get paid faster, and protect every project. Learn more through my partner link: ${PARTNER_LINK_TOKEN}`,
  },
];

export const NEWSLETTER_BLOCKS: CopyBlock[] = [
  {
    id: "newsletter-100",
    title: "100-word version",
    intendedUse: "Short newsletter blurbs and email intros.",
    body: "Contractors need more than tools for completing the physical work. They also need reliable systems for handling quote requests, customer approvals, project changes, records, invoices, and payment follow-up. JobProof is a Canadian contractor business platform being built to bring those important parts of the customer journey together in one professional place. The platform is designed to help independent contractors and growing trade businesses save time, create a stronger customer experience, maintain clearer project records, and protect the work they have completed. JobProof’s mission is to help contractors win more jobs, get paid faster, and protect every project.",
  },
  {
    id: "newsletter-250",
    title: "250-word version",
    intendedUse: "Medium newsletter sections.",
    body: `Contractors often enter the trades because they are skilled at the work—not because they want to spend evenings managing paperwork, searching through messages, building quotes, tracking changes, preparing invoices, and following up on payment.

Yet those administrative responsibilities can have a major effect on whether a contracting business appears professional, remains organized, and gets paid properly.

JobProof is a Canadian contractor business platform being built to bring the customer journey together in one organized place. Instead of relying on scattered text messages, paper documents, spreadsheets, email threads, photo folders, and disconnected apps, contractors can maintain a clearer record of each project from the initial opportunity through final payment.

The platform is intended to support important business activities such as quote requests, professional customer documents, approvals, customer communication, project records, change management, invoicing, and payment protection. By creating a more consistent process, contractors can save administrative time, deliver a better customer experience, and reduce the risk created by incomplete or disorganized records.

JobProof is designed for independent contractors and growing trade businesses, including renovators, landscapers, roofers, painters, plumbers, electricians, HVAC professionals, and other service-based contractors.

Its mission is straightforward: help contractors win more jobs, get paid faster, and protect every project.`,
  },
];

/** Approved long-form newsletter article (~450–550 words). */
export const NEWSLETTER_FEATURE_ARTICLE = {
  id: "newsletter-500",
  title: "Why Better Business Systems Matter for Contractors",
  intendedUse: "Feature newsletter article or blog-style partner content.",
  body: `Why Better Business Systems Matter for Contractors

Most contractors start their businesses because they are skilled at the work itself. Framing, wiring, finishing, landscaping, and installation take focus, experience, and pride. What often becomes harder over time is everything around the job: responding to quote requests, preparing professional estimates, securing approvals, managing changes, keeping notes and photos organized, invoicing accurately, and following up on payment.

When those steps live across paper notes, text threads, email inboxes, spreadsheets, camera rolls, and separate apps, important details can get lost. A customer may remember a conversation differently than the contractor does. A change discussed on site may never make it into a clear written record. An invoice can be delayed because the supporting details are scattered. None of that means a contractor is careless. It usually means the business outgrew informal systems.

An organized customer journey helps. From the first inquiry through quoting, approvals, project updates, change orders, invoicing, and payment follow-up, each step works better when information stays connected. Contractors can respond more quickly, present a clearer professional image, reduce back-and-forth, and keep stronger records if questions arise later. Customers also benefit when communication feels consistent and easy to follow.

JobProof is a Canadian contractor business platform being built to support that journey in one place. It is designed for independent contractors and growing trade businesses—including renovators, landscapers, roofers, painters, plumbers, electricians, HVAC professionals, and similar service-based contractors—who want a more professional way to manage the business side of their work.

Better systems do not replace craftsmanship. They support it. When administrative work is easier to manage, contractors can spend more attention on the jobs that matter, present themselves more confidently, and protect the projects they complete. JobProof’s mission is simple: help contractors win more jobs, get paid faster, and protect every project.

If you work with contractors who are ready for a clearer process, share JobProof through your partner referral link: ${PARTNER_LINK_TOKEN}`,
} as const;

export const COMING_SOON_RESOURCES: ComingSoonResource[] = [
  {
    id: "overview-one-pager",
    title: "One-page JobProof overview",
    description: "A printable summary partners can share with contractors.",
  },
  {
    id: "referral-overview",
    title: "Referral program overview",
    description: "A short leave-behind explaining how partner referrals work.",
  },
  {
    id: "trade-show-flyer",
    title: "Trade-show flyer",
    description: "Print-ready flyer for events and association booths.",
  },
  {
    id: "partner-qr",
    title: "Partner QR code",
    description: "A downloadable QR graphic for your personal referral link.",
  },
  {
    id: "email-signature",
    title: "Email signature graphic",
    description: "A compact brand graphic for partner email signatures.",
  },
  {
    id: "event-poster",
    title: "Event poster",
    description: "A larger-format poster for workshops and community events.",
  },
  {
    id: "webinar-deck",
    title: "Webinar presentation",
    description: "Approved slides for partner webinars and lunch-and-learns.",
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
