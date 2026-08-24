/**
 * Type-specific Partner application fields mapped onto existing application columns
 * plus optional profile_details JSON.
 */

import {
  PARTNER_TYPE_CREATOR,
  PARTNER_TYPE_MARKETING,
  PARTNER_TYPE_ORGANIZATION,
  isCanonicalPartnerType,
  type PartnerTypeValue,
} from "@/lib/partners/constants";
import { CANADIAN_PROVINCES } from "@/lib/canada/provinces";
import {
  normalizeAdditionalProfileLinks,
  normalizeCreatorProfileLink,
} from "@/lib/partners/profile-links";

export const CREATOR_PLATFORMS = [
  { value: "youtube", label: "YouTube" },
  { value: "tiktok", label: "TikTok" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "podcast", label: "Podcast" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "other", label: "Other" },
] as const;

export const MARKETING_PROMOTION_METHODS = [
  { value: "affiliate_marketing", label: "Affiliate marketing" },
  { value: "paid_media", label: "Paid media" },
  { value: "website_content", label: "Website/content" },
  { value: "newsletter_email", label: "Newsletter/email" },
  { value: "industry_publication", label: "Industry publication" },
  { value: "lead_generation", label: "Lead generation" },
  { value: "other", label: "Other" },
] as const;

export const CREATOR_AUDIENCE_FOCUS = [
  { value: "contractors", label: "Contractors / trades" },
  { value: "homeowners", label: "Homeowners" },
  { value: "mixed", label: "Mixed audience" },
  { value: "other", label: "Other" },
] as const;

export type PartnerProfileDetails = {
  partnerType: PartnerTypeValue;
  primaryPlatform?: string;
  additionalLinks?: string;
  primaryAudience?: string;
  province?: string;
  promotionMethod?: string;
};

function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function parsePartnerProfileDetails(
  formData: FormData
): PartnerProfileDetails | null {
  const rawType = String(formData.get("partner_type") ?? "").trim();
  if (!isCanonicalPartnerType(rawType) || rawType === PARTNER_TYPE_ORGANIZATION) {
    return rawType === PARTNER_TYPE_ORGANIZATION
      ? { partnerType: PARTNER_TYPE_ORGANIZATION }
      : null;
  }

  if (rawType === PARTNER_TYPE_CREATOR) {
    const additionalRaw = blankToNull(
      String(formData.get("additional_links") ?? "")
    );
    const additional = additionalRaw
      ? normalizeAdditionalProfileLinks(additionalRaw)
      : null;
    return {
      partnerType: PARTNER_TYPE_CREATOR,
      primaryPlatform: blankToNull(
        String(formData.get("primary_platform") ?? "")
      ) ?? undefined,
      additionalLinks:
        additional?.ok && additional.url
          ? additional.url
          : additionalRaw ?? undefined,
      primaryAudience: blankToNull(
        String(formData.get("primary_audience") ?? "")
      ) ?? undefined,
      province: blankToNull(String(formData.get("province") ?? "")) ?? undefined,
    };
  }

  return {
    partnerType: PARTNER_TYPE_MARKETING,
    promotionMethod:
      blankToNull(String(formData.get("promotion_method") ?? "")) ?? undefined,
  };
}

export function validateTypeSpecificApplicationFields(
  formData: FormData
): Record<string, string> {
  const type = String(formData.get("partner_type") ?? "").trim();
  const fieldErrors: Record<string, string> = {};

  if (!isCanonicalPartnerType(type)) {
    fieldErrors.partner_type = "Select a partner type.";
    return fieldErrors;
  }

  if (type === PARTNER_TYPE_CREATOR) {
    const platform = String(formData.get("primary_platform") ?? "").trim();
    if (!CREATOR_PLATFORMS.some((p) => p.value === platform)) {
      fieldErrors.primary_platform = "Select your primary platform.";
    }
    const website = String(formData.get("website") ?? "").trim();
    if (!website) {
      fieldErrors.website = "Add your profile or channel.";
    } else {
      const normalized = normalizeCreatorProfileLink(platform, website);
      if (!normalized.ok) {
        fieldErrors.website = normalized.error;
      }
    }
    const additional = String(formData.get("additional_links") ?? "").trim();
    if (additional) {
      const extra = normalizeAdditionalProfileLinks(additional);
      if (!extra.ok) {
        fieldErrors.additional_links = extra.error;
      }
    }
    const province = String(formData.get("province") ?? "").trim();
    if (province && !CANADIAN_PROVINCES.includes(province as (typeof CANADIAN_PROVINCES)[number])) {
      fieldErrors.province = "Select a Canadian province or territory.";
    }
    const content = String(formData.get("reason") ?? "").trim();
    if (!content) {
      fieldErrors.reason = "Briefly describe your content.";
    }
    const audience = String(formData.get("estimated_audience") ?? "").trim();
    if (!audience) {
      fieldErrors.estimated_audience = "Share an approximate audience size.";
    }
  }

  if (type === PARTNER_TYPE_MARKETING) {
    const method = String(formData.get("promotion_method") ?? "").trim();
    if (!MARKETING_PROMOTION_METHODS.some((m) => m.value === method)) {
      fieldErrors.promotion_method = "Select a primary promotion method.";
    }
    const intro = String(formData.get("reason") ?? "").trim();
    if (!intro) {
      fieldErrors.reason =
        "Tell us briefly how you expect to introduce JobProof to contractors.";
    }
  }

  return fieldErrors;
}

export function buildPromotionPlanFromProfile(formData: FormData): string {
  const type = String(formData.get("partner_type") ?? "").trim();
  const explicit = String(formData.get("promotion_plan") ?? "").trim();

  if (type === PARTNER_TYPE_CREATOR) {
    const platformValue = String(formData.get("primary_platform") ?? "").trim();
    const platform =
      CREATOR_PLATFORMS.find((p) => p.value === platformValue)?.label ??
      platformValue;
    const extraRaw = String(formData.get("additional_links") ?? "").trim();
    const extraNormalized = extraRaw
      ? normalizeAdditionalProfileLinks(extraRaw)
      : null;
    const extra =
      extraNormalized?.ok && extraNormalized.url
        ? extraNormalized.url.replace(/\n/g, ", ")
        : extraRaw;
    const audience = String(formData.get("primary_audience") ?? "").trim();
    const audienceLabel =
      CREATOR_AUDIENCE_FOCUS.find((a) => a.value === audience)?.label ?? audience;
    return [
      platform ? `Primary platform: ${platform}` : null,
      extra ? `Additional links: ${extra}` : null,
      audienceLabel ? `Primary audience: ${audienceLabel}` : null,
      explicit || null,
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (type === PARTNER_TYPE_MARKETING) {
    const methodValue = String(formData.get("promotion_method") ?? "").trim();
    const method =
      MARKETING_PROMOTION_METHODS.find((m) => m.value === methodValue)?.label ??
      methodValue;
    return [method ? `Promotion method: ${method}` : null, explicit || null]
      .filter(Boolean)
      .join("\n");
  }

  return explicit;
}
