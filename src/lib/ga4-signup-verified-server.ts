import type { SupabaseClient } from "@supabase/supabase-js";
import {
  SIGNUP_VERIFIED_SENT_AT_COLUMN,
  isMissingSignupVerifiedSentAtColumnError,
  isRecentEmailConfirmation,
  type SignupVerifiedClaimResult,
} from "@/lib/ga4-signup-verified-marker";

type ConfirmedUser = {
  id: string;
  email_confirmed_at?: string | null;
};

/**
 * True when the user confirmed their email recently but signup_verified has not been
 * recorded for the account. Read-only; tolerates migration 070 not being applied.
 */
export async function isSignupVerifiedAnalyticsPending(
  supabase: SupabaseClient,
  user: ConfirmedUser,
  nowMs: number = Date.now()
): Promise<boolean> {
  if (!isRecentEmailConfirmation(user.email_confirmed_at, nowMs)) return false;
  const { data, error } = await supabase
    .from("profiles")
    .select(SIGNUP_VERIFIED_SENT_AT_COLUMN)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !data) return false;
  return (data as Record<string, unknown>)[SIGNUP_VERIFIED_SENT_AT_COLUMN] == null;
}

/**
 * Atomically records that signup_verified is being sent for this account.
 * Only the caller that flips the column from null gets "claimed".
 */
export async function claimSignupVerifiedAnalytics(
  supabase: SupabaseClient,
  user: ConfirmedUser | null,
  nowMs: number = Date.now()
): Promise<SignupVerifiedClaimResult> {
  if (!user || !isRecentEmailConfirmation(user.email_confirmed_at, nowMs)) {
    return "not_eligible";
  }
  const { data, error } = await supabase
    .from("profiles")
    .update({ [SIGNUP_VERIFIED_SENT_AT_COLUMN]: new Date(nowMs).toISOString() })
    .eq("user_id", user.id)
    .is(SIGNUP_VERIFIED_SENT_AT_COLUMN, null)
    .select("id");
  if (error) {
    // Before migration 070 the session once-key is the only dedupe, as previously.
    if (isMissingSignupVerifiedSentAtColumnError(error)) return "claimed";
    console.error("[ga4] signup_verified claim failed", error.code ?? "unknown");
    return "retry";
  }
  return (data?.length ?? 0) > 0 ? "claimed" : "already_recorded";
}
