"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getActivePartnerForCurrentUser } from "@/lib/partners/session";
import { buildPartnerReferralUrl, isOrganizationPartnerType } from "@/lib/partners/constants";
import { resolveAppUrl } from "@/lib/stripe";
import { buildCampaignAssetDrafts } from "@/lib/partners/studio/assets";
import { generateStudioCopy } from "@/lib/partners/studio/copy";
import {
  isStudioAudienceId,
  isStudioCopyVariantId,
  isStudioGoalId,
  isStudioPlatformId,
  isStudioStyleId,
  isStudioThemeId,
  studioOptionLabel,
  STUDIO_AUDIENCES,
  STUDIO_THEMES,
} from "@/lib/partners/studio/catalog";
import type {
  StudioAudienceId,
  StudioThemeId,
} from "@/lib/partners/studio/catalog";
import type {
  StudioActionResult,
  StudioCampaignAssetRow,
  StudioCampaignDetail,
  StudioCampaignListItem,
  StudioLogoResult,
} from "@/lib/partners/studio/types";

const LOGO_BUCKET = "partner-logos";
const MAX_LOGO_BYTES = 5 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = new Set([
  "image/png",
  "image/svg+xml",
  "image/jpeg",
  "image/webp",
]);

function campaignName(theme: StudioThemeId, audience: StudioAudienceId): string {
  const date = new Date().toLocaleDateString("en-CA");
  return `${studioOptionLabel(STUDIO_THEMES, theme)} · ${studioOptionLabel(STUDIO_AUDIENCES, audience)} · ${date}`;
}

export async function createStudioCampaign(input: {
  theme: string;
  audience: string;
  goal: string;
  platforms: string[];
  style: string;
}): Promise<StudioActionResult> {
  const session = await getActivePartnerForCurrentUser();
  if (!session) return { ok: false, error: "You must be signed in as an active partner." };

  if (!isStudioThemeId(input.theme)) return { ok: false, error: "Select a valid theme." };
  if (!isStudioAudienceId(input.audience)) return { ok: false, error: "Select a valid audience." };
  if (!isStudioGoalId(input.goal)) return { ok: false, error: "Select a valid goal." };
  if (!isStudioStyleId(input.style)) return { ok: false, error: "Select a valid style." };

  const platforms = input.platforms.filter(isStudioPlatformId);
  if (platforms.length === 0) {
    return { ok: false, error: "Select at least one platform." };
  }

  const referralUrl = buildPartnerReferralUrl(
    resolveAppUrl(),
    session.partner.referral_code
  );

  const copy = generateStudioCopy({
    theme: input.theme,
    audience: input.audience,
    organizationName: session.partner.organization_name,
    referralUrl,
    isFounding: session.partner.partner_level === "founding",
    variant: "professional",
  });

  const logo = await getActivePartnerLogo();
  const isOrg = isOrganizationPartnerType(session.partner.partner_type);

  const drafts = buildCampaignAssetDrafts({
    platforms,
    copy,
    referralUrl,
    organizationName: session.partner.organization_name,
    organizationLogoUrl: logo?.logoUrl ?? null,
    includeCoBrand: isOrg,
  });

  const supabase = await createClient();
  const { data: campaign, error: campaignError } = await supabase
    .from("partner_campaigns")
    .insert({
      partner_id: session.partner.id,
      name: campaignName(input.theme, input.audience),
      theme: input.theme,
      audience: input.audience,
      goal: input.goal,
      style: input.style,
      platforms,
      referral_url: referralUrl,
      referral_code: session.partner.referral_code,
      copy_variant: "professional",
      status: "ready",
    })
    .select("id")
    .single();

  if (campaignError || !campaign) {
    console.error("[studio] campaign insert failed", campaignError);
    return {
      ok: false,
      error:
        "Could not create the campaign. If this is a new environment, apply migration 064_partner_marketing_studio.",
    };
  }

  const rows = drafts.map((d) => ({
    campaign_id: campaign.id,
    platform: d.platform,
    asset_kind: d.assetKind,
    title: d.title,
    preview_src: d.previewSrc,
    download_href: d.downloadHref,
    download_file_name: d.downloadFileName,
    secondary_download_href: d.secondaryDownloadHref,
    secondary_download_file_name: d.secondaryDownloadFileName,
    caption: d.caption,
    post_body: d.postBody,
    email_html: d.emailHtml,
    email_text: d.emailText,
    email_subject: d.emailSubject,
    sort_order: d.sortOrder,
    metadata: d.metadata,
  }));

  const { error: assetsError } = await supabase
    .from("partner_campaign_assets")
    .insert(rows);

  if (assetsError) {
    console.error("[studio] assets insert failed", assetsError);
    await supabase.from("partner_campaigns").delete().eq("id", campaign.id);
    return { ok: false, error: "Could not generate campaign assets. Please try again." };
  }

  revalidatePath("/partner/studio");
  revalidatePath("/partner/studio/history");
  return { ok: true, campaignId: campaign.id };
}

