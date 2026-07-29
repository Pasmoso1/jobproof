/** Runtime-free Studio types. Do not put these in actions.ts ("use server"). */

export type StudioActionResult =
  | { ok: true; campaignId: string }
  | { ok: false; error: string };

export type StudioLogoResult =
  | { ok: true; logoUrl: string | null }
  | { ok: false; error: string };

export type StudioCampaignListItem = {
  id: string;
  name: string;
  theme: string;
  audience: string;
  goal: string;
  style: string;
  platforms: string[];
  referral_url: string;
  created_at: string;
  clicks_count: number;
  signups_count: number;
  qualified_referrals_count: number;
  revenue_earned_cad: number;
};

export type StudioCampaignAssetRow = {
  id: string;
  platform: string;
  asset_kind: string;
  title: string;
  preview_src: string | null;
  download_href: string | null;
  download_file_name: string | null;
  secondary_download_href: string | null;
  secondary_download_file_name: string | null;
  caption: string | null;
  post_body: string | null;
  email_html: string | null;
  email_text: string | null;
  email_subject: string | null;
  sort_order: number;
};

export type StudioCampaignDetail = {
  id: string;
  name: string;
  theme: string;
  audience: string;
  goal: string;
  style: string;
  platforms: string[];
  referral_url: string;
  referral_code: string;
  copy_variant: string;
  created_at: string;
  assets: StudioCampaignAssetRow[];
};
