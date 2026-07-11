import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { PRODUCT_ANALYTICS_EVENTS, trackProductEventSafe } from "@/lib/product-analytics";
import { parseBillingPlanTier } from "@/lib/billing-plan-display";
import {
  sendTrialDay3Email,
  sendTrialDay7Email,
  sendTrialDay12Email,
  sendTrialEndedEmail,
} from "@/lib/trial-emails";
import { getTrialDaysRemaining } from "@/lib/trial-lifecycle";

export type TrialReminderAutomationRunResult = {
  profilesScanned: number;
  day3Sent: number;
  day7Sent: number;
  day12Sent: number;
  endedSent: number;
  expiredMarked: number;
  skipped: number;
  failed: number;
};

function hoursSince(iso: string | null | undefined, now: Date): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return (now.getTime() - t) / (60 * 60 * 1000);
}

/**
 * Sends day 3/7/12/ended trial emails and marks expired trials.
 * Skips anyone with an active Stripe subscription (reminders cancelled on subscribe).
 */
export async function runTrialReminderAutomation(): Promise<TrialReminderAutomationRunResult> {
  const admin = createServiceRoleClient();
  const out: TrialReminderAutomationRunResult = {
    profilesScanned: 0,
    day3Sent: 0,
    day7Sent: 0,
    day12Sent: 0,
    endedSent: 0,
    expiredMarked: 0,
    skipped: 0,
    failed: 0,
  };

  if (!admin) {
    console.error("[runTrialReminderAutomation] Missing service role client");
    return out;
  }

  const db = admin;
  const now = new Date();
  const { data: profiles, error } = await db
    .from("profiles")
    .select(
      `
      id,
      user_id,
      subscription_status,
      stripe_subscription_id,
      trial_started_at,
      trial_ends_at,
      trial_plan_tier,
      plan_tier,
      beta_tester,
      trial_email_day3_sent_at,
      trial_email_day7_sent_at,
      trial_email_day12_sent_at,
      trial_email_ended_sent_at
    `
    )
    .not("trial_started_at", "is", null)
    .eq("beta_tester", false)
    .limit(2000);

  if (error) {
    console.error("[runTrialReminderAutomation]", error.message);
    return out;
  }

  for (const profile of profiles ?? []) {
    out.profilesScanned += 1;

    const subId = String(profile.stripe_subscription_id ?? "").trim();
    const status = String(profile.subscription_status ?? "").trim().toLowerCase();
    if (subId && ["active", "trialing", "past_due"].includes(status)) {
      out.skipped += 1;
      continue;
    }

    const { data: authData } = await db.auth.admin.getUserById(String(profile.user_id));
    const email = authData.user?.email?.trim() || null;
    if (!email) {
      out.skipped += 1;
      continue;
    }

    const planTier =
      parseBillingPlanTier(String(profile.trial_plan_tier ?? "")) ??
      parseBillingPlanTier(String(profile.plan_tier ?? ""));
    const hours = hoursSince(profile.trial_started_at, now);
    const daysRemaining = getTrialDaysRemaining(profile, now);
    const trialEnded =
      status === "expired" ||
      (Boolean(profile.trial_ends_at) &&
        new Date(String(profile.trial_ends_at)).getTime() <= now.getTime());

    if (trialEnded && status !== "expired" && !subId) {
      const { error: expErr } = await db
        .from("profiles")
        .update({ subscription_status: "expired" })
        .eq("id", profile.id)
        .in("subscription_status", ["trial", "pending_trial"]);
      if (!expErr) {
        out.expiredMarked += 1;
        trackProductEventSafe({
          profileId: String(profile.id),
          eventName: PRODUCT_ANALYTICS_EVENTS.trial_expired,
          source: "trial_reminder_cron",
          metadata: {
            selected_plan: planTier,
            trial_started_at: profile.trial_started_at,
            trial_ends_at: profile.trial_ends_at,
          },
        });
      }
    }

    async function markSent(column: string): Promise<void> {
      await db
        .from("profiles")
        .update({ [column]: now.toISOString() })
        .eq("id", profile.id);
    }

    try {
      if (hours != null && hours >= 72 && !profile.trial_email_day3_sent_at && !trialEnded) {
        await sendTrialDay3Email({
          profileId: String(profile.id),
          userEmail: email,
          planTier,
          daysRemaining,
        });
        await markSent("trial_email_day3_sent_at");
        trackProductEventSafe({
          profileId: String(profile.id),
          eventName: PRODUCT_ANALYTICS_EVENTS.trial_day_3,
          source: "trial_reminder_cron",
          metadata: { selected_plan: planTier, days_remaining: daysRemaining },
        });
        out.day3Sent += 1;
      }

      if (hours != null && hours >= 168 && !profile.trial_email_day7_sent_at && !trialEnded) {
        await sendTrialDay7Email({
          profileId: String(profile.id),
          userEmail: email,
          planTier,
          daysRemaining,
        });
        await markSent("trial_email_day7_sent_at");
        trackProductEventSafe({
          profileId: String(profile.id),
          eventName: PRODUCT_ANALYTICS_EVENTS.trial_day_7,
          source: "trial_reminder_cron",
          metadata: { selected_plan: planTier, days_remaining: daysRemaining },
        });
        out.day7Sent += 1;
      }

      if (hours != null && hours >= 288 && !profile.trial_email_day12_sent_at && !trialEnded) {
        await sendTrialDay12Email({
          profileId: String(profile.id),
          userEmail: email,
          planTier,
          daysRemaining,
        });
        await markSent("trial_email_day12_sent_at");
        trackProductEventSafe({
          profileId: String(profile.id),
          eventName: PRODUCT_ANALYTICS_EVENTS.trial_day_12,
          source: "trial_reminder_cron",
          metadata: { selected_plan: planTier, days_remaining: daysRemaining },
        });
        out.day12Sent += 1;
      }

      if (trialEnded && !profile.trial_email_ended_sent_at && !subId) {
        await sendTrialEndedEmail({
          profileId: String(profile.id),
          userEmail: email,
          planTier,
        });
        await markSent("trial_email_ended_sent_at");
        out.endedSent += 1;
      }
    } catch (err) {
      out.failed += 1;
      console.error("[runTrialReminderAutomation] profile", profile.id, err);
    }
  }

  return out;
}
