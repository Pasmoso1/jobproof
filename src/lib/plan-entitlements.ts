import type { BillingPlanTier } from "@/lib/stripe";
import { parseBillingPlanTier } from "@/lib/billing-plan-display";

/** Bytes in one gigabyte (binary). */
export const BYTES_PER_GB = 1024 * 1024 * 1024;

export type PlanEntitlements = {
  /** Internal billing tier key (`essential` = Solo, `professional` = Pro). */
  tier: BillingPlanTier;
  /** Marketing / UI label. */
  label: "Solo" | "Pro";
  /** Secure storage allowance in bytes. */
  storageBytes: number;
  /** Max concurrent active jobs; `null` = unlimited. */
  maxActiveJobs: number | null;
  /** Max primary + additional trades; `null` = unlimited. */
  maxTotalTrades: number | null;
};

/**
 * Canonical Solo / Pro entitlements.
 * Homepage marketing and server-side enforcement must both use this source.
 */
export const PLAN_ENTITLEMENTS: Record<BillingPlanTier, PlanEntitlements> = {
  essential: {
    tier: "essential",
    label: "Solo",
    storageBytes: 10 * BYTES_PER_GB,
    maxActiveJobs: 10,
    maxTotalTrades: 2,
  },
  professional: {
    tier: "professional",
    label: "Pro",
    storageBytes: 100 * BYTES_PER_GB,
    maxActiveJobs: null,
    maxTotalTrades: null,
  },
};

export type PlanEntitlementProfile = {
  beta_tester?: boolean | null;
  beta_plan_tier?: string | null;
  plan_tier?: string | null;
};

/**
 * Resolve the contractor's effective paid/trial plan.
 * Defaults to Solo (`essential`) when no tier is set yet.
 */
export function resolveEffectivePlanTier(
  profile: PlanEntitlementProfile | null | undefined
): BillingPlanTier {
  if (!profile) return "essential";
  if (profile.beta_tester === true) {
    return (
      parseBillingPlanTier(String(profile.beta_plan_tier ?? "")) ??
      parseBillingPlanTier(String(profile.plan_tier ?? "")) ??
      "essential"
    );
  }
  return parseBillingPlanTier(String(profile.plan_tier ?? "")) ?? "essential";
}

export function getPlanEntitlements(
  profileOrTier: PlanEntitlementProfile | BillingPlanTier | null | undefined
): PlanEntitlements {
  if (profileOrTier === "essential" || profileOrTier === "professional") {
    return PLAN_ENTITLEMENTS[profileOrTier];
  }
  return PLAN_ENTITLEMENTS[resolveEffectivePlanTier(profileOrTier)];
}

export function formatStorageBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < BYTES_PER_GB) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  const gb = bytes / BYTES_PER_GB;
  return Number.isInteger(gb) ? `${gb} GB` : `${gb.toFixed(1)} GB`;
}

export function formatStorageAllowance(entitlements: PlanEntitlements): string {
  return formatStorageBytes(entitlements.storageBytes);
}

export function formatActiveJobLimit(entitlements: PlanEntitlements): string {
  return entitlements.maxActiveJobs === null
    ? "Unlimited"
    : String(entitlements.maxActiveJobs);
}

export function formatTradeLimit(entitlements: PlanEntitlements): string {
  return entitlements.maxTotalTrades === null
    ? "Unlimited"
    : `Up to ${entitlements.maxTotalTrades}`;
}

export function storagePercentUsed(usedBytes: number, limitBytes: number): number {
  if (!Number.isFinite(usedBytes) || usedBytes <= 0) return 0;
  if (!Number.isFinite(limitBytes) || limitBytes <= 0) return 100;
  return Math.min(100, Math.round((usedBytes / limitBytes) * 100));
}

/** Profile columns kept in sync for admin/legacy display (not used for enforcement). */
export function profileLimitColumnsForTier(tier: BillingPlanTier): {
  active_job_limit: number;
  storage_limit_mb: number;
} {
  const e = PLAN_ENTITLEMENTS[tier];
  return {
    active_job_limit: e.maxActiveJobs ?? 1_000_000,
    storage_limit_mb: Math.round(e.storageBytes / (1024 * 1024)),
  };
}

export const SOLO_TRADE_LIMIT_UPGRADE_MESSAGE =
  "Solo includes up to 2 trades. Upgrade to Pro to add more.";

export const ACTIVE_JOB_LIMIT_REACHED_MESSAGE = (limit: number) =>
  `Active job limit (${limit}) reached. Complete or cancel a job, or upgrade to Pro for unlimited active jobs.`;

export const STORAGE_LIMIT_REACHED_MESSAGE = (label: "Solo" | "Pro") =>
  label === "Solo"
    ? "You've reached your Solo storage limit (10 GB). Remove files or upgrade to Pro for 100 GB."
    : "You've reached your Pro storage limit (100 GB). Remove files to free up space.";

export function countTotalTrades(
  primaryTrade: string | null | undefined,
  additionalTrades: readonly string[] | null | undefined
): number {
  const primary = String(primaryTrade ?? "").trim() ? 1 : 0;
  const additional = (additionalTrades ?? []).filter((t) => String(t).trim()).length;
  return primary + additional;
}
