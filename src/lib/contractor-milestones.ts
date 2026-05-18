import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  getContractorActivationState,
  isOnboardingComplete,
} from "@/lib/contractor-activation";
import {
  PRODUCT_ANALYTICS_EVENTS,
  trackProductEvent,
  trackProductEventOnce,
  type ProductAnalyticsMetadata,
} from "@/lib/product-analytics";

type MilestoneEvent =
  | typeof PRODUCT_ANALYTICS_EVENTS.onboarding_started
  | typeof PRODUCT_ANALYTICS_EVENTS.sample_job_viewed
  | typeof PRODUCT_ANALYTICS_EVENTS.first_job_created
  | typeof PRODUCT_ANALYTICS_EVENTS.first_job_update_added
  | typeof PRODUCT_ANALYTICS_EVENTS.first_contract_sent
  | typeof PRODUCT_ANALYTICS_EVENTS.first_invoice_sent
  | typeof PRODUCT_ANALYTICS_EVENTS.first_payment_recorded
  | typeof PRODUCT_ANALYTICS_EVENTS.onboarding_completed
  | typeof PRODUCT_ANALYTICS_EVENTS.stripe_connect_started
  | typeof PRODUCT_ANALYTICS_EVENTS.stripe_connect_completed
  | typeof PRODUCT_ANALYTICS_EVENTS.read_only_mode_triggered;

const PROFILE_TIMESTAMP_BY_EVENT: Partial<
  Record<MilestoneEvent, string>
> = {
  [PRODUCT_ANALYTICS_EVENTS.onboarding_started]: "onboarding_started_at",
  [PRODUCT_ANALYTICS_EVENTS.first_job_created]: "first_job_created_at",
  [PRODUCT_ANALYTICS_EVENTS.first_job_update_added]: "first_job_update_at",
  [PRODUCT_ANALYTICS_EVENTS.first_contract_sent]: "first_contract_sent_at",
  [PRODUCT_ANALYTICS_EVENTS.first_invoice_sent]: "first_invoice_sent_at",
  [PRODUCT_ANALYTICS_EVENTS.first_payment_recorded]: "first_payment_recorded_at",
  [PRODUCT_ANALYTICS_EVENTS.onboarding_completed]: "onboarding_completed_at",
};

async function setProfileTimestampOnce(
  profileId: string,
  column: string
): Promise<boolean> {
  const admin = createServiceRoleClient();
  if (!admin) return false;

  const now = new Date().toISOString();
  const { data: row } = await admin
    .from("profiles")
    .select(column)
    .eq("id", profileId)
    .maybeSingle();

  const existing = row ? (row as unknown as Record<string, unknown>)[column] : null;
  if (existing) return false;

  const { error } = await admin
    .from("profiles")
    .update({ [column]: now })
    .eq("id", profileId)
    .is(column, null);

  return !error;
}

/**
 * Track a once-per-profile milestone: updates profile timestamp (if applicable) and inserts analytics row.
 */
export async function trackContractorMilestone(input: {
  profileId: string;
  eventName: MilestoneEvent;
  source?: string | null;
  route?: string | null;
  metadata?: ProductAnalyticsMetadata;
}): Promise<void> {
  try {
    const profileId = input.profileId.trim();
    if (!profileId) return;

    const column = PROFILE_TIMESTAMP_BY_EVENT[input.eventName];
    if (column) {
      const wasNew = await setProfileTimestampOnce(profileId, column);
      if (!wasNew) return;
    } else {
      const inserted = await trackProductEventOnce({
        profileId,
        eventName: input.eventName,
        source: input.source,
        route: input.route,
        metadata: input.metadata,
      });
      if (!inserted) return;
      return;
    }

    await trackProductEvent({
      profileId,
      eventName: input.eventName,
      source: input.source,
      route: input.route,
      metadata: input.metadata,
    });

    if (
      input.eventName !== PRODUCT_ANALYTICS_EVENTS.onboarding_completed &&
      input.eventName !== PRODUCT_ANALYTICS_EVENTS.onboarding_started &&
      input.eventName !== PRODUCT_ANALYTICS_EVENTS.sample_job_viewed
    ) {
      await maybeTrackOnboardingCompleted(profileId);
    }
  } catch (err) {
    console.error("[contractor-milestones] track failed", err);
  }
}

export function trackContractorMilestoneSafe(
  input: Parameters<typeof trackContractorMilestone>[0]
): void {
  void trackContractorMilestone(input);
}

/**
 * Central onboarding_completed: job + proof + (contract OR invoice).
 */
export async function maybeTrackOnboardingCompleted(profileId: string): Promise<void> {
  try {
    const state = await getContractorActivationState(profileId);
    if (state.onboardingCompletedAt) return;
    if (!isOnboardingComplete(state)) return;

    await trackContractorMilestone({
      profileId,
      eventName: PRODUCT_ANALYTICS_EVENTS.onboarding_completed,
      source: "activation_check",
    });
  } catch (err) {
    console.error("[contractor-milestones] onboarding complete check failed", err);
  }
}

export function maybeTrackOnboardingCompletedSafe(profileId: string): void {
  void maybeTrackOnboardingCompleted(profileId);
}
