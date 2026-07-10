import type { BillingPlanTier } from "@/lib/stripe";

/** Active job limits enforced via `profiles.active_job_limit`. */
export const ESSENTIAL_ACTIVE_JOB_LIMIT = 10;

/** Default storage limit in MB (`profiles.storage_limit_mb`). */
export const DEFAULT_STORAGE_LIMIT_MB = 10240;

export function formatStorageGb(storageMb: number): string {
  const gb = storageMb / 1024;
  return Number.isInteger(gb) ? `${gb} GB` : `${gb.toFixed(1)} GB`;
}

export function formatActiveJobLimit(tier: BillingPlanTier): string {
  return tier === "professional" ? "Unlimited" : String(ESSENTIAL_ACTIVE_JOB_LIMIT);
}
