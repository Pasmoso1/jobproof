"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { applyPartnerReferralAttributionForUser } from "@/lib/partners/apply-attribution";
import { PARTNER_REF_COOKIE_NAME } from "@/lib/partners/partner-ref-cookie";

/**
 * Apply Partner referral attribution for the currently signed-in user
 * (instant-session signup path that never hits /auth/callback).
 *
 * Safe for existing accounts: cookie attribution is blocked when the Auth
 * user is older than the anonymous 30-day window, and permanent first-touch
 * DB rules never overwrite an existing referral.
 */
export async function applyPartnerReferralAttributionFromSession(): Promise<{
  ok: true;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return { ok: true };

  const cookieStore = await cookies();
  await applyPartnerReferralAttributionForUser({
    userId: user.id,
    userEmail: user.email ?? null,
    userCreatedAt: user.created_at ?? null,
    partnerRefCookieValue: cookieStore.get(PARTNER_REF_COOKIE_NAME)?.value,
    source: "signup_instant_session",
  });
  return { ok: true };
}
