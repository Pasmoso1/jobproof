import {
  ORGANIZATION_PARTNER_TYPE,
} from "@/lib/partners/constants";
import {
  ORGANIZATION_INTERESTS,
  ORGANIZATION_PROMOTION_CHANNELS,
  ORGANIZATION_TYPES,
} from "@/lib/partners/organization-types";

export type OrganizationApplyFieldErrors = Record<string, string>;

export type PreparedOrganizationApplication =
  | { ok: true; formData: FormData; profile: OrganizationProfilePayload }
  | { ok: false; fieldErrors: OrganizationApplyFieldErrors; error: string };

export type OrganizationProfilePayload = {
  organizationType: string;
  jobTitle: string | null;
  memberCount: string | null;
  primaryIndustries: string | null;
  geographicCoverage: string | null;
  newsletterSize: string | null;
  socialAudience: string | null;
  websiteTraffic: string | null;
  promotionChannels: string[];
  interests: string[];
  additionalComments: string | null;
};

function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Validate organization-specific fields and produce FormData compatible with
 * submitPartnerApplicationCore (partner_type forced to organization).
 */
export function prepareOrganizationApplicationFormData(
  formData: FormData
): PreparedOrganizationApplication {
  const fieldErrors: OrganizationApplyFieldErrors = {};

  const organizationName = String(formData.get("organization_name") ?? "").trim();
  const organizationType = String(formData.get("organization_type") ?? "").trim();
  const contactName = String(formData.get("contact_name") ?? "").trim();
  const jobTitle = blankToNull(String(formData.get("job_title") ?? ""));
  const website = blankToNull(String(formData.get("website") ?? ""));
  const memberCount = blankToNull(String(formData.get("member_count") ?? ""));
  const primaryIndustries = blankToNull(
    String(formData.get("primary_industries") ?? "")
  );
  const geographicCoverage = blankToNull(
    String(formData.get("geographic_coverage") ?? "")
  );
  const newsletterSize = blankToNull(
    String(formData.get("newsletter_size") ?? "")
  );
  const socialAudience = blankToNull(
    String(formData.get("social_audience") ?? "")
  );
  const websiteTraffic = blankToNull(
    String(formData.get("website_traffic") ?? "")
  );
  const additionalComments = blankToNull(
    String(formData.get("additional_comments") ?? "")
  );

  const promotionChannels = ORGANIZATION_PROMOTION_CHANNELS.map((c) => c.value).filter(
    (value) => formData.get(`channel_${value}`) === "on"
  );
  const interests = ORGANIZATION_INTERESTS.map((c) => c.value).filter(
    (value) => formData.get(`interest_${value}`) === "on"
  );

  if (!organizationName) {
    fieldErrors.organization_name = "Organization name is required.";
  }
  if (!ORGANIZATION_TYPES.some((t) => t.value === organizationType)) {
    fieldErrors.organization_type = "Select an organization type.";
  }
  if (!contactName) {
    fieldErrors.contact_name = "Primary contact name is required.";
  }
  if (promotionChannels.length === 0) {
    fieldErrors.promotion_channels =
      "Select at least one way you plan to promote JobProof.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      fieldErrors,
      error: "Please fix the highlighted fields.",
    };
  }

  const channelLabels = promotionChannels.map(
    (c) =>
      ORGANIZATION_PROMOTION_CHANNELS.find((x) => x.value === c)?.label ?? c
  );
  const interestLabels = interests.map(
    (c) => ORGANIZATION_INTERESTS.find((x) => x.value === c)?.label ?? c
  );
  const typeLabel =
    ORGANIZATION_TYPES.find((t) => t.value === organizationType)?.label ??
    organizationType;

  const next = new FormData();
  for (const [key, value] of formData.entries()) {
    // Skip org-only checkbox keys; core does not understand them.
    if (key.startsWith("channel_") || key.startsWith("interest_")) continue;
    if (
      key === "organization_type" ||
      key === "job_title" ||
      key === "member_count" ||
      key === "primary_industries" ||
      key === "geographic_coverage" ||
      key === "newsletter_size" ||
      key === "social_audience" ||
      key === "website_traffic" ||
      key === "additional_comments"
    ) {
      continue;
    }
    next.append(key, value);
  }

  next.set("partner_type", ORGANIZATION_PARTNER_TYPE);
  next.set("organization_name", organizationName);
  next.set("contact_name", contactName);
  if (website) next.set("website", website);
  if (memberCount) next.set("estimated_audience", memberCount);
  next.set(
    "promotion_plan",
    [
      `Organization type: ${typeLabel}`,
      `Channels: ${channelLabels.join(", ")}`,
      interestLabels.length
        ? `Interests: ${interestLabels.join(", ")}`
        : null,
      geographicCoverage ? `Coverage: ${geographicCoverage}` : null,
      primaryIndustries ? `Industries: ${primaryIndustries}` : null,
    ]
      .filter(Boolean)
      .join("\n")
  );
  next.set(
    "reason",
    additionalComments ||
      `Organization Partner application for ${organizationName} (${typeLabel}).`
  );

  return {
    ok: true,
    formData: next,
    profile: {
      organizationType,
      jobTitle,
      memberCount,
      primaryIndustries,
      geographicCoverage,
      newsletterSize,
      socialAudience,
      websiteTraffic,
      promotionChannels,
      interests,
      additionalComments,
    },
  };
}

export async function insertOrganizationPartnerProfile(
  client: {
    from: (table: "organization_partner_profiles") => {
      insert: (
        row: Record<string, unknown>
      ) => PromiseLike<{ error: { message?: string } | null }>;
    };
  },
  input: { applicationId: string; profile: OrganizationProfilePayload }
): Promise<{ error: string | null }> {
  const { error } = await client.from("organization_partner_profiles").insert({
    application_id: input.applicationId,
    organization_type: input.profile.organizationType,
    job_title: input.profile.jobTitle,
    member_count: input.profile.memberCount,
    primary_industries: input.profile.primaryIndustries,
    geographic_coverage: input.profile.geographicCoverage,
    newsletter_size: input.profile.newsletterSize,
    social_audience: input.profile.socialAudience,
    website_traffic: input.profile.websiteTraffic,
    promotion_channels: input.profile.promotionChannels,
    interests: input.profile.interests,
    additional_comments: input.profile.additionalComments,
  });
  return { error: error?.message ?? null };
}
