/** Marketing Studio campaign presets by Partner type. */

import {
  normalizePartnerType,
  type PartnerTypeValue,
} from "@/lib/partners/constants";
import {
  ORGANIZATION_CAMPAIGN_PRESETS,
  type OrganizationCampaignPreset,
} from "@/lib/partners/studio/organization-presets";
import type {
  StudioAudienceId,
  StudioGoalId,
  StudioPlatformId,
  StudioStyleId,
  StudioThemeId,
} from "@/lib/partners/studio/catalog";

export type StudioCampaignPreset = {
  id: string;
  label: string;
  description: string;
  theme: StudioThemeId;
  audience: StudioAudienceId;
  goal: StudioGoalId;
  platforms: StudioPlatformId[];
  style: StudioStyleId;
};

const CREATOR_PRESETS: StudioCampaignPreset[] = [
  {
    id: "instagram_post",
    label: "Instagram post",
    description: "Square feed graphic with caption for your contractor audience.",
    theme: "getting_more_jobs",
    audience: "general_contractors",
    goal: "social_media_campaign",
    platforms: ["instagram_post"],
    style: "friendly",
  },
  {
    id: "instagram_story",
    label: "Instagram Story",
    description: "Vertical story creative with your referral QR.",
    theme: "getting_more_jobs",
    audience: "home_service_businesses",
    goal: "social_media_campaign",
    platforms: ["instagram_story"],
    style: "bold",
  },
  {
    id: "facebook_post",
    label: "Facebook post",
    description: "Facebook graphic and post copy for contractor communities.",
    theme: "professional_quotes",
    audience: "general_contractors",
    goal: "social_media_campaign",
    platforms: ["facebook"],
    style: "friendly",
  },
  {
    id: "tiktok_reel",
    label: "TikTok / Reel concept",
    description: "Short-form story graphic plus talking points for a 20–30s video.",
    theme: "getting_more_jobs",
    audience: "home_service_businesses",
    goal: "social_media_campaign",
    platforms: ["instagram_story", "instagram_post"],
    style: "bold",
  },
  {
    id: "youtube_description",
    label: "YouTube description",
    description: "Video description copy with your referral link.",
    theme: "everything_jobproof",
    audience: "general_contractors",
    goal: "educate_contractors",
    platforms: ["email"],
    style: "educational",
  },
  {
    id: "podcast_mention",
    label: "Podcast mention",
    description: "Spoken ad-read and show-notes copy for a partner mention.",
    theme: "everything_jobproof",
    audience: "general_contractors",
    goal: "generate_referrals",
    platforms: ["email"],
    style: "professional",
  },
];

const MARKETING_PRESETS: StudioCampaignPreset[] = [
  {
    id: "website_banner",
    label: "Website banner",
    description: "Website banner with referral QR and JobProof branding.",
    theme: "getting_more_jobs",
    audience: "general_contractors",
    goal: "website_promotion",
    platforms: ["website_banner"],
    style: "professional",
  },
  {
    id: "landing_page_copy",
    label: "Landing-page copy",
    description: "Headline and body copy for a contractor landing page.",
    theme: "everything_jobproof",
    audience: "general_contractors",
    goal: "promote_free_trial",
    platforms: ["email", "website_banner"],
    style: "professional",
  },
  {
    id: "newsletter_promotion",
    label: "Newsletter promotion",
    description: "Newsletter blurb plus banner for contractor subscribers.",
    theme: "getting_paid_faster",
    audience: "home_service_businesses",
    goal: "email_campaign",
    platforms: ["email", "website_banner"],
    style: "educational",
  },
  {
    id: "email_promotion",
    label: "Email promotion",
    description: "Standalone email introducing JobProof to contractors.",
    theme: "professional_quotes",
    audience: "general_contractors",
    goal: "email_campaign",
    platforms: ["email"],
    style: "professional",
  },
  {
    id: "social_ad_copy",
    label: "Social advertisement copy",
    description: "Paid social copy and creative for Facebook or LinkedIn.",
    theme: "getting_more_jobs",
    audience: "general_contractors",
    goal: "social_media_campaign",
    platforms: ["facebook", "linkedin"],
    style: "bold",
  },
  {
    id: "article_sidebar",
    label: "Article / sidebar promotion",
    description: "Short publisher sidebar copy and a supporting banner.",
    theme: "everything_jobproof",
    audience: "general_contractors",
    goal: "website_promotion",
    platforms: ["website_banner", "linkedin"],
    style: "minimal",
  },
];

function fromOrganization(
  preset: OrganizationCampaignPreset
): StudioCampaignPreset {
  return { ...preset };
}

export function getStudioPresetsForPartnerType(
  partnerType: string | null | undefined
): StudioCampaignPreset[] {
  const type: PartnerTypeValue = normalizePartnerType(partnerType);
  if (type === "creator") return CREATOR_PRESETS;
  if (type === "marketing") return MARKETING_PRESETS;
  return ORGANIZATION_CAMPAIGN_PRESETS.map(fromOrganization);
}
