import type { BillingPlanTier } from "@/lib/stripe";
import {
  formatActiveJobLimit as formatActiveJobEntitlement,
  formatStorageAllowance,
  formatTradeLimit,
  getPlanEntitlements,
  PLAN_ENTITLEMENTS,
  type PlanEntitlements,
} from "@/lib/plan-entitlements";

/** @deprecated Prefer getPlanEntitlements / PLAN_ENTITLEMENTS */
export const ESSENTIAL_ACTIVE_JOB_LIMIT = PLAN_ENTITLEMENTS.essential.maxActiveJobs!;

/** @deprecated Prefer PLAN_ENTITLEMENTS.essential.storageBytes */
export const SOLO_STORAGE_LIMIT_MB = Math.round(
  PLAN_ENTITLEMENTS.essential.storageBytes / (1024 * 1024)
);

/** @deprecated Prefer PLAN_ENTITLEMENTS.professional.storageBytes */
export const PRO_STORAGE_LIMIT_MB = Math.round(
  PLAN_ENTITLEMENTS.professional.storageBytes / (1024 * 1024)
);

/** @deprecated Prefer SOLO_STORAGE_LIMIT_MB / PLAN_ENTITLEMENTS */
export const DEFAULT_STORAGE_LIMIT_MB = SOLO_STORAGE_LIMIT_MB;

export function formatStorageGb(storageMb: number): string {
  const gb = storageMb / 1024;
  return Number.isInteger(gb) ? `${gb} GB` : `${gb.toFixed(1)} GB`;
}

export function formatActiveJobLimit(tier: BillingPlanTier): string {
  return formatActiveJobEntitlement(getPlanEntitlements(tier));
}

export function formatPlanStorage(tier: BillingPlanTier): string {
  return formatStorageAllowance(getPlanEntitlements(tier));
}

export function formatPlanTrades(tier: BillingPlanTier): string {
  return formatTradeLimit(getPlanEntitlements(tier));
}

export function getMarketingEntitlements(tier: BillingPlanTier): PlanEntitlements {
  return getPlanEntitlements(tier);
}
