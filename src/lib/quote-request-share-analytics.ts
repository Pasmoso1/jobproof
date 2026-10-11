import { trackGa4Event } from "@/lib/ga4";

/**
 * In-app GA4 events for the contractor "Send Quote Request" tools. Kept apart from
 * GA4_FUNNEL_EVENTS (public acquisition funnel) and never sent to the Meta Pixel.
 * Payloads are a fixed set of enum values, so no phone number, name or request content can leak.
 */
export const QUOTE_REQUEST_SHARE_EVENTS = {
  share_opened: "quote_request_share_opened",
  text_clicked: "quote_request_text_clicked",
  link_copied: "quote_request_link_copied",
  native_share_clicked: "quote_request_native_share_clicked",
  qr_opened: "quote_request_qr_opened",
} as const;

export type QuoteRequestShareEventName =
  (typeof QUOTE_REQUEST_SHARE_EVENTS)[keyof typeof QUOTE_REQUEST_SHARE_EVENTS];

export const QUOTE_REQUEST_SHARE_SOURCES = [
  "dashboard",
  "quote_requests",
  "mobile_global_action",
  "settings",
  "other",
] as const;

export type QuoteRequestShareSource = (typeof QUOTE_REQUEST_SHARE_SOURCES)[number];

export type QuoteRequestShareDetails = {
  /** What was copied: the bare link, or the full text message (fallback after Send by Text). */
  copy_target?: "link" | "message";
  /** Whether the device share sheet opened or the link was copied instead. */
  share_method?: "native" | "copy_fallback";
};

export function trackQuoteRequestShare(
  eventName: QuoteRequestShareEventName,
  sourceLocation: QuoteRequestShareSource,
  details: QuoteRequestShareDetails = {}
): boolean {
  return trackGa4Event(eventName, {
    source_location: sourceLocation,
    copy_target: details.copy_target,
    share_method: details.share_method,
  });
}
