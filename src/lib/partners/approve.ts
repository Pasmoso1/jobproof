import type { SupabaseClient } from "@supabase/supabase-js";
import {
  FOUNDING_PARTNER_LIMIT,
  type PartnerLevel,
} from "@/lib/partners/constants";
import { generatePartnerReferralCode } from "@/lib/partners/referral-code";

export async function countFoundingPartners(admin: SupabaseClient): Promise<number> {
  const { count, error } = await admin
    .from("partners")
    .select("id", { count: "exact", head: true })
    .eq("partner_level", "founding")
    .neq("status", "declined");
  if (error) {
    console.error("[partners] count founding failed", error.message);
    return FOUNDING_PARTNER_LIMIT;
  }
  return count ?? 0;
}

export async function nextPartnerLevel(admin: SupabaseClient): Promise<PartnerLevel> {
  const foundingCount = await countFoundingPartners(admin);
  return foundingCount < FOUNDING_PARTNER_LIMIT ? "founding" : "standard";
}

export async function createPartnerFromApplication(
  admin: SupabaseClient,
  application: {
    id: string;
    organization_name: string;
    contact_name: string;
    email: string;
    phone?: string | null;
    website?: string | null;
    partner_type: string;
    agreement_version?: string | null;
    agreement_accepted_at?: string | null;
    username?: string | null;
    normalized_username?: string | null;
    auth_user_id?: string | null;
  },
  options?: { levelOverride?: PartnerLevel; reviewedBy?: string }
): Promise<{
  partnerId: string;
  referralCode: string;
  level: PartnerLevel;
  legacyAccountSetupRequired: boolean;
}> {
  // Idempotent: if already approved with a partner row, return it.
  const { data: existingApp } = await admin
    .from("partner_applications")
    .select("status, created_partner_id")
    .eq("id", application.id)
    .maybeSingle();
  if (
    existingApp?.status === "approved" &&
    existingApp.created_partner_id
  ) {
    const { data: existingPartner } = await admin
      .from("partners")
      .select("id, referral_code, partner_level, auth_user_id, username")
      .eq("id", existingApp.created_partner_id)
      .maybeSingle();
    if (existingPartner) {
      return {
        partnerId: String(existingPartner.id),
        referralCode: String(existingPartner.referral_code),
        level:
          existingPartner.partner_level === "founding" ? "founding" : "standard",
        legacyAccountSetupRequired: !existingPartner.auth_user_id,
      };
    }
  }

  let level: PartnerLevel;
  if (options?.levelOverride === "founding") {
    const foundingCount = await countFoundingPartners(admin);
    if (foundingCount >= FOUNDING_PARTNER_LIMIT) {
      throw new Error("All Founding Partner positions have been filled.");
    }
    level = "founding";
  } else {
    level = options?.levelOverride ?? (await nextPartnerLevel(admin));
  }
  let referralCode = generatePartnerReferralCode();
  for (let i = 0; i < 5; i++) {
    const { data: clash } = await admin
      .from("partners")
      .select("id")
      .eq("referral_code", referralCode)
      .maybeSingle();
    if (!clash) break;
    referralCode = generatePartnerReferralCode();
  }

  const email = application.email.trim().toLowerCase();
  const authUserId = application.auth_user_id
    ? String(application.auth_user_id)
    : null;
  const username = application.username ? String(application.username) : null;
  const normalizedUsername = application.normalized_username
    ? String(application.normalized_username)
    : username
      ? username.trim().toLowerCase()
      : null;
  const legacyAccountSetupRequired = !authUserId || !username;

  const { data: partner, error } = await admin
    .from("partners")
    .insert({
      application_id: application.id,
      profile_id: null,
      organization_name: application.organization_name,
      contact_name: application.contact_name,
      email,
      phone: application.phone ?? null,
      website: application.website ?? null,
      partner_type: application.partner_type,
      partner_level: level,
      status: "active",
      referral_code: referralCode,
      payment_email: email,
      agreement_version: application.agreement_version ?? null,
      agreement_accepted_at: application.agreement_accepted_at ?? null,
      username,
      normalized_username: normalizedUsername,
      auth_user_id: authUserId,
    })
    .select("id, referral_code, partner_level")
    .single();

  if (error || !partner) {
    throw new Error(error?.message ?? "Could not create partner");
  }

  if (authUserId && normalizedUsername) {
    await admin
      .from("partner_username_registry")
      .upsert(
        {
          normalized_username: normalizedUsername,
          username: username ?? normalizedUsername,
          auth_user_id: authUserId,
          application_id: application.id,
          partner_id: partner.id,
        },
        { onConflict: "normalized_username" }
      );
  }

  await admin
    .from("partner_applications")
    .update({
      status: "approved",
      reviewed_at: new Date().toISOString(),
      reviewed_by: options?.reviewedBy ?? null,
      created_partner_id: partner.id,
    })
    .eq("id", application.id);

  return {
    partnerId: String(partner.id),
    referralCode: String(partner.referral_code),
    level: partner.partner_level === "founding" ? "founding" : "standard",
    legacyAccountSetupRequired,
  };
}

/** Link partner.profile_id when an approved partner signs in. */
export async function linkPartnerProfileIfNeeded(
  supabase: SupabaseClient,
  partnerId: string,
  profileId: string
): Promise<void> {
  await supabase
    .from("partners")
    .update({ profile_id: profileId, updated_at: new Date().toISOString() })
    .eq("id", partnerId)
    .is("profile_id", null);
}
