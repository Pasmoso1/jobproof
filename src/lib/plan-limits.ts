import type { BillingPlanTier } from "@/lib/stripe";

/** Active job limits enforced via `profiles.active_job_limit`. */
export const ESSENTIAL_ACTIVE_JOB_LIMIT = 10;

/** Solo / Essential storage limit in MB (`profiles.storage_limit_mb` default). */
export const SOLO_STORAGE_LIMIT_MB = 10240;

/** Pro storage allotment shown in marketing (100 GB). */
export const PRO_STORAGE_LIMIT_MB = 102400;

/** @deprecated Prefer SOLO_STORAGE_LIMIT_MB */
export const DEFAULT_STORAGE_LIMIT_MB = SOLO_STORAGE_LIMIT_MB;

export function formatStorageGb(storageMb: number): string {
  const gb = storageMb / 1024;
  return Number.isInteger(gb) ? `${gb} GB` : `${gb.toFixed(1)} GB`;
}

export function formatActiveJobLimit(tier: BillingPlanTier): string {
  return tier === "professional" ? "Unlimited" : String(ESSENTIAL_ACTIVE_JOB_LIMIT);
}

export function formatPlanStorage(tier: BillingPlanTier): string {
  return formatStorageGb(
    tier === "professional" ? PRO_STORAGE_LIMIT_MB : SOLO_STORAGE_LIMIT_MB
  );
}
