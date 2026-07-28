/** Marketing Studio catalog — themes, audiences, goals, platforms, styles. */

export const STUDIO_TAGLINE =
  "Win more work. Stay organized. Get paid. Protect every job.";

export type StudioThemeId =
  | "getting_more_jobs"
  | "professional_quotes"
  | "customer_quote_requests"
  | "contracts"
  | "change_orders"
  | "invoicing"
  | "getting_paid_faster"
  | "project_documentation"
  | "job_organization"
  | "protect_every_job"
  | "everything_jobproof";

export type StudioAudienceId =
  | "general_contractors"
  | "roofers"
  | "hvac"
  | "electricians"
  | "plumbers"
  | "painters"
  | "landscapers"
  | "renovation_contractors"
  | "flooring_contractors"
  | "concrete_contractors"
  | "home_service_businesses"
  | "property_managers"
  | "trade_associations"
  | "construction_companies";

export type StudioGoalId =
  | "generate_referrals"
  | "educate_contractors"
  | "promote_free_trial"
  | "promote_paid_plans"
  | "trade_show"
  | "website_promotion"
  | "email_campaign"
  | "social_media_campaign";

export type StudioPlatformId =
  | "facebook"
  | "instagram_post"
  | "instagram_story"
  | "linkedin"
  | "x"
  | "email"
  | "website_banner"
  | "rack_card"
  | "flyer"
  | "poster";

export type StudioStyleId =
  | "professional"
  | "modern"
  | "educational"
  | "friendly"
  | "bold"
  | "minimal";

export type StudioCopyVariantId =
  | "professional"
  | "friendly"
  | "educational"
  | "short"
  | "detailed";

export type StudioOption<T extends string> = {
  id: T;
  label: string;
  description: string;
  /** Simple inline icon key for UI mapping. */
  icon: string;
};

export const STUDIO_THEMES: StudioOption<StudioThemeId>[] = [
  {
    id: "getting_more_jobs",
    label: "Getting More Jobs",
    description: "Win more work with professional follow-up and conversions.",
    icon: "briefcase",
  },
  {
    id: "professional_quotes",
    label: "Professional Quotes",
    description: "Create clear quotes customers can approve online.",
    icon: "document",
  },
  {
    id: "customer_quote_requests",
    label: "Customer Quote Requests",
    description: "Capture inbound requests and respond faster.",
    icon: "inbox",
  },
  {
    id: "contracts",
    label: "Contracts",
    description: "Professional contracts and clear approvals.",
    icon: "contract",
  },
  {
    id: "change_orders",
    label: "Change Orders",
    description: "Track scope changes before they become disputes.",
    icon: "refresh",
  },
  {
    id: "invoicing",
    label: "Invoicing",
    description: "Invoice accurately and look more professional.",
    icon: "invoice",
  },
  {
    id: "getting_paid_faster",
    label: "Getting Paid Faster",
    description: "Reduce payment delays with clearer systems.",
    icon: "bolt",
  },
  {
    id: "project_documentation",
    label: "Project Documentation",
    description: "Photos, files, and records that protect the job.",
    icon: "camera",
  },
  {
    id: "job_organization",
    label: "Job Organization",
    description: "Keep customers, jobs, and files in one place.",
    icon: "folder",
  },
  {
    id: "protect_every_job",
    label: "Protect Every Job",
    description: "Approvals and records that support every project.",
    icon: "shield",
  },
  {
    id: "everything_jobproof",
    label: "Everything JobProof",
    description: "The full platform—from first inquiry to final payment.",
    icon: "grid",
  },
];

/** Easy to extend: append new audience entries. */
export const STUDIO_AUDIENCES: StudioOption<StudioAudienceId>[] = [
  { id: "general_contractors", label: "General Contractors", description: "GC and multi-trade businesses.", icon: "hardhat" },
  { id: "roofers", label: "Roofers", description: "Roofing contractors and crews.", icon: "home" },
  { id: "hvac", label: "HVAC", description: "Heating, ventilation, and cooling.", icon: "temp" },
  { id: "electricians", label: "Electricians", description: "Electrical contractors.", icon: "zap" },
  { id: "plumbers", label: "Plumbers", description: "Plumbing and related services.", icon: "droplet" },
  { id: "painters", label: "Painters", description: "Interior and exterior painting.", icon: "brush" },
  { id: "landscapers", label: "Landscapers", description: "Landscaping and outdoor services.", icon: "leaf" },
  { id: "renovation_contractors", label: "Renovation Contractors", description: "Renovation and remodeling.", icon: "hammer" },
  { id: "flooring_contractors", label: "Flooring Contractors", description: "Flooring installation and finishing.", icon: "layers" },
  { id: "concrete_contractors", label: "Concrete Contractors", description: "Concrete and flatwork.", icon: "block" },
  { id: "home_service_businesses", label: "Home Service Businesses", description: "Broad home-service trades.", icon: "home" },
  { id: "property_managers", label: "Property Managers", description: "Property and facilities managers.", icon: "building" },
  { id: "trade_associations", label: "Trade Associations", description: "Associations and member networks.", icon: "users" },
  { id: "construction_companies", label: "Construction Companies", description: "Growing construction businesses.", icon: "crane" },
];

