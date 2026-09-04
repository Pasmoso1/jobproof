"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendOpsNotification } from "@/lib/support/ops-notifications";
import { sendPartnerApplicationReceivedEmail } from "@/lib/partners/emails";
import { PARTNER_AGREEMENT_VERSION } from "@/lib/partners/constants";
import {
  PRODUCT_ANALYTICS_EVENTS,
  trackProductEventSafe,
} from "@/lib/product-analytics";
import {
  logPartnerApplyAuthDiagnostics,
  resolvePartnerApplyFlow,
  submitPartnerApplicationCore,
} from "@/lib/partners/submit-application";
import type { PartnerApplyResult } from "@/lib/partners/submit-application";
import {
  insertOrganizationPartnerProfile,
  prepareOrganizationApplicationFormData,
} from "@/lib/partners/submit-organization-application";
import { ORGANIZATION_PARTNER_TYPE } from "@/lib/partners/constants";
import {
  checkPartnerUsernameAvailability,
  claimPartnerUsername,
  createPartnerAuthUserViaSignUp,
  deletePartnerAuthUserIfOrphan,
  linkRegistryApplicationId,
  releasePartnerUsernameClaim,
} from "@/lib/partners/auth-account";
import { validatePartnerLoginIdentifier } from "@/lib/partners/username";
import { getPartnerAccountStatusForCurrentUser } from "@/lib/partners/session";
import { resolvePartnerEntryPath } from "@/lib/partners/login-href";
import type { EmailApplyBlocker } from "@/lib/partners/apply-existing-account";

export async function trackPartnerPublicEvent(
  event: "founding_partner_section_viewed" | "partner_agreement_viewed"
) {
  const allowed = new Set([
    PRODUCT_ANALYTICS_EVENTS.founding_partner_section_viewed,
    PRODUCT_ANALYTICS_EVENTS.partner_agreement_viewed,
  ]);
  if (!allowed.has(event)) return;
  trackProductEventSafe({
    profileId: null,
    eventName: event,
    source: "partners_public",
  });
}

/** Public availability check — returns only available/unavailable (+ coarse reason). */
export async function checkPartnerUsernameAvailableAction(
  username: string
): Promise<{ available: boolean; reason?: string }> {
  const result = await checkPartnerUsernameAvailability(username);
  return {
    available: result.available,
    reason:
      result.reason === "ok" || result.reason === "email"
        ? result.reason === "email"
          ? "email"
          : undefined
        : result.reason,
  };
}

/**
 * Trusted apply-page auth state from server getUser() (validates JWT).
 * Never trust client-only session caches for flow selection.
 *
 * When already signed in with an open application or active partner,
 * `redirectTo` points away from the apply form (declined may re-apply).
 */
export async function getPartnerApplySessionState(): Promise<{
  resolved: true;
  signedIn: boolean;
  email: string | null;
  userId: string | null;
  flow: "new_account" | "existing_account";
  redirectTo: string | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const authenticatedUser =
    user?.id && user.email
      ? {
          id: user.id,
          email: user.email.trim().toLowerCase(),
          emailConfirmedAt: user.email_confirmed_at ?? null,
        }
      : null;
  const flow = resolvePartnerApplyFlow(authenticatedUser);

  logPartnerApplyAuthDiagnostics({
    authState: authenticatedUser ? "signed_in" : "signed_out",
    userId: authenticatedUser?.id ?? null,
    flow,
  });

  let redirectTo: string | null = null;
  if (authenticatedUser) {
    const account = await getPartnerAccountStatusForCurrentUser();
    if (account.kind === "active") {
      redirectTo = resolvePartnerEntryPath({
        kind: "active",
        emailVerified: account.emailVerified,
      });
    } else if (account.kind === "partner_inactive") {
      redirectTo = resolvePartnerEntryPath({
        kind: "partner_inactive",
        emailVerified: account.emailVerified,
      });
    } else if (
      account.kind === "application" &&
      account.status !== "declined"
    ) {
      redirectTo = resolvePartnerEntryPath({
        kind: "application",
        emailVerified: account.emailVerified,
      });
    }
  }

  return {
    resolved: true,
    signedIn: Boolean(authenticatedUser),
    email: authenticatedUser?.email ?? null,
    userId: authenticatedUser?.id ?? null,
    flow,
    redirectTo,
  };
}

