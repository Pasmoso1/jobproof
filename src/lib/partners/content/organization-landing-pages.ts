/**
 * Organization-specific landing page variants.
 * Shared architecture: only hero, industry examples, photography cues,
 * member examples, and marketing examples are customized per slug.
 */

import {
  ORGANIZATION_COMPARISON,
  ORGANIZATION_FAQS,
  ORGANIZATION_FINAL_CTA,
  ORGANIZATION_HOW_STEPS,
  ORGANIZATION_MARKETING_SUPPORT,
  ORGANIZATION_PARTNERS_HERO,
  ORGANIZATION_PROMOTE_WAYS,
  ORGANIZATION_WHY_CARDS,
} from "@/lib/partners/content/organizations";

export type OrganizationLandingSlug =
  | "chamber"
  | "home-builders"
  | "electrical"
  | "landscaping"
  | "construction"
  | "hvac"
  | "plumbing"
  | "roofing";

export type OrganizationLandingVariant = {
  slug: OrganizationLandingSlug;
  metaTitle: string;
  metaDescription: string;
  hero: {
    eyebrow: string;
    headline: string;
    subtitle: string;
    supporting: string;
    photographyNote: string;
  };
  industryExamples: Array<{ title: string; body: string }>;
  memberExamples: Array<{ title: string; body: string }>;
  marketingExamples: string[];
};

const BASE_MEMBER_BENEFITS = ORGANIZATION_PARTNERS_HERO.memberBenefits;

export const ORGANIZATION_LANDING_VARIANTS: Record<
  OrganizationLandingSlug,
  OrganizationLandingVariant
