"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { validateQuoteRequestSettings } from "@/lib/validation/quote-request-settings";
import {
  countTotalTrades,
  getPlanEntitlements,
} from "@/lib/plan-entitlements";

export type QuoteRequestSettingsResult =
  | { success: true }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

export async function updateQuoteRequestSettings(
  formData: FormData
): Promise<QuoteRequestSettingsResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/settings/quote-requests");

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, quote_slug, quote_primary_trade, quote_additional_trades, plan_tier, beta_tester, beta_plan_tier"
    )
    .eq("user_id", user.id)
    .single();

  if (!profile?.id) {
    return { success: false, error: "Profile not found." };
  }

  const entitlements = getPlanEntitlements(profile);
  const previousTotalTrades = countTotalTrades(
    profile.quote_primary_trade,
    Array.isArray(profile.quote_additional_trades)
      ? profile.quote_additional_trades.map(String)
      : []
  );

  const validation = validateQuoteRequestSettings({
    quoteSlug: String(formData.get("quoteSlug") ?? ""),
    businessName: String(formData.get("businessName") ?? ""),
    businessPhone: String(formData.get("businessPhone") ?? ""),
    logoUrl: String(formData.get("logoUrl") ?? ""),
    pricingProfile: String(formData.get("pricingProfile") ?? ""),
    primaryTrade: String(formData.get("primaryTrade") ?? ""),
    primaryTradeOther: String(formData.get("primaryTradeOther") ?? ""),
    additionalTrades: formData.getAll("additionalTrades").map(String),
    contractorExtraCapabilities: String(formData.get("contractor_extra_capabilities") ?? ""),
    maxTotalTrades: entitlements.maxTotalTrades,
    previousTotalTrades,
  });

  if (!validation.ok) {
    const firstError = Object.values(validation.fieldErrors)[0] ?? "Please fix the errors below.";
    return { success: false, error: firstError, fieldErrors: validation.fieldErrors };
  }

  const { quoteSlug, businessName, businessPhone, logoUrl, pricingProfile, primaryTrade, primaryTradeOther, additionalTrades, contractorExtraCapabilities } =
    validation.data;

  if (profile.quote_slug && profile.quote_slug.toLowerCase() !== quoteSlug) {
    const { data: taken } = await supabase
      .from("profiles")
      .select("id")
      .ilike("quote_slug", quoteSlug)
      .neq("id", profile.id)
      .maybeSingle();

    if (taken?.id) {
      return {
        success: false,
        error: "This quote page URL is already taken. Choose a different one.",
        fieldErrors: { quoteSlug: "This URL is already in use." },
      };
    }
  } else if (!profile.quote_slug) {
    const { data: taken } = await supabase
      .from("profiles")
      .select("id")
      .ilike("quote_slug", quoteSlug)
      .neq("id", profile.id)
      .maybeSingle();

    if (taken?.id) {
      return {
        success: false,
        error: "This quote page URL is already taken. Choose a different one.",
        fieldErrors: { quoteSlug: "This URL is already in use." },
      };
    }
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      quote_slug: quoteSlug,
      business_name: businessName,
      phone: businessPhone,
      quote_logo_url: logoUrl,
      quote_pricing_profile: pricingProfile,
      quote_primary_trade: primaryTrade,
      quote_primary_trade_other: primaryTradeOther,
      quote_additional_trades: additionalTrades,
      contractor_extra_capabilities: contractorExtraCapabilities,
    })
    .eq("id", profile.id)
    .eq("user_id", user.id);

  if (error) {
    console.error("[updateQuoteRequestSettings] failed", error);
    if (error.code === "23505") {
      return {
        success: false,
        error: "This quote page URL is already taken.",
        fieldErrors: { quoteSlug: "This URL is already in use." },
      };
    }
    return { success: false, error: "Could not save settings. Please try again." };
  }

  revalidatePath("/settings/quote-requests");
  revalidatePath(`/quote/${quoteSlug}`);
  return { success: true };
}
