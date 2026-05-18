import { PRODUCT_ANALYTICS_EVENTS, trackProductEventOnce } from "@/lib/product-analytics";

/** Track first read-only write block per profile (non-blocking). */
export function trackReadOnlyModeTriggeredSafe(profileId: string | null | undefined): void {
  const id = profileId?.trim();
  if (!id) return;
  void trackProductEventOnce({
    profileId: id,
    eventName: PRODUCT_ANALYTICS_EVENTS.read_only_mode_triggered,
    source: "subscription_gate",
  });
}