> = {
  chamber: {
    slug: "chamber",
    metaTitle: "Chamber of Commerce Partners | JobProof",
    metaDescription:
      "Partner with JobProof to offer local contractors a modern business platform and earn organization referral rewards.",
    hero: {
      eyebrow: "Chamber of Commerce Partners",
      headline: "A practical growth benefit for local contractors.",
      subtitle:
        "Help chamber members win more work, get paid, and run stronger businesses — while creating non-dues revenue for your organization.",
      supporting:
        "JobProof gives members tools to turn opportunities into paying jobs — quotes, contracts, invoices, and records that help protect earned revenue.",
      photographyNote:
        "Suggested imagery: downtown business district, local contractor storefronts, chamber networking events.",
    },
    industryExamples: [
      {
        title: "Local service contractors",
        body: "Electricians, plumbers, renovators, and trades who need clearer quotes and faster follow-up.",
      },
      {
        title: "Home service businesses",
        body: "Member firms that want professional contracts, change orders, and organized job records.",
      },
    ],
    memberExamples: [
      {
        title: "Newsletter feature",
        body: "Introduce JobProof in the monthly member newsletter with your personalized referral link.",
      },
      {
        title: "Member resource hub",
        body: "Add a website banner and QR code to your benefits page.",
      },
    ],
    marketingExamples: [
      "Chamber newsletter article",
      "Member benefit webpage",
      "Networking event QR table card",
      "New member welcome insert",
    ],
  },
  "home-builders": {
    slug: "home-builders",
    metaTitle: "Home Builders Association Partners | JobProof",
    metaDescription:
      "Give builders and renovators tools to win more work, manage change orders, invoice clearly, and protect earned revenue through JobProof.",
    hero: {
      eyebrow: "Home Builders Association Partners",
      headline: "Help builders and renovators win more work.",
      subtitle:
        "Support members with professional quotes, contracts, change orders, and a clearer path from first lead to final invoice.",
      supporting:
        "JobProof helps association members turn opportunities into paying jobs while staying organized on every project.",
      photographyNote:
        "Suggested imagery: residential construction sites, renovation walkthroughs, association conference floors.",
    },
    industryExamples: [
      {
        title: "Custom home builders",
        body: "Win more work with clearer quotes, signed agreements, and approved change orders.",
      },
      {
        title: "Renovation contractors",
        body: "Turn quote requests into professional proposals customers can approve online.",
      },
    ],
    memberExamples: [
      {
        title: "Conference booth",
        body: "Use trade-show QR signs so members can scan and start a trial on the spot.",
      },
      {
        title: "Education webinar",
        body: "Host a lunch-and-learn on professional quoting and change-order workflows.",
      },
    ],
    marketingExamples: [
      "Conference flyer and poster",
      "Builder education webinar invite",
      "Member email announcement",
      "Resource library FAQ",
    ],
  },
  electrical: {
    slug: "electrical",
    metaTitle: "Electrical Association Partners | JobProof",
    metaDescription:
      "Equip electricians with professional quotes, job organization, and faster invoicing through JobProof.",
    hero: {
      eyebrow: "Electrical Association Partners",
      headline: "Help electricians win more work.",
      subtitle:
        "Give members a modern way to receive quote requests, present professional estimates, manage jobs, and get paid.",
      supporting:
        "JobProof helps electricians turn opportunities into paying jobs — with quoting, contracts, invoices, and records that support payment protection.",
      photographyNote:
        "Suggested imagery: electrical panel work, van branding, jobsite tablets, association training nights.",
    },
    industryExamples: [
      {
        title: "Residential electricians",
        body: "Respond faster to quote requests with clear, professional estimates.",
      },
      {
        title: "Commercial electrical firms",
        body: "Keep contracts, change orders, and invoices tied to each project.",
      },
    ],
    memberExamples: [
      {
        title: "Trade night demo",
        body: "Show members how JobProof handles quotes through invoices in one workflow.",
      },
      {
        title: "Apprentice / owner track",
        body: "Share onboarding inserts when members open or grow a business.",
      },
    ],
    marketingExamples: [
      "Association LinkedIn campaign",
      "Member announcement email",
      "Training night QR sign",
      "Website partner banner",
    ],
  },
  landscaping: {
    slug: "landscaping",
    metaTitle: "Landscape Association Partners | JobProof",
    metaDescription:
      "Help landscapers quote faster, document sites, and protect projects with JobProof.",
    hero: {
      eyebrow: "Landscape Association Partners",
      headline: "Help landscapers quote, document, and get paid.",
      subtitle:
        "Members can create professional quotes, manage seasonal projects, invoice clearly, and keep site documentation organized.",
      supporting:
        "JobProof is a practical member benefit for landscape contractors who want to grow without drowning in paperwork.",
      photographyNote:
        "Suggested imagery: outdoor job sites, design consultations, seasonal crews, association field days.",
    },
    industryExamples: [
      {
        title: "Design-build landscapers",
        body: "Present polished quotes and contracts before work begins.",
      },
      {
        title: "Maintenance companies",
        body: "Keep customers, recurring work, and invoices organized in one place.",
      },
    ],
    memberExamples: [
      {
        title: "Spring kickoff email",
        body: "Recommend JobProof before busy season with your personalized link.",
      },
      {
        title: "Field day handout",
        body: "Print conference flyers with your organization QR code.",
      },
    ],
    marketingExamples: [
      "Seasonal newsletter article",
      "Facebook member campaign",
      "Field day flyer",
      "New member welcome insert",
    ],
  },
  construction: {
    slug: "construction",
    metaTitle: "Construction Association Partners | JobProof",
    metaDescription:
      "Partner with JobProof to help construction association members operate more professionally.",
    hero: {
      eyebrow: "Construction Association Partners",
      headline: "A modern operating system for member contractors.",
      subtitle:
        "Help members look more professional on every bid while staying organized from quote request to payment.",
      supporting:
        "JobProof supports the full contractor workflow — not just documentation.",
      photographyNote:
        "Suggested imagery: commercial sites, safety meetings, association AGMs, contractor networking.",
    },
    industryExamples: [
      {
        title: "General contractors",
        body: "Coordinate quotes, contracts, change orders, and invoices across jobs.",
      },
      {
        title: "Specialty trades",
        body: "Give members shared tools for clearer customer communication.",
      },
    ],
    memberExamples: [
      {
        title: "AGM resource table",
        body: "Display a trade-show QR sign beside member benefit materials.",
      },
      {
        title: "Safety / business seminar",
        body: "Include JobProof in educational programming about professional operations.",
      },
    ],
    marketingExamples: [
      "Conference poster",
      "Member webinar campaign",
      "Website promotion banner",
      "LinkedIn association post",
    ],
  },
  hvac: {
    slug: "hvac",
    metaTitle: "HVAC Association Partners | JobProof",
    metaDescription:
      "Help HVAC members manage jobs, invoices, and customer communication with JobProof.",
    hero: {
      eyebrow: "HVAC Association Partners",
      headline: "Help HVAC members run cleaner jobs.",
      subtitle:
        "From quote requests to invoices, JobProof helps HVAC contractors stay organized and get paid faster.",
      supporting:
        "Recommend a tool members can use every week — not just once a year at conference.",
      photographyNote:
        "Suggested imagery: rooftop units, service vans, technician tablets, association classrooms.",
    },
    industryExamples: [
      {
        title: "Service & install",
        body: "Capture quote requests and convert them into professional proposals.",
      },
      {
        title: "Multi-crew shops",
        body: "Keep project records, change orders, and invoices connected.",
      },
    ],
    memberExamples: [
      {
        title: "Tech training night",
        body: "Share a short demo and QR code after skills sessions.",
      },
      {
        title: "Owner roundtable",
        body: "Discuss getting paid faster and reducing paperwork friction.",
      },
    ],
    marketingExamples: [
      "Educational webinar invite",
      "Member resources email",
      "Trade show QR sign",
      "Facebook campaign",
    ],
  },
  plumbing: {
    slug: "plumbing",
    metaTitle: "Plumbing Association Partners | JobProof",
    metaDescription:
      "Support plumbers with professional proposals, contracts, and organized job history through JobProof.",
    hero: {
      eyebrow: "Plumbing Association Partners",
      headline: "Help plumbers quote clearly and get paid faster.",
      subtitle:
        "Members can manage customers, projects, contracts, and invoices without losing details across texts and paper.",
      supporting:
        "JobProof is a member benefit that supports growth, professionalism, and everyday organization.",
      photographyNote:
        "Suggested imagery: residential service calls, commercial rough-ins, association dinner meetings.",
    },
    industryExamples: [
      {
        title: "Service plumbers",
        body: "Respond quickly to quote requests with polished estimates.",
      },
      {
        title: "New construction plumbing",
        body: "Track scope changes and approvals before they become disputes.",
      },
    ],
    memberExamples: [
      {
        title: "Dinner meeting insert",
        body: "Include a one-pager in event packages with your referral QR.",
      },
      {
        title: "Apprentice-to-owner path",
        body: "Introduce JobProof when members launch their own companies.",
      },
    ],
    marketingExamples: [
      "Monthly newsletter article",
      "Website member benefit page",
      "Conference flyer",
      "Email campaign",
    ],
  },
  roofing: {
    slug: "roofing",
    metaTitle: "Roofing Association Partners | JobProof",
    metaDescription:
      "Help roofers win more estimates, manage change orders, get paid, and protect earned revenue with JobProof.",
    hero: {
      eyebrow: "Roofing Association Partners",
      headline: "Help roofers win more work — and get paid for it.",
      subtitle:
        "Professional quotes, approved change orders, clearer invoices, and job records help members grow and protect revenue.",
      supporting:
        "Winning work and getting paid lead; documentation and dispute protection support those outcomes.",
      photographyNote:
        "Suggested imagery: roof inspections, before/after documentation, association expo booths.",
    },
    industryExamples: [
      {
        title: "Residential roofers",
        body: "Turn storm leads into professional quotes customers can approve.",
      },
      {
        title: "Commercial roofing",
        body: "Keep contracts, changes, and job records organized across crews.",
      },
    ],
    memberExamples: [
      {
        title: "Expo booth scan",
        body: "Use a large QR sign so members start a trial during the show.",
      },
      {
        title: "Storm-season campaign",
        body: "Send a member email before peak season with your referral link.",
      },
    ],
    marketingExamples: [
      "Storm-season email",
      "Conference poster",
      "LinkedIn campaign",
      "Member FAQ page",
    ],
  },
};

export const ORGANIZATION_LANDING_SLUGS = Object.keys(
  ORGANIZATION_LANDING_VARIANTS
) as OrganizationLandingSlug[];

export function getOrganizationLandingVariant(
  slug: string
): OrganizationLandingVariant | null {
  if (slug in ORGANIZATION_LANDING_VARIANTS) {
    return ORGANIZATION_LANDING_VARIANTS[slug as OrganizationLandingSlug];
  }
  return null;
}

/** Shared sections reused by every organization landing variant. */
export function getSharedOrganizationLandingContent() {
  return {
    memberBenefits: BASE_MEMBER_BENEFITS,
    whyCards: ORGANIZATION_WHY_CARDS,
    howSteps: ORGANIZATION_HOW_STEPS,
    promoteWays: ORGANIZATION_PROMOTE_WAYS,
    comparison: ORGANIZATION_COMPARISON,
    marketingSupport: ORGANIZATION_MARKETING_SUPPORT,
    faqs: ORGANIZATION_FAQS,
    finalCta: ORGANIZATION_FINAL_CTA,
    primaryCta: ORGANIZATION_PARTNERS_HERO.primaryCta,
  };
}
