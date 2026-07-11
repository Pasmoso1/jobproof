import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ACTIVE_JOB_LIMIT_REACHED_MESSAGE,
  getPlanEntitlements,
  type PlanEntitlementProfile,
} from "@/lib/plan-entitlements";

/**
 * Count jobs that consume an active-job slot (status = 'active').
 * Completed / cancelled jobs do not count.
 */
export async function countActiveJobsForLimit(
  supabase: SupabaseClient,
  profileId: string
): Promise<number> {
  const { count } = await supabase
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profileId)
    .eq("status", "active");
  return count ?? 0;
}

export type ActiveJobLimitCheck =
  | { ok: true; activeCount: number; maxActiveJobs: number | null }
  | { ok: false; error: string; activeCount: number; maxActiveJobs: number };

/**
 * Server-side active-job cap based on effective plan entitlements.
 */
export async function assertActiveJobSlotAvailable(
  supabase: SupabaseClient,
  profileId: string,
  profile: PlanEntitlementProfile
): Promise<ActiveJobLimitCheck> {
  const entitlements = getPlanEntitlements(profile);
  const activeCount = await countActiveJobsForLimit(supabase, profileId);
  const max = entitlements.maxActiveJobs;

  if (max !== null && activeCount >= max) {
    return {
      ok: false,
      error: ACTIVE_JOB_LIMIT_REACHED_MESSAGE(max),
      activeCount,
      maxActiveJobs: max,
    };
  }

  return { ok: true, activeCount, maxActiveJobs: max };
}