export async function regenerateStudioCampaignCopy(
  campaignId: string,
  variant: string
): Promise<StudioActionResult> {
  const session = await getActivePartnerForCurrentUser();
  if (!session) return { ok: false, error: "You must be signed in as an active partner." };
  if (!isStudioCopyVariantId(variant)) {
    return { ok: false, error: "Select a valid copy style." };
  }

  const supabase = await createClient();
  const { data: campaign, error } = await supabase
    .from("partner_campaigns")
    .select(
      "id, partner_id, theme, audience, referral_url, referral_code"
    )
    .eq("id", campaignId)
    .eq("partner_id", session.partner.id)
    .maybeSingle();

  if (error || !campaign) {
    return { ok: false, error: "Campaign not found." };
  }

  if (!isStudioThemeId(campaign.theme) || !isStudioAudienceId(campaign.audience)) {
    return { ok: false, error: "Campaign data is invalid." };
  }

  const copy = generateStudioCopy({
    theme: campaign.theme,
    audience: campaign.audience,
    organizationName: session.partner.organization_name,
    referralUrl: campaign.referral_url,
    isFounding: session.partner.partner_level === "founding",
    variant,
  });

  const { data: assets } = await supabase
    .from("partner_campaign_assets")
    .select("id, platform, asset_kind")
    .eq("campaign_id", campaignId);

  for (const asset of assets ?? []) {
    const patch: Record<string, string | null> = {};
    if (asset.asset_kind === "email") {
      patch.email_html = copy.emailHtml;
      patch.email_text = copy.emailText;
      patch.email_subject = copy.emailSubject;
    } else if (asset.asset_kind === "graphic") {
      patch.caption = copy.caption;
      patch.post_body =
        asset.platform === "linkedin" || asset.platform === "facebook"
          ? copy.postBody
          : copy.caption;
    }
    if (Object.keys(patch).length > 0) {
      await supabase
        .from("partner_campaign_assets")
        .update(patch)
        .eq("id", asset.id)
        .eq("campaign_id", campaignId);
    }
  }

  await supabase
    .from("partner_campaigns")
    .update({ copy_variant: variant, updated_at: new Date().toISOString() })
    .eq("id", campaignId)
    .eq("partner_id", session.partner.id);

  revalidatePath(`/partner/studio/campaigns/${campaignId}`);
  return { ok: true, campaignId };
}

export async function recordStudioDownload(input: {
  campaignId: string;
  assetId?: string | null;
  downloadType: string;
}): Promise<void> {
  const session = await getActivePartnerForCurrentUser();
  if (!session) return;

  const supabase = await createClient();
  await supabase.from("partner_campaign_downloads").insert({
    campaign_id: input.campaignId,
    partner_id: session.partner.id,
    asset_id: input.assetId ?? null,
    download_type: input.downloadType.slice(0, 80),
  });
}

