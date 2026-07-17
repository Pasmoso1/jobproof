import type { SupabaseClient } from "@supabase/supabase-js";
import { PRODUCT_ANALYTICS_EVENTS, trackProductEventSafe } from "@/lib/product-analytics";
import { PARTNER_QUALIFICATION_DAYS } from "@/lib/partners/constants";
import { sendPartnerReferralLifecycleEmail } from "@/lib/partners/emails";

const PAID_STATUSES = new Set(["active", "past_due"]);

/**
 * Promote pending referrals to qualified when the contractor has been a paying
 * subscriber for PARTNER_QUALIFICATION_DAYS and still has an active-like status.
 * Does not auto-pay — admin must approve and mark paid.
 */
export async function qualifyEligiblePartnerReferrals(
  admin: SupabaseClient,
  now: Date = new Date()
): Promise<{ inspected: number; qualified: number }> {
  const cutoff = new Date(
    now.getTime() - PARTNER_QUALIFICATION_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: rows, error } = await admin
    .from("partner_referrals")
    .select(
      `
      id,
      partner_id,
      contractor_profile_id,
      contractor_business_name,
      subscription_started_at,
      reward_amount,
      reward_status,
      partners ( contact_name, email ),
      profiles:contractor_profile_id ( subscription_status, business_name )
    `
    )
    .eq("reward_status", "pending")
    .not("subscription_started_at", "is", null)
    .lte("subscription_started_at", cutoff)
    .limit(200);

  if (error) {
    console.error("[partners] qualify query failed", error.message);
    return { inspected: 0, qualified: 0 };
  }

  let qualified = 0;
  for (const row of rows ?? []) {
    const profile = row.profiles as
      | { subscription_status?: string | null; business_name?: string | null }
      | { subscription_status?: string | null; business_name?: string | null }[]
      | null;
    const p = Array.isArray(profile) ? profile[0] : profile;
    const status = String(p?.subscription_status ?? "").toLowerCase();
    if (!PAID_STATUSES.has(status)) continue;

    const { error: updErr } = await admin
      .from("partner_referrals")
      .update({
        reward_status: "qualified",
        qualification_date: now.toISOString(),
        contractor_business_name:
          row.contractor_business_name || p?.business_name || null,
        updated_at: now.toISOString(),
      })
      .eq("id", row.id)
      .eq("reward_status", "pending");

    if (updErr) {
      console.error("[partners] qualify update failed", updErr.message);
      continue;
    }
    qualified += 1;

    trackProductEventSafe({
      profileId: String(row.contractor_profile_id),
      eventName: PRODUCT_ANALYTICS_EVENTS.partner_reward_qualified,
      source: "partner_qualification_cron",
      metadata: { partner_id: String(row.partner_id) },
    });

    const partners = row.partners as
      | { contact_name?: string; email?: string }
      | { contact_name?: string; email?: string }[]
      | null;
    const partner = Array.isArray(partners) ? partners[0] : partners;
    if (partner?.email) {
      void sendPartnerReferralLifecycleEmail({
        to: partner.email,
        contactName: partner.contact_name ?? "Partner",
        kind: "qualified",
        businessName: row.contractor_business_name || p?.business_name,
        amountCad: Number(row.reward_amount),
      });
    }
  }

  return { inspected: rows?.length ?? 0, qualified };
}
