/**
 * Copy and structure for the Association & Organization Partners landing page.
 * Kept separate from the general Partner Program page so messaging can stay org-focused.
 */

export const ORGANIZATION_PARTNERS_META = {
  title: "Association & Organization Partners | JobProof",
  description:
    "Partner with JobProof to provide contractors with powerful business tools while creating additional value for your members.",
} as const;

export const ORGANIZATION_PARTNERS_HERO = {
  eyebrow: "Association & Organization Partners",
  title: "Association & Organization Partners",
  subtitle:
    "Help your members win more work, operate more professionally, and protect their businesses while creating a new revenue opportunity for your organization.",
  headline: "A stronger member benefit for today's contractors.",
  supporting:
    "JobProof helps contractors do far more than document their work. Organizations can provide members with a modern business tool while earning referral revenue.",
  memberBenefits: [
    "Win more jobs",
    "Create professional quotes",
    "Manage contracts",
    "Handle change orders",
    "Send invoices",
    "Organize job documentation",
    "Build customer confidence",
    "Reduce disputes",
    "Protect their business",
    "Grow professionally",
  ],
  primaryCta: { label: "Become an Organization Partner", href: "/partners/apply" },
  secondaryCta: { label: "Schedule a Demo", href: "/support/contact" },
} as const;

export const ORGANIZATION_WHY_CARDS = [
  {
    id: "member-value",
    icon: "gift",
    title: "Increase Member Value",
    body: "Offer a practical business tool members will actually use every week.",
  },
  {
    id: "revenue",
    icon: "invoice",
    title: "Generate Non-Dues Revenue",
    body: "Earn referral commissions from qualified member signups.",
  },
  {
    id: "grow",
    icon: "bolt",
    title: "Help Members Grow",
    body: "Support contractors beyond advocacy by helping them win and manage more work.",
  },
  {
    id: "promote",
    icon: "spark",
    title: "Simple to Promote",
    body: "Provide ready-made graphics, email campaigns, QR codes, flyers, and social media content.",
  },
  {
    id: "canada",
    icon: "globe",
    title: "Canadian Focus",
    body: "Built for Canadian contractors and organizations with room for future expansion.",
  },
  {
    id: "no-cost",
    icon: "check",
    title: "No Cost to Join",
    body: "There is no cost to become an approved JobProof Organization Partner.",
  },
] as const;

export const ORGANIZATION_AUDIENCE_CARDS = [
  {
    title: "Chamber of Commerce",
    body: "Give local contractors a shared platform for quotes, contracts, invoices, and professional growth.",
  },
  {
    title: "Construction Association",
    body: "Help members look more professional on every bid while staying organized from quote to payment.",
  },
  {
    title: "Home Builders Association",
    body: "Support builders and renovators with clearer approvals, change orders, and job documentation.",
  },
  {
    title: "Electrical Association",
    body: "Equip electricians to win more work with polished quotes and stronger project records.",
  },
  {
    title: "HVAC Association",
    body: "Help HVAC members manage jobs, invoices, and customer communication in one place.",
  },
  {
    title: "Landscape Association",
    body: "Give landscapers tools to quote faster, document sites, and protect every project.",
  },
  {
    title: "Plumbing Association",
    body: "Support plumbers with professional proposals, contracts, and organized job history.",
  },
  {
    title: "Roofing Association",
    body: "Help roofers create clearer estimates, manage change orders, and reduce disputes.",
  },
  {
    title: "Renovation Association",
    body: "Give renovators a complete workflow from first quote through final invoice.",
  },
  {
    title: "Business Network",
    body: "Add a practical growth benefit your contractor members can use every week.",
  },
  {
    title: "Franchise System",
    body: "Give franchise locations consistent quoting, contracting, and documentation tools.",
  },
  {
    title: "Buying Group",
    body: "Strengthen member onboarding with a business platform that helps contractors win and manage work.",
  },
] as const;

export const ORGANIZATION_HOW_STEPS = [
  {
    step: 1,
    title: "Apply",
    body: "Complete a short application.",
  },
  {
    step: 2,
    title: "Approval",
    body: "JobProof reviews and activates your organization.",
  },
  {
    step: 3,
    title: "Receive Marketing Resources",
    body: "Gain access to the Media Centre, Marketing Studio, referral links, QR codes, and co-branded graphics.",
  },
  {
    step: 4,
    title: "Support Your Members",
    body: "Share JobProof through newsletters, events, webinars, websites, social media, onboarding packages, and member communications.",
  },
] as const;

