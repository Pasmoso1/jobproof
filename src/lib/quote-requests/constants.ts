export const QUOTE_REQUEST_STATUSES = [
  "new",
  "reviewed",
  "responded",
  "site_visit_requested",
  "converted",
  "closed",
] as const;

export type QuoteRequestStatus = (typeof QUOTE_REQUEST_STATUSES)[number];

export const QUOTE_PRICING_PROFILES = ["budget", "average", "premium"] as const;
export type QuotePricingProfile = (typeof QUOTE_PRICING_PROFILES)[number];

export const QUOTE_PRIMARY_TRADES = [
  "Painter",
  "Landscaper",
  "Renovator",
  "Handyman",
  "Roofer",
  "HVAC",
  "Plumber",
  "Electrician",
  "Flooring",
  "Deck/Fence",
  "Other",
] as const;

export type QuotePrimaryTrade = (typeof QUOTE_PRIMARY_TRADES)[number];

/** Trades available for multi-select additional trades (excludes Other). */
export const QUOTE_ADDITIONAL_TRADE_OPTIONS = QUOTE_PRIMARY_TRADES.filter(
  (trade) => trade !== "Other"
);

export const QUOTE_REQUEST_STORAGE_BUCKET = "quote-request-attachments";

export const MAX_QUOTE_REQUEST_PHOTOS = 10;
export const MAX_QUOTE_REQUEST_PHOTO_BYTES = 10 * 1024 * 1024;

export const MAX_SITE_VISIT_PHOTOS = 20;
export const MAX_SITE_VISIT_PHOTO_BYTES = 10 * 1024 * 1024;
export const MAX_SITE_VISIT_VOICE_BYTES = 25 * 1024 * 1024;

export function quoteRequestStatusLabel(status: string): string {
  switch (status) {
    case "new":
      return "New";
    case "reviewed":
      return "Reviewed";
    case "responded":
      return "Responded";
    case "site_visit_requested":
      return "Site visit requested";
    case "converted":
      return "Converted";
    case "closed":
      return "Closed";
    default:
      return status;
  }
}

export function quoteRequestListBucket(status: QuoteRequestStatus): "new" | "awaiting" | "responded" | "closed" {
  if (status === "new") return "new";
  if (status === "reviewed" || status === "site_visit_requested") return "awaiting";
  if (status === "responded") return "responded";
  return "closed";
}

export function pricingProfileLabel(profile: string | null | undefined): string {
  switch (profile) {
    case "budget":
      return "Budget";
    case "average":
      return "Average";
    case "premium":
      return "Premium";
    default:
      return "—";
  }
}