export const STUDIO_GOALS: StudioOption<StudioGoalId>[] = [
  { id: "generate_referrals", label: "Generate Referrals", description: "Drive signups through your link.", icon: "link" },
  { id: "educate_contractors", label: "Educate Contractors", description: "Explain how JobProof helps.", icon: "book" },
  { id: "promote_free_trial", label: "Promote Free Trial", description: "Invite contractors to try JobProof.", icon: "gift" },
  { id: "promote_paid_plans", label: "Promote Paid Plans", description: "Highlight paid plan value.", icon: "star" },
  { id: "trade_show", label: "Trade Show", description: "Booth and event promotions.", icon: "flag" },
  { id: "website_promotion", label: "Website Promotion", description: "Banners and site placements.", icon: "globe" },
  { id: "email_campaign", label: "Email Campaign", description: "Email-first outreach.", icon: "mail" },
  { id: "social_media_campaign", label: "Social Media Campaign", description: "Social-first promotion.", icon: "share" },
];

export const STUDIO_PLATFORMS: StudioOption<StudioPlatformId>[] = [
  { id: "facebook", label: "Facebook", description: "Feed post graphic + caption.", icon: "facebook" },
  { id: "instagram_post", label: "Instagram Post", description: "Square feed graphic.", icon: "instagram" },
  { id: "instagram_story", label: "Instagram Story", description: "Vertical story graphic.", icon: "story" },
  { id: "linkedin", label: "LinkedIn", description: "Professional feed graphic.", icon: "linkedin" },
  { id: "x", label: "X", description: "Wide social graphic.", icon: "x" },
  { id: "email", label: "Email", description: "HTML + plain-text email.", icon: "mail" },
  { id: "website_banner", label: "Website Banner", description: "Web banner graphic.", icon: "image" },
  { id: "rack_card", label: "Rack Card", description: "Print rack card.", icon: "card" },
  { id: "flyer", label: "Flyer", description: "Letter-size flyer.", icon: "flyer" },
  { id: "poster", label: "Poster", description: "Large-format poster.", icon: "poster" },
];

export const STUDIO_STYLES: StudioOption<StudioStyleId>[] = [
  { id: "professional", label: "Professional", description: "Polished and trustworthy.", icon: "check" },
  { id: "modern", label: "Modern", description: "Clean SaaS tone.", icon: "spark" },
  { id: "educational", label: "Educational", description: "Clear and informative.", icon: "book" },
  { id: "friendly", label: "Friendly", description: "Warm and approachable.", icon: "smile" },
  { id: "bold", label: "Bold", description: "Strong, high-energy claims.", icon: "bolt" },
  { id: "minimal", label: "Minimal", description: "Short and punchy.", icon: "minus" },
];

export const STUDIO_COPY_VARIANTS: StudioOption<StudioCopyVariantId>[] = [
  { id: "professional", label: "Professional", description: "Clear business tone.", icon: "check" },
  { id: "friendly", label: "Friendly", description: "Conversational and warm.", icon: "smile" },
  { id: "educational", label: "Educational", description: "Explain the value.", icon: "book" },
  { id: "short", label: "Short", description: "Brief captions and blurbs.", icon: "minus" },
  { id: "detailed", label: "Detailed", description: "Longer, fuller copy.", icon: "document" },
];

export function studioOptionLabel<T extends string>(
  options: StudioOption<T>[],
  id: string
): string {
  return options.find((o) => o.id === id)?.label ?? id;
}

export function isStudioThemeId(value: string): value is StudioThemeId {
  return STUDIO_THEMES.some((t) => t.id === value);
}

export function isStudioAudienceId(value: string): value is StudioAudienceId {
  return STUDIO_AUDIENCES.some((a) => a.id === value);
}

export function isStudioGoalId(value: string): value is StudioGoalId {
  return STUDIO_GOALS.some((g) => g.id === value);
}

export function isStudioPlatformId(value: string): value is StudioPlatformId {
  return STUDIO_PLATFORMS.some((p) => p.id === value);
}

export function isStudioStyleId(value: string): value is StudioStyleId {
  return STUDIO_STYLES.some((s) => s.id === value);
}

export function isStudioCopyVariantId(value: string): value is StudioCopyVariantId {
  return STUDIO_COPY_VARIANTS.some((v) => v.id === value);
}
