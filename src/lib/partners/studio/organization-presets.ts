/** Organization Marketing Studio campaign presets. */

import type {
  StudioAudienceId,
  StudioGoalId,
  StudioPlatformId,
  StudioStyleId,
  StudioThemeId,
} from "@/lib/partners/studio/catalog";

export type OrganizationCampaignPresetId =
  | "monthly_newsletter"
  | "member_announcement"
  | "conference_promotion"
  | "trade_show"
  | "educational_webinar"
  | "new_member_welcome"
  | "member_resources"
  | "website_promotion"
  | "linkedin_campaign"
  | "facebook_campaign";

export type OrganizationCampaignPreset = {
  id: OrganizationCampaignPresetId;
  label: string;
  description: string;
  theme: StudioThemeId;
  audience: StudioAudienceId;
  goal: StudioGoalId;
  platforms: StudioPlatformId[];
  style: StudioStyleId;
};

export const ORGANIZATION_CAMPAIGN_PRESETS: OrganizationCampaignPreset[] = [
  {
    id: "monthly_newsletter",
    label: "Monthly Newsletter",
    description: "Member newsletter feature with email + website banner assets.",
    theme: "everything_jobproof",
    audience: "trade_associations",
    goal: "email_campaign",
    platforms: ["email", "website_banner"],
    style: "professional",
  },
  {
    id: "member_announcement",
    label: "Member Announcement",
    description: "Announce JobProof as a member benefit across email and social.",
    theme: "getting_more_jobs",
    audience: "trade_associations",
    goal: "generate_referrals",
    platforms: ["email", "facebook", "linkedin"],
    style: "friendly",
  },
  {
    id: "conference_promotion",
    label: "Conference Promotion",
    description: "Conference-ready flyer, poster, and LinkedIn announcement.",
    theme: "everything_jobproof",
    audience: "trade_associations",
    goal: "trade_show",
    platforms: ["flyer", "poster", "linkedin"],
    style: "bold",
  },
  {
    id: "trade_show",
    label: "Trade Show",
    description: "Booth graphics and social posts for expo floors.",
    theme: "getting_more_jobs",
    audience: "general_contractors",
    goal: "trade_show",
    platforms: ["poster", "flyer", "instagram_post", "facebook"],
    style: "bold",
  },
  {
    id: "educational_webinar",
    label: "Educational Webinar",
    description: "Promote a member education session with email and LinkedIn.",
    theme: "professional_quotes",
    audience: "trade_associations",
    goal: "educate_contractors",
    platforms: ["email", "linkedin", "website_banner"],
    style: "educational",
  },
  {
    id: "new_member_welcome",
    label: "New Member Welcome",
    description: "Welcome-package style email and print insert for new members.",
    theme: "job_organization",
    audience: "home_service_businesses",
    goal: "promote_free_trial",
    platforms: ["email", "flyer"],
    style: "friendly",
  },
  {
    id: "member_resources",
    label: "Member Resources",
    description: "Resource-library style campaign with email and website banner.",
    theme: "everything_jobproof",
    audience: "trade_associations",
    goal: "website_promotion",
    platforms: ["email", "website_banner", "linkedin"],
    style: "educational",
  },
  {
    id: "website_promotion",
    label: "Website Promotion",
    description: "Website banner focused promotion with supporting social posts.",
    theme: "getting_paid_faster",
    audience: "general_contractors",
    goal: "website_promotion",
    platforms: ["website_banner", "facebook", "linkedin"],
    style: "modern",
  },
  {
    id: "linkedin_campaign",
    label: "LinkedIn Campaign",
    description: "Professional LinkedIn-first campaign for association channels.",
    theme: "professional_quotes",
    audience: "trade_associations",
    goal: "social_media_campaign",
    platforms: ["linkedin", "email"],
    style: "professional",
  },
  {
    id: "facebook_campaign",
    label: "Facebook Campaign",
    description: "Facebook and Instagram posts for member social communities.",
    theme: "getting_more_jobs",
    audience: "home_service_businesses",
    goal: "social_media_campaign",
    platforms: ["facebook", "instagram_post", "instagram_story"],
    style: "friendly",
  },
];

export function getOrganizationCampaignPreset(
  id: string
): OrganizationCampaignPreset | null {
  return ORGANIZATION_CAMPAIGN_PRESETS.find((p) => p.id === id) ?? null;
}
