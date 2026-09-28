import { cookies } from "next/headers";
import {
  GA4_TRIAL_STARTED_PENDING_COOKIE,
  normalizeTrialStartedMarkerValue,
  trialStartedPendingCookieOptions,
} from "@/lib/ga4-trial-started-marker";

/**
 * Call from a server action only after the managed trial was actually activated.
 * Analytics must never break onboarding, so failures are swallowed.
 */
export async function markTrialStartedAnalyticsPending(
  planTier: string | null | undefined
): Promise<void> {
  try {
    const store = await cookies();
    store.set(
      GA4_TRIAL_STARTED_PENDING_COOKIE,
      normalizeTrialStartedMarkerValue(planTier) ?? "1",
      trialStartedPendingCookieOptions()
    );
  } catch {
    /* ignore */
  }
}