/** Sign out and return to the new-account apply flow. */
export async function signOutFromPartnerApply(): Promise<{ ok: true }> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  logPartnerApplyAuthDiagnostics({
    authState: "signed_out",
    userId: null,
    flow: "new_account",
  });
  return { ok: true };
}

export async function submitPartnerApplication(
  formData: FormData
): Promise<PartnerApplyResult> {
  const supabase = await createClient();
  const admin = createServiceRoleClient();
  if (!admin) {
    return {
      success: false,
      error:
        "Application service is temporarily unavailable. Please try again shortly.",
    };
  }

  // getUser() validates the JWT with Supabase Auth — do not use getSession() alone.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const authenticatedUser =
    user?.id && user.email
      ? {
          id: user.id,
          email: user.email.trim().toLowerCase(),
          emailConfirmedAt: user.email_confirmed_at ?? null,
        }
      : null;

  const result = await submitPartnerApplicationCore({
    formData,
    insertClient: {
      from: (table) => ({
        insert: (row) =>
          // Intentionally no .select() — application flow remains insert-only.
          admin.from(table).insert(row) as PromiseLike<{
            error: {
              code?: string;
              message?: string;
              details?: string;
              hint?: string;
            } | null;
          }>,
      }),
    },
    authenticatedUser,
    findEmailApplyBlocker: async (email): Promise<EmailApplyBlocker | null> => {
      const { data: openApps, error: openErr } = await admin
        .from("partner_applications")
        .select("id")
        .ilike("email", email)
        .in("status", ["submitted", "under_review"])
        .limit(1);
      if (openErr) {
        console.error("[partners] open-application lookup failed", {
          code: openErr.code ?? null,
          message: openErr.message ?? null,
        });
      } else if (openApps?.[0]?.id) {
        return { kind: "open_application" };
      }

      const { data: partner, error: partnerErr } = await admin
        .from("partners")
        .select("id, status")
        .ilike("email", email)
        .limit(1)
        .maybeSingle();
      if (partnerErr) {
        console.error("[partners] partner-email lookup failed", {
          code: partnerErr.code ?? null,
          message: partnerErr.message ?? null,
        });
      } else if (partner?.id && partner.status === "active") {
        return { kind: "active_partner" };
      }

      const { data: approvedApp, error: approvedErr } = await admin
        .from("partner_applications")
        .select("id")
        .ilike("email", email)
        .eq("status", "approved")
        .limit(1);
      if (approvedErr) {
        console.error("[partners] approved-application lookup failed", {
          code: approvedErr.code ?? null,
          message: approvedErr.message ?? null,
        });
      } else if (approvedApp?.[0]?.id) {
        return { kind: "active_partner" };
      }

      return null;
    },
    checkUsernameAvailable: async (normalized) => {
      const { data } = await admin
        .from("partner_username_registry")
        .select("normalized_username")
        .eq("normalized_username", normalized)
        .maybeSingle();
      return !data;
    },
    provisionAuthUser: async ({ email, password, username }) => {
      const created = await createPartnerAuthUserViaSignUp({
        authClient: supabase,
        email,
        password,
        username,
      });
      if (!created.ok) {
        return {
          ok: false as const,
          error: created.error,
          code: created.existingAccount
            ? ("existing_account" as const)
            : ("auth_failed" as const),
        };
      }
      return {
        ok: true as const,
        userId: created.userId,
        emailConfirmedAt: created.emailConfirmedAt,
        createdNewAuthUser: true,
      };
    },
    claimUsername: async ({ username, normalized, authUserId, applicationId }) =>
      claimPartnerUsername({
        admin,
        username,
        normalized,
        authUserId,
        applicationId,
      }),
    releaseUsernameClaim: async (normalized) => {
      await releasePartnerUsernameClaim(admin, normalized);
    },
    deleteOrphanAuthUser: async (userId) => {
      await deletePartnerAuthUserIfOrphan(admin, userId);
    },
    linkRegistryApplication: async (normalized, applicationId) => {
      await linkRegistryApplicationId(admin, normalized, applicationId);
    },
  });

  if (!result.success) return result;

  const applicationId = result.applicationId;
  const organizationName = String(formData.get("organization_name") ?? "").trim();
  const contactName = String(formData.get("contact_name") ?? "").trim();
  const email =
    authenticatedUser?.email ??
    String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const website = String(formData.get("website") ?? "").trim();
  const partnerType = String(formData.get("partner_type") ?? "").trim();
  const estimatedAudience = String(
    formData.get("estimated_audience") ?? ""
  ).trim();
  const promotionPlan = String(formData.get("promotion_plan") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  const usernameRaw = String(formData.get("username") ?? "").trim();
  const loginId = validatePartnerLoginIdentifier(usernameRaw, {
    applicationEmail: email,
  });
  const displayLogin =
    loginId.ok && loginId.kind === "username"
      ? loginId.username
      : loginId.ok && loginId.kind === "email"
        ? loginId.email
        : undefined;

  trackProductEventSafe({
    profileId: null,
    eventName: PRODUCT_ANALYTICS_EVENTS.partner_application_submitted,
    source: "partners_apply",
    metadata: {
      partner_type: partnerType,
      application_id: applicationId,
      has_username: Boolean(loginId.ok && loginId.kind === "username"),
      login_kind: loginId.ok ? loginId.kind : "unknown",
      apply_flow: result.flow,
    },
  });
  trackProductEventSafe({
    profileId: null,
    eventName: PRODUCT_ANALYTICS_EVENTS.partner_agreement_accepted,
    source: "partners_apply",
    metadata: {
      agreement_version: PARTNER_AGREEMENT_VERSION,
      application_id: applicationId,
    },
  });

  const confirm = await sendPartnerApplicationReceivedEmail({
    to: email,
    contactName,
    username: displayLogin,
  });
  if (confirm.ok) {
    await admin
      .from("partner_applications")
      .update({ applicant_confirmation_sent_at: new Date().toISOString() })
      .eq("id", applicationId);
  }

  const ops = await sendOpsNotification({
    kind: "partner_portal_application",
    subject: `Partner application: ${organizationName}`,
    replyTo: email,
    fields: [
      { label: "Organization", value: organizationName },
      { label: "Contact", value: contactName },
      { label: "Email", value: email },
      { label: "Login", value: displayLogin ?? "—" },
      { label: "Apply flow", value: result.flow },
      { label: "Phone", value: phone || "—" },
      { label: "Website", value: website || "—" },
      { label: "Partner type", value: partnerType },
      { label: "Estimated audience", value: estimatedAudience || "—" },
      { label: "Application ID", value: applicationId },
      { label: "Agreement version", value: PARTNER_AGREEMENT_VERSION },
      {
        label: "Auth account",
        value: result.emailVerificationSent
          ? "Created (email verification pending)"
          : result.flow === "existing_account"
            ? "Existing JobProof account linked"
            : "Linked",
      },
    ],
    messageLabel: "Promotion plan / reason",
    messageBody: `Promotion plan:\n${promotionPlan}\n\nWhy partner:\n${reason}`,
  });
  if (ops.ok) {
    await admin
      .from("partner_applications")
      .update({ email_notification_sent_at: new Date().toISOString() })
      .eq("id", applicationId);
  }

  return result;
}

/**
 * Association & Organization Partner application.
 * Reuses the same Auth + approval pipeline; forces partner_type = organization
 * and stores extended fields in organization_partner_profiles.
 */
export async function submitOrganizationApplication(
  formData: FormData
): Promise<PartnerApplyResult> {
  const prepared = prepareOrganizationApplicationFormData(formData);
  if (!prepared.ok) {
    return {
      success: false,
      error: prepared.error,
      fieldErrors: prepared.fieldErrors,
      code: "validation",
    };
  }

  const result = await submitPartnerApplication(prepared.formData);
  if (!result.success) return result;

  const admin = createServiceRoleClient();
  if (admin) {
    const profileResult = await insertOrganizationPartnerProfile(
      {
        from: (table) => ({
          insert: (row) =>
            admin.from(table).insert(row) as PromiseLike<{
              error: { message?: string } | null;
            }>,
        }),
      },
      { applicationId: result.applicationId, profile: prepared.profile }
    );
    if (profileResult.error) {
      console.error(
        "[partners] organization profile insert failed",
        profileResult.error
      );
    }

    await admin
      .from("partner_applications")
      .update({ partner_type: ORGANIZATION_PARTNER_TYPE })
      .eq("id", result.applicationId);
  }

  return result;
}
