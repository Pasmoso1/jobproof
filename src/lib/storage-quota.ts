import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getPlanEntitlements,
  STORAGE_LIMIT_REACHED_MESSAGE,
  type PlanEntitlementProfile,
  type PlanEntitlements,
} from "@/lib/plan-entitlements";

export type StorageQuotaCheck =
  | {
      ok: true;
      usedBytes: number;
      limitBytes: number;
      remainingBytes: number;
      entitlements: PlanEntitlements;
    }
  | {
      ok: false;
      error: string;
      usedBytes: number;
      limitBytes: number;
      entitlements: PlanEntitlements;
    };

async function readStorageUsedBytes(
  supabase: SupabaseClient,
  profileId: string
): Promise<number> {
  const { data } = await supabase
    .from("storage_usage")
    .select("total_bytes")
    .eq("profile_id", profileId)
    .maybeSingle();
  const used = Number(data?.total_bytes ?? 0);
  return Number.isFinite(used) && used > 0 ? used : 0;
}

/**
 * Server-side storage quota check before authorizing or confirming an upload.
 */
export async function assertStorageQuotaAvailable(
  supabase: SupabaseClient,
  profileId: string,
  profile: PlanEntitlementProfile,
  additionalBytes: number
): Promise<StorageQuotaCheck> {
  const entitlements = getPlanEntitlements(profile);
  const limitBytes = entitlements.storageBytes;
  const usedBytes = await readStorageUsedBytes(supabase, profileId);
  const add = Number.isFinite(additionalBytes) && additionalBytes > 0 ? additionalBytes : 0;
  const remainingBytes = Math.max(0, limitBytes - usedBytes);

  if (usedBytes + add > limitBytes) {
    return {
      ok: false,
      error: STORAGE_LIMIT_REACHED_MESSAGE(entitlements.label),
      usedBytes,
      limitBytes,
      entitlements,
    };
  }

  return {
    ok: true,
    usedBytes,
    limitBytes,
    remainingBytes,
    entitlements,
  };
}

/** Increment contractor storage ledger after a successful upload is confirmed. */
export async function incrementStorageUsage(
  supabase: SupabaseClient,
  profileId: string,
  bytes: number
): Promise<void> {
  const add = Number.isFinite(bytes) && bytes > 0 ? Math.floor(bytes) : 0;
  if (add <= 0) return;

  const { data: usage } = await supabase
    .from("storage_usage")
    .select("total_bytes")
    .eq("profile_id", profileId)
    .maybeSingle();

  const current = Number(usage?.total_bytes ?? 0);
  const next = (Number.isFinite(current) ? current : 0) + add;

  if (usage) {
    await supabase
      .from("storage_usage")
      .update({ total_bytes: next })
      .eq("profile_id", profileId);
  } else {
    await supabase.from("storage_usage").insert({
      profile_id: profileId,
      total_bytes: next,
    });
  }
}

/** Decrement contractor storage ledger after files are removed (never below zero). */
export async function decrementStorageUsage(
  supabase: SupabaseClient,
  profileId: string,
  bytes: number
): Promise<void> {
  const sub = Number.isFinite(bytes) && bytes > 0 ? Math.floor(bytes) : 0;
  if (sub <= 0) return;

  const { data: usage } = await supabase
    .from("storage_usage")
    .select("total_bytes")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (!usage) return;
  const current = Number(usage.total_bytes ?? 0);
  const next = Math.max(0, (Number.isFinite(current) ? current : 0) - sub);
  await supabase
    .from("storage_usage")
    .update({ total_bytes: next })
    .eq("profile_id", profileId);
}