export async function uploadPartnerStudioLogo(
  formData: FormData
): Promise<StudioLogoResult> {
  const session = await getActivePartnerForCurrentUser();
  if (!session) return { ok: false, error: "You must be signed in as an active partner." };

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose a logo file to upload." };
  }
  if (file.size > MAX_LOGO_BYTES) {
    return { ok: false, error: "Logo must be 5 MB or smaller." };
  }
  if (!ALLOWED_LOGO_TYPES.has(file.type)) {
    return { ok: false, error: "Upload a PNG, SVG, JPEG, or WebP logo." };
  }

  const ext =
    file.type === "image/svg+xml"
      ? "svg"
      : file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
          ? "webp"
          : "jpg";
  const storagePath = `${session.partner.id}/logo-${Date.now()}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const supabase = await createClient();
  const admin = createServiceRoleClient();
  const storage = admin?.storage ?? supabase.storage;

  // Deactivate previous logos first
  await supabase
    .from("partner_uploaded_logos")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("partner_id", session.partner.id)
    .eq("is_active", true);

  const { error: uploadError } = await storage
    .from(LOGO_BUCKET)
    .upload(storagePath, bytes, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    console.error("[studio] logo upload failed", uploadError);
    return {
      ok: false,
      error:
        "Could not upload the logo. Apply migration 064 if the partner-logos bucket is missing.",
    };
  }

  const { error: insertError } = await supabase.from("partner_uploaded_logos").insert({
    partner_id: session.partner.id,
    storage_path: storagePath,
    file_name: file.name.slice(0, 200),
    mime_type: file.type,
    file_size_bytes: file.size,
    is_active: true,
  });

  if (insertError) {
    console.error("[studio] logo row insert failed", insertError);
    await storage.from(LOGO_BUCKET).remove([storagePath]);
    return { ok: false, error: "Could not save the logo. Please try again." };
  }

  revalidatePath("/partner/studio");
  revalidatePath("/partner/studio/create");
  const logoUrl = await getPartnerLogoSignedUrl(storagePath);
  return { ok: true, logoUrl };
}

export async function removePartnerStudioLogo(): Promise<StudioLogoResult> {
  const session = await getActivePartnerForCurrentUser();
  if (!session) return { ok: false, error: "You must be signed in as an active partner." };

  const supabase = await createClient();
  const { data: logos } = await supabase
    .from("partner_uploaded_logos")
    .select("id, storage_path")
    .eq("partner_id", session.partner.id)
    .eq("is_active", true);

  await supabase
    .from("partner_uploaded_logos")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("partner_id", session.partner.id)
    .eq("is_active", true);

  const admin = createServiceRoleClient();
  const storage = admin?.storage ?? supabase.storage;
  const paths = (logos ?? []).map((l) => l.storage_path).filter(Boolean);
  if (paths.length > 0) {
    await storage.from(LOGO_BUCKET).remove(paths);
  }

  revalidatePath("/partner/studio");
  revalidatePath("/partner/studio/create");
  return { ok: true, logoUrl: null };
}

export async function getActivePartnerLogo(): Promise<{
  storagePath: string;
  fileName: string;
  logoUrl: string | null;
} | null> {
  const session = await getActivePartnerForCurrentUser();
  if (!session) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("partner_uploaded_logos")
    .select("storage_path, file_name")
    .eq("partner_id", session.partner.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!data) return null;
  const logoUrl = await getPartnerLogoSignedUrl(data.storage_path);
  return {
    storagePath: data.storage_path,
    fileName: data.file_name,
    logoUrl,
  };
}

async function getPartnerLogoSignedUrl(storagePath: string): Promise<string | null> {
  const supabase = await createClient();
  const admin = createServiceRoleClient();
  const storage = admin?.storage ?? supabase.storage;
  const { data, error } = await storage
    .from(LOGO_BUCKET)
    .createSignedUrl(storagePath, 60 * 60);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function listPartnerCampaigns(): Promise<StudioCampaignListItem[]> {
  const session = await getActivePartnerForCurrentUser();
  if (!session) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("partner_campaigns")
    .select(
      "id, name, theme, audience, goal, style, platforms, referral_url, created_at, clicks_count, signups_count, qualified_referrals_count, revenue_earned_cad"
    )
    .eq("partner_id", session.partner.id)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data as StudioCampaignListItem[];
}

export async function getPartnerCampaignDetail(
  campaignId: string
): Promise<StudioCampaignDetail | null> {
  const session = await getActivePartnerForCurrentUser();
  if (!session) return null;

  const supabase = await createClient();
  const { data: campaign, error } = await supabase
    .from("partner_campaigns")
    .select(
      "id, name, theme, audience, goal, style, platforms, referral_url, referral_code, copy_variant, created_at"
    )
    .eq("id", campaignId)
    .eq("partner_id", session.partner.id)
    .maybeSingle();

  if (error || !campaign) return null;

  const { data: assets } = await supabase
    .from("partner_campaign_assets")
    .select(
      "id, platform, asset_kind, title, preview_src, download_href, download_file_name, secondary_download_href, secondary_download_file_name, caption, post_body, email_html, email_text, email_subject, sort_order"
    )
    .eq("campaign_id", campaignId)
    .order("sort_order", { ascending: true });

  return {
    ...(campaign as Omit<StudioCampaignDetail, "assets">),
    assets: (assets ?? []) as StudioCampaignAssetRow[],
  };
}
