import { createClient } from "@/lib/supabase/server";
import { linkPartnerProfileIfNeeded } from "@/lib/partners/approve";
import type { PartnerLevel, PartnerStatus } from "@/lib/partners/constants";

export type PartnerRow = {
  id: string;
  profile_id: string | null;
  organization_name: string;
  contact_name: string;
  email: string;
  phone: string | null;
  website: string | null;
  partner_type: string;
  partner_level: PartnerLevel;
  status: PartnerStatus;
  referral_code: string;
  payment_email: string | null;
  created_at: string;
};

/**
 * Resolve the approved active partner for the current session (by email or profile).
 */
export async function getActivePartnerForCurrentUser(): Promise<{
  partner: PartnerRow;
  profileId: string | null;
  userEmail: string;
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  const email = user.email.trim().toLowerCase();

  if (profile?.id) {
    const { data: byProfile } = await supabase
      .from("partners")
      .select(
        "id, profile_id, organization_name, contact_name, email, phone, website, partner_type, partner_level, status, referral_code, payment_email, created_at"
      )
      .eq("status", "active")
      .eq("profile_id", profile.id)
      .maybeSingle();
    if (byProfile) {
      return {
        partner: byProfile as PartnerRow,
        profileId: profile.id,
        userEmail: email,
      };
    }
  }

  const { data: byEmail } = await supabase
    .from("partners")
    .select(
      "id, profile_id, organization_name, contact_name, email, phone, website, partner_type, partner_level, status, referral_code, payment_email, created_at"
    )
    .eq("status", "active")
    .ilike("email", email)
    .maybeSingle();

  if (!byEmail) return null;

  if (profile?.id && !byEmail.profile_id) {
    await linkPartnerProfileIfNeeded(supabase, byEmail.id, profile.id);
  }

  return {
    partner: byEmail as PartnerRow,
    profileId: profile?.id ?? null,
    userEmail: email,
  };
}
