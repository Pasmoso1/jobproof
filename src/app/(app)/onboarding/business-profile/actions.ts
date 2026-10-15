"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { validateOnboardingBusinessName } from "@/lib/validation/business-profile";
import { validateContractorTradesFields } from "@/lib/validation/contractor-trades";
import { countTotalTrades, getPlanEntitlements } from "@/lib/plan-entitlements";
import { normalizeAdditionalTrades } from "@/lib/quote-requests/trade";
import { ensureQuoteSlugForProfile } from "@/lib/quote-requests/slug-allocation";
import { needsPlanSelection } from "@/lib/beta-tester";
import { maybeStartManagedTrial } from "@/lib/start-managed-trial";
import { markTrialStartedAnalyticsPending } from "@/lib/ga4-trial-started-server";
import { resolveTrialPlanTier } from "@/lib/trial-lifecycle";
import { resolveSafeLoginRedirect } from "@/lib/auth/safe-redirect";

export type CompleteOnboardingBusinessSetupResult =
  | { success: true; redirectTo: string; trialStarted: boolean }
  | { success: false; error?: string; fieldErrors?: Record<string, string> };

/**
 * Initial onboarding: saves business name + primary trade only (never touches phone, address
 * or other profile fields) and activates the managed trial when eligible.
 */
export async function completeOnboardingBusinessSetup(
  formData: FormData
): Promise<CompleteOnboardingBusinessSetupResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/onboarding/business-profile");

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, quote_slug, business_name, quote_primary_trade, quote_additional_trades, plan_tier, trial_plan_tier, beta_tester, beta_plan_tier, stripe_subscription_id, subscription_status, trial_started_at, trial_ends_at, trial_email_welcome_sent_at, trial_email_started_sent_at"
    )
    .eq("user_id", user.id)
    .single();

  if (!profile?.id) {
    return { success: false, error: "Could not load your account. Please try again." };
  }

  if (needsPlanSelection(profile)) {
    return { success: true, redirectTo: "/onboarding/plan", trialStarted: false };
  }

  const businessName = String(formData.get("business_name") ?? "").trim();
  const fieldErrors: Record<string, string> = {};
  const nameError = validateOnboardingBusinessName(businessName);
  if (nameError) fieldErrors.business_name = nameError;

  const primaryTradeInput = String(formData.get("primaryTrade") ?? "");
  const existingAdditional = normalizeAdditionalTrades(profile.quote_additional_trades);
  const tradesResult = validateContractorTradesFields({
    primaryTrade: primaryTradeInput,
    primaryTradeOther: String(formData.get("primaryTradeOther") ?? ""),
    additionalTrades: existingAdditional.filter((t) => t !== primaryTradeInput.trim()),
    primaryTradeRequired: true,
    maxTotalTrades: getPlanEntitlements(profile).maxTotalTrades,
    previousTotalTrades: countTotalTrades(profile.quote_primary_trade, existingAdditional),
  });
  if (!tradesResult.ok) {
    const { additionalTrades: additionalTradesError, ...tradeErrors } = tradesResult.fieldErrors;
    Object.assign(fieldErrors, tradeErrors);
    if (additionalTradesError && Object.keys(fieldErrors).length === 0) {
      return { success: false, error: additionalTradesError };
    }
  }

  if (Object.keys(fieldErrors).length > 0 || !tradesResult.ok) {
    return { success: false, fieldErrors };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      business_name: businessName,
      quote_primary_trade: tradesResult.data.primaryTrade,
      quote_primary_trade_other: tradesResult.data.primaryTradeOther,
      quote_additional_trades: tradesResult.data.additionalTrades,
      updated_at: new Date().toISOString(),
    })
    .eq("id", profile.id);

  if (error) {
    console.error("[completeOnboardingBusinessSetup] profile update", error.message);
    return { success: false, error: "Could not save your business details. Please try again." };
  }

  const nextProfile = {
    ...profile,
    business_name: businessName,
    quote_primary_trade: tradesResult.data.primaryTrade,
  };
  // No-op (returns false) once a trial or paid subscription exists — never restarts a trial.
  const trialStarted = await maybeStartManagedTrial(supabase, nextProfile, user.email ?? "");
  if (trialStarted) {
    await markTrialStartedAnalyticsPending(resolveTrialPlanTier(nextProfile));
  }

  if (!profile.quote_slug) {
    await ensureQuoteSlugForProfile(supabase, {
      profileId: String(profile.id),
      currentSlug: profile.quote_slug,
      businessName,
    });
  }

  revalidatePath("/", "layout");

  return {
    success: true,
    redirectTo: resolveOnboardingReturnPath(String(formData.get("redirect") ?? "")),
    trialStarted,
  };
}

function resolveOnboardingReturnPath(requested: string): string {
  const path = resolveSafeLoginRedirect(requested.trim() || null, "/dashboard");
  return path.startsWith("/onboarding") ? "/dashboard" : path;
}
