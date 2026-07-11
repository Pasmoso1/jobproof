import {
  QUOTE_PRICING_PROFILES,
  type QuotePricingProfile,
  type QuotePrimaryTrade,
} from "@/lib/quote-requests/constants";
import { validateQuoteSlug } from "@/lib/quote-requests/slug";
import { parseContractorExtraCapabilities } from "@/lib/validation/contractor-extra-capabilities";
import {
  validateContractorTradesFields,
} from "@/lib/validation/contractor-trades";

export function parseQuotePricingProfile(raw: string): QuotePricingProfile | null {
  const v = raw.trim().toLowerCase();
  return (QUOTE_PRICING_PROFILES as readonly string[]).includes(v)
    ? (v as QuotePricingProfile)
    : null;
}

export { parseQuotePrimaryTrade } from "@/lib/validation/contractor-trades";

export function validateQuoteRequestSettings(input: {
  quoteSlug: string;
  businessName: string;
  businessPhone: string;
  logoUrl: string;
  pricingProfile: string;
  primaryTrade: string;
  primaryTradeOther: string;
  additionalTrades: string[];
  contractorExtraCapabilities: string;
  maxTotalTrades?: number | null;
  previousTotalTrades?: number | null;
}): { ok: true; data: {
  quoteSlug: string;
  businessName: string;
  businessPhone: string;
  logoUrl: string | null;
  pricingProfile: QuotePricingProfile;
  primaryTrade: QuotePrimaryTrade;
  primaryTradeOther: string | null;
  additionalTrades: QuotePrimaryTrade[];
  contractorExtraCapabilities: string | null;
} } | { ok: false; fieldErrors: Record<string, string> } {
  const fieldErrors: Record<string, string> = {};

  const slugResult = validateQuoteSlug(input.quoteSlug);
  if (!slugResult.ok) {
    fieldErrors.quoteSlug = slugResult.error;
  }

  const businessName = input.businessName.trim();
  if (!businessName) {
    fieldErrors.businessName = "Business name is required.";
  }

  const businessPhone = input.businessPhone.trim();
  if (!businessPhone) {
    fieldErrors.businessPhone = "Business phone is required.";
  }

  const logoUrlRaw = input.logoUrl.trim();
  let logoUrl: string | null = null;
  if (logoUrlRaw) {
    try {
      const u = new URL(logoUrlRaw);
      if (!["http:", "https:"].includes(u.protocol)) {
        fieldErrors.logoUrl = "Logo URL must start with http:// or https://";
      } else {
        logoUrl = logoUrlRaw;
      }
    } catch {
      fieldErrors.logoUrl = "Enter a valid logo URL.";
    }
  }

  const pricingProfile = parseQuotePricingProfile(input.pricingProfile);
  if (!pricingProfile) {
    fieldErrors.pricingProfile = "Select a pricing profile.";
  }

  const tradesResult = validateContractorTradesFields({
    primaryTrade: input.primaryTrade,
    primaryTradeOther: input.primaryTradeOther,
    additionalTrades: input.additionalTrades,
    primaryTradeRequired: true,
    maxTotalTrades: input.maxTotalTrades,
    previousTotalTrades: input.previousTotalTrades,
  });
  if (!tradesResult.ok) {
    Object.assign(fieldErrors, tradesResult.fieldErrors);
  }
  const primaryTrade = tradesResult.ok ? tradesResult.data.primaryTrade : null;
  const primaryTradeOther = tradesResult.ok ? tradesResult.data.primaryTradeOther : null;
  const additionalTrades = tradesResult.ok ? tradesResult.data.additionalTrades : [];

  const extraCapabilitiesResult = parseContractorExtraCapabilities(
    input.contractorExtraCapabilities
  );
  if (extraCapabilitiesResult.error) {
    fieldErrors.contractorExtraCapabilities = extraCapabilitiesResult.error;
  }

  if (
    Object.keys(fieldErrors).length > 0 ||
    !slugResult.ok ||
    !pricingProfile ||
    !primaryTrade ||
    !tradesResult.ok ||
    extraCapabilitiesResult.error
  ) {
    return { ok: false, fieldErrors };
  }

  return {
    ok: true,
    data: {
      quoteSlug: slugResult.slug,
      businessName,
      businessPhone,
      logoUrl,
      pricingProfile,
      primaryTrade,
      primaryTradeOther,
      additionalTrades,
      contractorExtraCapabilities: extraCapabilitiesResult.value,
    },
  };
}
