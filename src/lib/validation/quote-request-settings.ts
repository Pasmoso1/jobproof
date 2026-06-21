import {
  QUOTE_PRICING_PROFILES,
  QUOTE_PRIMARY_TRADES,
  type QuotePricingProfile,
  type QuotePrimaryTrade,
} from "@/lib/quote-requests/constants";
import { validateQuoteSlug } from "@/lib/quote-requests/slug";

const MAX_PRIMARY_TRADE_OTHER_LENGTH = 80;

export function parseQuotePricingProfile(raw: string): QuotePricingProfile | null {
  const v = raw.trim().toLowerCase();
  return (QUOTE_PRICING_PROFILES as readonly string[]).includes(v)
    ? (v as QuotePricingProfile)
    : null;
}

export function parseQuotePrimaryTrade(raw: string): QuotePrimaryTrade | null {
  const v = raw.trim();
  return (QUOTE_PRIMARY_TRADES as readonly string[]).includes(v) ? (v as QuotePrimaryTrade) : null;
}

export function validateQuoteRequestSettings(input: {
  quoteSlug: string;
  businessName: string;
  businessPhone: string;
  logoUrl: string;
  pricingProfile: string;
  primaryTrade: string;
  primaryTradeOther: string;
}): { ok: true; data: {
  quoteSlug: string;
  businessName: string;
  businessPhone: string;
  logoUrl: string | null;
  pricingProfile: QuotePricingProfile;
  primaryTrade: QuotePrimaryTrade;
  primaryTradeOther: string | null;
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

  const primaryTrade = parseQuotePrimaryTrade(input.primaryTrade);
  if (!primaryTrade) {
    fieldErrors.primaryTrade = "Select a primary trade.";
  }

  let primaryTradeOther: string | null = null;
  if (primaryTrade === "Other") {
    const custom = input.primaryTradeOther.trim();
    if (!custom) {
      fieldErrors.primaryTradeOther = "Please specify your trade.";
    } else if (custom.length > MAX_PRIMARY_TRADE_OTHER_LENGTH) {
      fieldErrors.primaryTradeOther = `Trade name must be ${MAX_PRIMARY_TRADE_OTHER_LENGTH} characters or less.`;
    } else {
      primaryTradeOther = custom;
    }
  }

  if (
    Object.keys(fieldErrors).length > 0 ||
    !slugResult.ok ||
    !pricingProfile ||
    !primaryTrade
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
    },
  };
}
