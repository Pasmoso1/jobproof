"use server";

import { trackContractorMilestone } from "@/lib/contractor-milestones";
import {
  PRODUCT_ANALYTICS_EVENTS,
  trackProductEventOnce,
} from "@/lib/product-analytics";
import { createClient } from "@/lib/supabase/server";

async function requireProfileId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  return profile?.id ? String(profile.id) : null;
}

export async function trackOnboardingStartedAction(
  source: string
): Promise<{ ok: true } | { ok: false }> {
  const profileId = await requireProfileId();
  if (!profileId) return { ok: false };

  await trackContractorMilestone({
    profileId,
    eventName: PRODUCT_ANALYTICS_EVENTS.onboarding_started,
    source: source.trim() || "unknown",
  });
  return { ok: true };
}

export async function trackSampleJobViewedAction(): Promise<{ ok: true } | { ok: false }> {
  const profileId = await requireProfileId();
  if (!profileId) return { ok: false };

  await trackProductEventOnce({
    profileId,
    eventName: PRODUCT_ANALYTICS_EVENTS.sample_job_viewed,
    source: "dashboard_sample",
  });
  return { ok: true };
}

export async function trackProofReportExportedAction(
  jobId: string
): Promise<{ ok: true } | { ok: false }> {
  const profileId = await requireProfileId();
  if (!profileId) return { ok: false };

  await trackProductEventOnce({
    profileId,
    eventName: PRODUCT_ANALYTICS_EVENTS.proof_report_exported,
    source: "proof_report",
    metadata: { job_id: jobId },
  });
  return { ok: true };
}
