import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
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
  username?: string | null;
  auth_user_id?: string | null;
};

export type PartnerAccountStatusView =
  | {
      kind: "active";
      partner: PartnerRow;
      emailVerified: boolean;
    }
  | {
      kind: "partner_inactive";
      partner: PartnerRow;
      status: PartnerStatus;
      emailVerified: boolean;
    }
  | {
      kind: "application";
      status: "submitted" | "under_review" | "declined" | "approved";
      organizationName: string;
      username: string | null;
      emailVerified: boolean;
      /** Approved application awaiting partner row (should be rare). */
      approvedWithoutPartner?: boolean;
    }
  | {
      kind: "none";
      emailVerified: boolean;
    };

const PARTNER_SELECT =
  "id, profile_id, organization_name, contact_name, email, phone, website, partner_type, partner_level, status, referral_code, payment_email, created_at, username, auth_user_id";

function isEmailVerified(user: {
  email_confirmed_at?: string | null;
  confirmed_at?: string | null;
}): boolean {
  return Boolean(user.email_confirmed_at || user.confirmed_at);
}

/**
 * Resolve the approved active partner for the current session.
 * Prefers auth_user_id; falls back to profile_id / email for legacy rows.
 * Requires a verified email for portal access.
 */
export async function getActivePartnerForCurrentUser(): Promise<{
  partner: PartnerRow;
  profileId: string | null;
  userEmail: string;
} | null> {
  const status = await getPartnerAccountStatusForCurrentUser();
  if (status.kind !== "active") return null;
  if (!status.emailVerified) return null;

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

  return {
    partner: status.partner,
    profileId: profile?.id ?? null,
    userEmail: user.email.trim().toLowerCase(),
  };
}

/**
 * Full account-state view for pending applicants and inactive partners.
 */
export async function getPartnerAccountStatusForCurrentUser(): Promise<PartnerAccountStatusView> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { kind: "none", emailVerified: false };
  }

  const emailVerified = isEmailVerified(user);
  const email = (user.email ?? "").trim().toLowerCase();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  // Prefer trusted auth_user_id match (service role when RLS would block pending apps).
  const admin = createServiceRoleClient();
  const lookup = admin ?? supabase;

  const { data: byAuth } = await lookup
    .from("partners")
    .select(PARTNER_SELECT)
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (byAuth) {
    if (profile?.id && !byAuth.profile_id) {
      await linkPartnerProfileIfNeeded(supabase, byAuth.id, profile.id);
    }
    if (byAuth.status === "active") {
      return {
        kind: "active",
        partner: byAuth as PartnerRow,
        emailVerified,
      };
    }
    return {
      kind: "partner_inactive",
      partner: byAuth as PartnerRow,
      status: byAuth.status as PartnerStatus,
      emailVerified,
    };
  }

  // Legacy: profile_id / email match when auth_user_id is not yet linked.
  if (profile?.id) {
    const { data: byProfile } = await lookup
      .from("partners")
      .select(PARTNER_SELECT)
      .eq("profile_id", profile.id)
      .maybeSingle();
    if (byProfile) {
      if (byProfile.status === "active") {
        return {
          kind: "active",
          partner: byProfile as PartnerRow,
          emailVerified,
        };
      }
      return {
        kind: "partner_inactive",
        partner: byProfile as PartnerRow,
        status: byProfile.status as PartnerStatus,
        emailVerified,
      };
    }
  }

  if (email) {
    const { data: byEmail } = await lookup
      .from("partners")
      .select(PARTNER_SELECT)
      .ilike("email", email)
      .is("auth_user_id", null)
      .maybeSingle();

    if (byEmail) {
      if (profile?.id && !byEmail.profile_id) {
        await linkPartnerProfileIfNeeded(supabase, byEmail.id, profile.id);
      }
      // Best-effort backfill auth_user_id for legacy partners after trusted email match.
      if (admin && !byEmail.auth_user_id) {
        await admin
          .from("partners")
          .update({
            auth_user_id: user.id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", byEmail.id)
          .is("auth_user_id", null);
      }
      if (byEmail.status === "active") {
        return {
          kind: "active",
          partner: { ...byEmail, auth_user_id: user.id } as PartnerRow,
          emailVerified,
        };
      }
      return {
        kind: "partner_inactive",
        partner: byEmail as PartnerRow,
        status: byEmail.status as PartnerStatus,
        emailVerified,
      };
    }
  }

  const { data: application } = await lookup
    .from("partner_applications")
    .select(
      "id, status, organization_name, username, email_confirmed_at, created_partner_id"
    )
    .eq("auth_user_id", user.id)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (application) {
    const appStatus = String(application.status);
    if (
      appStatus === "submitted" ||
      appStatus === "under_review" ||
      appStatus === "declined" ||
      appStatus === "approved"
    ) {
      return {
        kind: "application",
        status: appStatus,
        organizationName: String(application.organization_name ?? ""),
        username: application.username ? String(application.username) : null,
        emailVerified:
          emailVerified || Boolean(application.email_confirmed_at),
        approvedWithoutPartner:
          appStatus === "approved" && !application.created_partner_id,
      };
    }
  }

  return { kind: "none", emailVerified };
}
