import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computeLifecycleSummary,
  type AttentionCounts,
  type LifecycleProfileRow,
  type LifecycleSummary,
  type MetricCount,
} from "@/lib/admin/overview-metrics";

/**
 * Server-side data access for the admin Overview. Read-only; callers pass a service-role
 * client that was created only after `requireAdminUser*` succeeded.
 *
 * Queries are bounded: totals use `head: true` count queries (no rows transferred) and the
 * lifecycle classification reads a fixed set of narrow columns in capped pages. A failing
 * query yields `{ ok: false }` so the UI says "Unavailable" instead of showing a false zero.
 */

type CountResponse = PromiseLike<{ count: number | null; error: unknown }>;

export async function toMetricCount(query: CountResponse): Promise<MetricCount> {
  try {
    const { count, error } = await query;
    if (error || count == null) return { ok: false };
    return { ok: true, value: count };
  } catch {
    return { ok: false };
  }
}

const headCount = { count: "exact", head: true } as const;

/** PostgREST caps responses (default 1000 rows), so page explicitly and cap total work. */
export const LIFECYCLE_PAGE_SIZE = 1000;
export const LIFECYCLE_MAX_PAGES = 10;

const LIFECYCLE_COLUMNS =
  "id,user_id,business_name,created_at,subscription_status,stripe_subscription_id,trial_started_at,trial_ends_at,beta_tester";

export type LifecycleFetch =
  | { ok: true; rows: LifecycleProfileRow[]; truncated: boolean }
  | { ok: false };

export async function fetchLifecycleProfiles(admin: SupabaseClient): Promise<LifecycleFetch> {
  const rows: LifecycleProfileRow[] = [];
  try {
    for (let page = 0; page < LIFECYCLE_MAX_PAGES; page += 1) {
      const from = page * LIFECYCLE_PAGE_SIZE;
      const { data, error } = await admin
        .from("profiles")
        .select(LIFECYCLE_COLUMNS)
        .order("id", { ascending: true })
        .range(from, from + LIFECYCLE_PAGE_SIZE - 1);
      if (error) return { ok: false };
      const batch = (data ?? []) as unknown as LifecycleProfileRow[];
      rows.push(...batch);
      if (batch.length < LIFECYCLE_PAGE_SIZE) return { ok: true, rows, truncated: false };
    }
    // Filled every page: there may be more profiles than we inspected.
    return { ok: true, rows, truncated: true };
  } catch {
    return { ok: false };
  }
}

export type BusinessPerformanceData = {
  totalContractors: MetricCount;
  newContractors30d: MetricCount;
  partnerAttributedRegistrations: MetricCount;
  /** null when profiles could not be loaded. */
  lifecycle: (LifecycleSummary & { truncated: boolean }) | null;
};

export const NEW_CONTRACTOR_WINDOW_DAYS = 30;

export async function fetchBusinessPerformance(
  admin: SupabaseClient,
  now: Date = new Date(),
  prefetched?: LifecycleFetch
): Promise<BusinessPerformanceData> {
  const since = new Date(now.getTime() - NEW_CONTRACTOR_WINDOW_DAYS * 86_400_000).toISOString();
  const [totalContractors, newContractors30d, partnerAttributedRegistrations, lifecycleFetch] =
    await Promise.all([
      toMetricCount(admin.from("profiles").select("id", headCount)),
      toMetricCount(admin.from("profiles").select("id", headCount).gte("created_at", since)),
      toMetricCount(admin.from("partner_referrals").select("id", headCount)),
      prefetched ? Promise.resolve(prefetched) : fetchLifecycleProfiles(admin),
    ]);

  return {
    totalContractors,
    newContractors30d,
    partnerAttributedRegistrations,
    lifecycle: lifecycleFetch.ok
      ? { ...computeLifecycleSummary(lifecycleFetch.rows, now), truncated: lifecycleFetch.truncated }
      : null,
  };
}

export async function fetchAttentionCounts(
  admin: SupabaseClient,
  lifecycle: BusinessPerformanceData["lifecycle"]
): Promise<AttentionCounts> {
  const [partnerApplicationsAwaitingReview, rewardsReadyForPayout, rewardsNeedingReview] =
    await Promise.all([
      toMetricCount(
        admin
          .from("partner_applications")
          .select("id", headCount)
          .in("status", ["submitted", "under_review"])
      ),
      // Same definition the payout dashboard uses for "ready": approved and not yet in a payout.
      toMetricCount(
        admin
          .from("partner_referrals")
          .select("id", headCount)
          .eq("reward_status", "approved")
          .is("payout_id", null)
      ),
      toMetricCount(
        admin.from("partner_referrals").select("id", headCount).eq("reward_status", "needs_review")
      ),
    ]);

  const fromLifecycle = (n: number | undefined): MetricCount =>
    lifecycle && n != null ? { ok: true, value: n } : { ok: false };

  return {
    partnerApplicationsAwaitingReview,
    rewardsReadyForPayout,
    rewardsNeedingReview,
    pastDueContractors: fromLifecycle(lifecycle?.pastDue.length),
    trialsEndingSoon: fromLifecycle(lifecycle?.trialsEndingSoon.length),
  };
}

export type WaitlistOverview = { total: MetricCount; last7Days: MetricCount };

export async function fetchWaitlistOverview(
  admin: SupabaseClient,
  now: Date = new Date()
): Promise<WaitlistOverview> {
  const since = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const [total, last7Days] = await Promise.all([
    toMetricCount(admin.from("waitlist_signups").select("id", headCount)),
    toMetricCount(admin.from("waitlist_signups").select("id", headCount).gte("created_at", since)),
  ]);
  return { total, last7Days };
}

export type FollowUpAccount = {
  profileId: string;
  email: string;
  business: string;
  detail: string;
};

/** Resolves display emails for a handful of rows (bounded by the caller's slice). */
export async function resolveFollowUpAccounts(
  admin: SupabaseClient,
  rows: readonly LifecycleProfileRow[],
  detail: (row: LifecycleProfileRow) => string
): Promise<FollowUpAccount[]> {
  return Promise.all(
    rows.map(async (row) => {
      let email = "(email unavailable)";
      if (row.user_id) {
        try {
          const { data } = await admin.auth.admin.getUserById(String(row.user_id));
          if (data?.user?.email) email = data.user.email;
        } catch {
          // keep placeholder
        }
      }
      return {
        profileId: row.id,
        email,
        business: String(row.business_name ?? "").trim() || "—",
        detail: detail(row),
      };
    })
  );
}
