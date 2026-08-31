/**
 * JobProof Media Kit v2 — Social Media Kit campaign definitions.
 * Paths must match scripts/partner-media-social-campaigns.mjs output.
 */

const PARTNER_LINK_TOKEN = "[PARTNER LINK]";

export type SocialCampaignFormatId =
  | "square"
  | "portrait"
  | "story"
  | "linkedin"
  | "x";

export type SocialCampaignFormat = {
  id: SocialCampaignFormatId;
  label: string;
  dimensionsLabel: string;
  width: number;
  height: number;
  href: string;
  fileName: string;
};

export type SocialCampaign = {
  id: string;
  folder: string;
  title: string;
  shortDescription: string;
  headline: string;
  supportingLine: string;
  cta: string;
  caption: string;
  formats: SocialCampaignFormat[];
};

function buildFormats(folder: string, slug: string): SocialCampaignFormat[] {
  const specs: Array<{
    id: SocialCampaignFormatId;
    label: string;
    width: number;
    height: number;
  }> = [
    { id: "square", label: "Download Square", width: 1080, height: 1080 },
    { id: "portrait", label: "Download Portrait", width: 1080, height: 1350 },
    { id: "story", label: "Download Story", width: 1080, height: 1920 },
    { id: "linkedin", label: "Download LinkedIn", width: 1200, height: 627 },
    { id: "x", label: "Download X", width: 1600, height: 900 },
  ];
  return specs.map((s) => {
    const fileName = `jobproof-${slug}-${s.id}.png`;
    return {
      id: s.id,
      label: s.label,
      dimensionsLabel: `${s.width}×${s.height}`,
      width: s.width,
      height: s.height,
      href: `/media-kit/social/${folder}/${fileName}`,
      fileName,
    };
  });
}

export const MEDIA_SOCIAL_CAMPAIGNS: SocialCampaign[] = [
  {
    id: "win-more-work",
    folder: "win-more-work",
    title: "Win More Work",
    shortDescription:
      "Help turn more opportunities into paying jobs — from quote request to signed work.",
    headline: "Win more work.",
    supportingLine: "From quote request to signed job.",
    cta: "Try JobProof",
    caption: `Winning the job starts before the work begins. JobProof gives contractors tools to manage the journey from quote request to payment — helping turn more opportunities into paying jobs.

Learn more: ${PARTNER_LINK_TOKEN}`,
    formats: buildFormats("win-more-work", "win-more-work"),
  },
  {
    id: "turn-quotes-into-jobs",
    folder: "turn-quotes-into-jobs",
    title: "Turn Quotes Into Jobs",
    shortDescription:
      "Make it easy for customers to request a quote and easy for contractors to respond professionally.",
    headline: "Turn more quotes into paying jobs.",
    supportingLine: "Respond quickly. Quote professionally. Move work forward.",
    cta: "Start with JobProof",
    caption: `A quote request is an opportunity. JobProof helps contractors respond professionally and move customers from inquiry through quotes, contracts, changes and invoicing.

See JobProof: ${PARTNER_LINK_TOKEN}`,
    formats: buildFormats("turn-quotes-into-jobs", "turn-quotes-into-jobs"),
  },
  {
    id: "easier-to-hire",
    folder: "easier-to-hire",
    title: "Make It Easier to Hire You",
    shortDescription:
      "Create a clearer path from inquiry to quote, approval, and signed agreement.",
    headline: "Make it easier for customers to hire you.",
    supportingLine: "From inquiry to quote, approval, and signed agreement.",
    cta: "Try JobProof",
    caption: `Customers shouldn't have to chase a contractor just to get a quote. JobProof helps create a clearer path from quote request to approved work.

Learn more: ${PARTNER_LINK_TOKEN}`,
    formats: buildFormats("easier-to-hire", "easier-to-hire"),
  },
  {
    id: "get-paid",
    folder: "get-paid",
    title: "Get Paid",
    shortDescription:
      "Manage the path from approved work to invoicing and payment — without unsupported speed claims.",
    headline: "Do the work. Get paid.",
    supportingLine: "From approved work to invoice and payment.",
    cta: "Start with JobProof",
    caption: `Winning the job is only part of running a contracting business. JobProof helps manage the journey from approved work through invoicing and payment.

Try JobProof: ${PARTNER_LINK_TOKEN}`,
    formats: buildFormats("get-paid", "get-paid"),
  },
  {
    id: "protect-earned-revenue",
    folder: "protect-earned-revenue",
    title: "Protect What You've Earned",
    shortDescription:
      "Keep clear records of contracts, approvals, changes, and completed work to protect earned revenue.",
    headline: "Protect what you've earned.",
    supportingLine: "Contracts, approvals, changes, and clear job records.",
    cta: "Protect every job",
    caption: `Contracts, approvals, change orders and job records matter when money is on the line. JobProof helps contractors keep clear records and protect the revenue they've earned.

Learn more: ${PARTNER_LINK_TOKEN}`,
    formats: buildFormats("protect-earned-revenue", "protect-earned-revenue"),
  },
  {
    id: "quote-to-payment",
    folder: "quote-to-payment",
    title: "Win the Job. Manage the Work. Get Paid.",
    shortDescription:
      "The complete contractor journey from quote request to payment — in one place.",
    headline: "Win the job. Manage the work. Get paid.",
    supportingLine: "From quote request to payment — in one place.",
    cta: "Try JobProof",
    caption: `Win the job. Manage the work. Get paid. JobProof brings the contractor journey from quote request to payment together in one platform.

Try JobProof: ${PARTNER_LINK_TOKEN}`,
    formats: buildFormats("quote-to-payment", "quote-to-payment"),
  },
];

/** Representative defaults used by Marketing Studio drafts (Wave 1). */
export const SOCIAL_CAMPAIGN_STUDIO_DEFAULTS = {
  square: "/media-kit/social/win-more-work/jobproof-win-more-work-square.png",
  story: "/media-kit/social/win-more-work/jobproof-win-more-work-story.png",
  linkedin: "/media-kit/social/win-more-work/jobproof-win-more-work-linkedin.png",
  x: "/media-kit/social/win-more-work/jobproof-win-more-work-x.png",
} as const;