export const ORGANIZATION_PROMOTE_WAYS = [
  "Monthly newsletter",
  "Member emails",
  "Website partner page",
  "New member welcome package",
  "Annual conference",
  "Trade shows",
  "Educational webinars",
  "Social media",
  "Printed flyers",
  "QR codes at events",
  "Resource libraries",
] as const;

export const ORGANIZATION_COMPARISON = {
  without: [
    "Paper quotes",
    "Manual documentation",
    "Lost photos",
    "Unorganized jobs",
    "Higher dispute risk",
  ],
  with: [
    "Professional quotes",
    "Contracts",
    "Change Orders",
    "Invoices",
    "Organized job records",
    "Secure documentation",
    "Better customer confidence",
    "Business growth tools",
  ],
} as const;

export const ORGANIZATION_MARKETING_SUPPORT = [
  {
    id: "media",
    icon: "image",
    title: "Media Centre",
    body: "Download logos, flyers, banners and graphics.",
    href: "/partner/media",
  },
  {
    id: "studio",
    icon: "spark",
    title: "Marketing Studio",
    body: "Automatically generate personalized campaigns.",
    href: "/partner/studio",
  },
  {
    id: "tracking",
    icon: "link",
    title: "Referral Tracking",
    body: "Monitor referrals and payouts.",
    href: "/partner/referrals",
  },
  {
    id: "qr",
    icon: "grid",
    title: "QR Codes",
    body: "Instant member signups.",
    href: "/partner",
  },
  {
    id: "email",
    icon: "mail",
    title: "Email Templates",
    body: "Ready-to-send campaigns.",
    href: "/partner/media",
  },
  {
    id: "print",
    icon: "flyer",
    title: "Print Materials",
    body: "Conference-ready handouts and posters.",
    href: "/partner/media",
  },
] as const;

export const ORGANIZATION_SUCCESS_EXAMPLES = [
  {
    title: "Local Chamber of Commerce",
    body: "Promoted JobProof in their monthly newsletter and member resource page.",
  },
  {
    title: "Provincial Trade Association",
    body: "Shared JobProof during contractor education webinars.",
  },
  {
    title: "Buying Group",
    body: "Included JobProof in new member onboarding.",
  },
] as const;

export const ORGANIZATION_FAQS = [
  {
    question: "Who can become an Organization Partner?",
    answer:
      "Chambers of commerce, construction and trade associations, industry groups, buying groups, franchise organizations, business improvement associations, and similar networks that regularly support contractors or small construction businesses.",
  },
  {
    question: "Is there any cost?",
    answer:
      "No. There is no cost to become an approved JobProof Organization Partner.",
  },
  {
    question: "How are referrals tracked?",
    answer:
      "Approved organizations receive a unique referral link and code. Signups that use your link are attributed to your partner account so you can monitor referrals and payouts in the Partner Portal.",
  },
  {
    question: "Can we customize marketing materials?",
    answer:
      "Yes. Use the Media Centre for approved brand assets and the Marketing Studio to generate personalized campaigns with your referral link, QR code, and optional organization branding.",
  },
  {
    question: "Can multiple staff members access the portal?",
    answer:
      "Each partner account is tied to the approved organization contact. If your team needs additional access options, contact JobProof support and we can discuss the best approach for your organization.",
  },
  {
    question: "Can we host webinars with JobProof?",
    answer:
      "Yes. Many associations introduce JobProof through educational webinars, lunch-and-learns, and contractor training events. Reach out to schedule a demo or co-hosted session.",
  },
  {
    question: "What support do we receive?",
    answer:
      "Organization partners get access to the Media Centre, Marketing Studio, referral tracking, QR codes, email templates, print materials, and JobProof support for questions about promoting the platform to members.",
  },
] as const;

export const ORGANIZATION_FINAL_CTA = {
  headline: "Help your members build stronger businesses.",
  primaryCta: { label: "Apply Now", href: "/partners/apply" },
  secondaryCta: { label: "Book a Demo", href: "/support/contact" },
} as const;

/** Short contextual callout used across Partner Portal surfaces. */
export const ORGANIZATION_PORTAL_CALLOUT = {
  text: "Represent an association or organization? Learn about our Organization Partner Program.",
  href: "/partners/organizations",
  linkLabel: "Learn about our Organization Partner Program",
} as const;
