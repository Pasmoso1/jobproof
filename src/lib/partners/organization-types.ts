/**
 * Organization Partner application options and helpers.
 */

export const ORGANIZATION_TYPES = [
  { value: "chamber_of_commerce", label: "Chamber of Commerce" },
  { value: "construction_association", label: "Construction Association" },
  { value: "trade_association", label: "Trade Association" },
  { value: "industry_association", label: "Industry Association" },
  { value: "contractor_association", label: "Contractor Association" },
  { value: "home_builders_association", label: "Home Builders' Association" },
  { value: "landscape_association", label: "Landscape Association" },
  { value: "plumbing_association", label: "Plumbing Association" },
  { value: "electrical_association", label: "Electrical Association" },
  { value: "hvac_association", label: "HVAC Association" },
  { value: "roofing_association", label: "Roofing Association" },
  { value: "renovation_association", label: "Renovation Association" },
  { value: "buying_group", label: "Buying Group" },
  { value: "franchise_organization", label: "Franchise Organization" },
  { value: "business_improvement", label: "Business Improvement Association" },
  { value: "business_network", label: "Business Network" },
  { value: "small_business_organization", label: "Small Business Organization" },
  { value: "other", label: "Other" },
] as const;

export type OrganizationTypeValue = (typeof ORGANIZATION_TYPES)[number]["value"];

export const ORGANIZATION_PROMOTION_CHANNELS = [
  { value: "newsletter", label: "Newsletter" },
  { value: "website", label: "Website" },
  { value: "social_media", label: "Social Media" },
  { value: "trade_shows", label: "Trade Shows" },
  { value: "events", label: "Events" },
  { value: "member_onboarding", label: "Member Onboarding" },
  { value: "email_campaigns", label: "Email Campaigns" },
  { value: "educational_webinars", label: "Educational Webinars" },
  { value: "other", label: "Other" },
] as const;

export const ORGANIZATION_INTERESTS = [
  { value: "co_branded_marketing", label: "Co-branded Marketing" },
  { value: "member_webinars", label: "Member Webinars" },
  { value: "conference_materials", label: "Conference Materials" },
  { value: "member_resources", label: "Member Resources" },
  { value: "other", label: "Other" },
] as const;

export function organizationTypeLabel(value: string): string {
  return (
    ORGANIZATION_TYPES.find((t) => t.value === value)?.label ?? value
  );
}
