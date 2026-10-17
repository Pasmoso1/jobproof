"use server";

import { revalidatePath } from "next/cache";
import { requireAdminService } from "@/lib/admin-service";
import {
  ADMIN_AUDIT_ACTIONS,
  auditWarning,
  buildAuditIdempotencyKey,
  recordAdminAudit,
  type RecordAdminAuditResult,
} from "@/lib/admin-audit-log";
import { recordSingleReferralPayout } from "@/lib/partners/single-referral-payout";
import {
  createRecoveryEmailSender,
  deliverPartnerPasswordReset,
  findAuthUserByEmail,
} from "@/lib/admin/partner-password-reset";
import {
  countFoundingPartners,
  createPartnerFromApplication,
} from "@/lib/partners/approve";
import {
  buildPartnerReferralUrl,
  FOUNDING_PARTNER_LIMIT,
  isCanonicalPartnerType,
  isOrganizationPartnerType,
  type PartnerLevel,
  type PartnerTypeValue,
} from "@/lib/partners/constants";
import {
  sendPartnerApprovedEmail,
  sendPartnerDeclinedEmail,
  sendPartnerReferralLifecycleEmail,
} from "@/lib/partners/emails";
import { PRODUCT_ANALYTICS_EVENTS, trackProductEventSafe } from "@/lib/product-analytics";
import { resolveAppUrl } from "@/lib/stripe";

export async function adminSetApplicationUnderReview(applicationId: string) {
  const ctx = await requireAdminService();
  if (!ctx.ok) return ctx;

  const { data: app } = await ctx.admin
    .from("partner_applications")
    .select("id, status")
    .eq("id", applicationId)
    .maybeSingle();
  if (!app) return { ok: false as const, error: "Application not found" };
  if (app.status !== "submitted") {
    return {
      ok: false as const,
      error: "Only submitted applications can be marked under review.",
    };
  }

  const { error } = await ctx.admin
    .from("partner_applications")
    .update({ status: "under_review" })
    .eq("id", applicationId)
    .eq("status", "submitted");
  if (error) {
    return { ok: false as const, error: error.message };
  }
  await recordAdminAudit(ctx.admin, {
    adminEmail: ctx.email,
    action: ADMIN_AUDIT_ACTIONS.partnerApplicationUnderReview,
    targetType: "partner_application",
    targetId: applicationId,
    metadata: { from_status: "submitted", to_status: "under_review" },
    idempotencyKey: buildAuditIdempotencyKey(
      ADMIN_AUDIT_ACTIONS.partnerApplicationUnderReview,
      applicationId
    ),
  });
  revalidatePath("/admin/partners");
  return { ok: true as const, status: "under_review" as const };
}

export async function adminApprovePartnerApplication(
  applicationId: string,
  levelOverride?: PartnerLevel | null
) {
  const ctx = await requireAdminService();
  if (!ctx.ok) return ctx;

  const { data: app } = await ctx.admin
    .from("partner_applications")
    .select("*")
    .eq("id", applicationId)
    .maybeSingle();
  if (!app) return { ok: false as const, error: "Application not found" };
  if (app.status === "approved") return { ok: false as const, error: "Already approved" };
  if (app.status === "declined") return { ok: false as const, error: "Already declined" };
  if (!["submitted", "under_review"].includes(app.status)) {
    return { ok: false as const, error: "This application cannot be approved." };
  }
  if (isOrganizationPartnerType(app.partner_type) && levelOverride) {
    return {
      ok: false as const,
      error: "Organization applications are approved as Organization Partners, not Founding or Standard.",
    };
  }
  if (!app.agreement_version || !app.agreement_accepted_at) {
    return {
      ok: false as const,
      error:
        "Cannot approve: this application has no recorded Partner Program Agreement acceptance.",
    };
  }

  try {
    const created = await createPartnerFromApplication(
      ctx.admin,
      {
        id: app.id,
        organization_name: app.organization_name,
        contact_name: app.contact_name,
        email: app.email,
        phone: app.phone,
        website: app.website,
        partner_type: app.partner_type,
        agreement_version: app.agreement_version,
        agreement_accepted_at: app.agreement_accepted_at,
        username: app.username,
        normalized_username: app.normalized_username,
        auth_user_id: app.auth_user_id,
      },
      {
        levelOverride: levelOverride || undefined,
        reviewedBy: ctx.email,
      }
    );

    // Record the approval as soon as the partner exists, before the (fallible) email send.
    await recordAdminAudit(ctx.admin, {
      adminEmail: ctx.email,
      action: ADMIN_AUDIT_ACTIONS.partnerApplicationApproved,
      targetType: "partner_application",
      targetId: applicationId,
      metadata: {
        partner_id: created.partnerId,
        partner_level: created.level,
        partner_type: app.partner_type,
        level_overridden: Boolean(levelOverride),
      },
      idempotencyKey: buildAuditIdempotencyKey(
        ADMIN_AUDIT_ACTIONS.partnerApplicationApproved,
        applicationId
      ),
    });

    const referralUrl = buildPartnerReferralUrl(resolveAppUrl(), created.referralCode);
    await sendPartnerApprovedEmail({
      to: app.email,
      contactName: app.contact_name,
      organizationName: app.organization_name,
      level: created.level,
      partnerType: app.partner_type,
      referralCode: created.referralCode,
      referralUrl,
      username: app.username,
      legacyAccountSetupRequired: created.legacyAccountSetupRequired,
    });

    trackProductEventSafe({
      profileId: null,
      eventName: PRODUCT_ANALYTICS_EVENTS.partner_application_approved,
      source: "admin_partners",
      metadata: {
        partner_id: created.partnerId,
        partner_level: created.level,
      },
    });
    if (!isOrganizationPartnerType(app.partner_type)) {
      trackProductEventSafe({
        profileId: null,
        eventName:
          created.level === "founding"
            ? PRODUCT_ANALYTICS_EVENTS.founding_partner_approved
            : PRODUCT_ANALYTICS_EVENTS.standard_partner_approved,
        source: "admin_partners",
        metadata: { partner_id: created.partnerId },
      });
    }

    revalidatePath("/admin/partners");
    return { ok: true as const, partnerId: created.partnerId };
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : "Approve failed",
    };
  }
}

export async function adminDeclinePartnerApplication(
  applicationId: string,
  declineReason?: string | null
) {
  const ctx = await requireAdminService();
  if (!ctx.ok) return ctx;

  const { data: app } = await ctx.admin
    .from("partner_applications")
    .select("id, email, contact_name, status")
    .eq("id", applicationId)
    .maybeSingle();
  if (!app) return { ok: false as const, error: "Not found" };
  if (app.status === "approved") {
    return { ok: false as const, error: "Approved applications cannot be declined." };
  }
  if (app.status === "declined") {
    return { ok: false as const, error: "Application is already declined." };
  }
  if (!["submitted", "under_review"].includes(app.status)) {
    return { ok: false as const, error: "This application cannot be declined." };
  }

  const reason = String(declineReason ?? "").trim();
  if (!reason) {
    return { ok: false as const, error: "Enter a decline reason for internal records." };
  }

  const reviewedAt = new Date().toISOString();
  const { error: declineError } = await ctx.admin
    .from("partner_applications")
    .update({
      status: "declined",
      decline_reason: reason,
      reviewed_at: reviewedAt,
      reviewed_by: ctx.email,
    })
    .eq("id", applicationId)
    .in("status", ["submitted", "under_review"]);
  if (declineError) {
    return { ok: false as const, error: declineError.message };
  }

  await recordAdminAudit(ctx.admin, {
    adminEmail: ctx.email,
    action: ADMIN_AUDIT_ACTIONS.partnerApplicationDeclined,
    targetType: "partner_application",
    targetId: applicationId,
    metadata: { from_status: String(app.status), to_status: "declined" },
    idempotencyKey: buildAuditIdempotencyKey(
      ADMIN_AUDIT_ACTIONS.partnerApplicationDeclined,
      applicationId
    ),
  });

  await sendPartnerDeclinedEmail({
    to: app.email,
    contactName: app.contact_name,
  });

  trackProductEventSafe({
    profileId: null,
    eventName: PRODUCT_ANALYTICS_EVENTS.partner_application_declined,
    source: "admin_partners",
    metadata: { application_id: applicationId },
  });

  revalidatePath("/admin/partners");
  return {
    ok: true as const,
    status: "declined" as const,
    decline_reason: reason,
    reviewed_at: reviewedAt,
    reviewed_by: ctx.email,
  };
}

/** Shared suspend/reactivate: audits only when the status actually changed (retry-safe). */
async function setPartnerStatus(
  ctx: Extract<Awaited<ReturnType<typeof requireAdminService>>, { ok: true }>,
  partnerId: string,
  nextStatus: "suspended" | "active"
) {
  const { data: existing } = await ctx.admin
    .from("partners")
    .select("id, status")
    .eq("id", partnerId)
    .maybeSingle();
  if (!existing) return { ok: false as const, error: "Partner not found" };

  const { error } = await ctx.admin
    .from("partners")
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq("id", partnerId);
  if (error) return { ok: false as const, error: error.message };

  if (existing.status !== nextStatus) {
    await recordAdminAudit(ctx.admin, {
      adminEmail: ctx.email,
      action:
        nextStatus === "suspended"
          ? ADMIN_AUDIT_ACTIONS.partnerSuspended
          : ADMIN_AUDIT_ACTIONS.partnerReactivated,
      targetType: "partner",
      targetId: partnerId,
      metadata: { from_status: String(existing.status ?? ""), to_status: nextStatus },
    });
  }
  revalidatePath("/admin/partners");
  return { ok: true as const };
}

export async function adminSuspendPartner(partnerId: string) {
  const ctx = await requireAdminService();
  if (!ctx.ok) return ctx;
  return setPartnerStatus(ctx, partnerId, "suspended");
}

export async function adminReactivatePartner(partnerId: string) {
  const ctx = await requireAdminService();
  if (!ctx.ok) return ctx;
  return setPartnerStatus(ctx, partnerId, "active");
}

export async function adminChangePartnerType(
  partnerId: string,
  partnerType: PartnerTypeValue | string
) {
  const ctx = await requireAdminService();
  if (!ctx.ok) return ctx;
  if (!isCanonicalPartnerType(partnerType)) {
    return { ok: false as const, error: "Select Creator, Marketing, or Organization." };
  }
  const { data: existingType } = await ctx.admin
    .from("partners")
    .select("id, partner_type")
    .eq("id", partnerId)
    .maybeSingle();
  if (!existingType) return { ok: false as const, error: "Partner not found" };

  const { error: typeError } = await ctx.admin
    .from("partners")
    .update({ partner_type: partnerType, updated_at: new Date().toISOString() })
    .eq("id", partnerId);
  if (typeError) return { ok: false as const, error: typeError.message };

  if (existingType.partner_type !== partnerType) {
    await recordAdminAudit(ctx.admin, {
      adminEmail: ctx.email,
      action: ADMIN_AUDIT_ACTIONS.partnerTypeChanged,
      targetType: "partner",
      targetId: partnerId,
      metadata: {
        from_type: String(existingType.partner_type ?? ""),
        to_type: partnerType,
      },
    });
  }
  revalidatePath("/admin/partners");
  return { ok: true as const };
}

export async function adminChangePartnerLevel(partnerId: string, level: PartnerLevel) {
  const ctx = await requireAdminService();
  if (!ctx.ok) return ctx;
  const { data: existing } = await ctx.admin
    .from("partners")
    .select("partner_level, partner_type")
    .eq("id", partnerId)
    .maybeSingle();
  if (!existing) return { ok: false as const, error: "Partner not found" };
  if (isOrganizationPartnerType(existing?.partner_type)) {
    return {
      ok: false as const,
      error: "Organization Partners do not use Founding or Standard levels.",
    };
  }
  if (level === "founding") {
    if (existing?.partner_level !== "founding") {
      const foundingCount = await countFoundingPartners(ctx.admin);
      if (foundingCount >= FOUNDING_PARTNER_LIMIT) {
        return {
          ok: false as const,
          error: "All Founding Partner positions have been filled.",
        };
      }
    }
  }
  const { error: levelError } = await ctx.admin
    .from("partners")
    .update({ partner_level: level, updated_at: new Date().toISOString() })
    .eq("id", partnerId);
  if (levelError) return { ok: false as const, error: levelError.message };

  if (existing?.partner_level !== level) {
    await recordAdminAudit(ctx.admin, {
      adminEmail: ctx.email,
      action: ADMIN_AUDIT_ACTIONS.partnerLevelChanged,
      targetType: "partner",
      targetId: partnerId,
      metadata: {
        from_level: String(existing?.partner_level ?? ""),
        to_level: level,
      },
    });
  }
  revalidatePath("/admin/partners");
  return { ok: true as const };
}

export async function adminAdjustReferralReward(referralId: string, amountCad: number) {
  const ctx = await requireAdminService();
  if (!ctx.ok) return ctx;
  if (!Number.isFinite(amountCad) || amountCad < 0) {
    return { ok: false as const, error: "Invalid amount" };
  }
  const { data: existingReward } = await ctx.admin
    .from("partner_referrals")
    .select("id, reward_amount, reward_status")
    .eq("id", referralId)
    .maybeSingle();
  if (!existingReward) return { ok: false as const, error: "Referral not found" };

  const { error: adjustError } = await ctx.admin
    .from("partner_referrals")
    .update({ reward_amount: amountCad, updated_at: new Date().toISOString() })
    .eq("id", referralId);
  if (adjustError) return { ok: false as const, error: adjustError.message };

  let adjustAudit: RecordAdminAuditResult | null = null;
  if (Number(existingReward.reward_amount) !== amountCad) {
    adjustAudit = await recordAdminAudit(ctx.admin, {
      adminEmail: ctx.email,
      action: ADMIN_AUDIT_ACTIONS.referralRewardAdjusted,
      targetType: "partner_referral",
      targetId: referralId,
      metadata: {
        from_amount_cad: Number(existingReward.reward_amount),
        to_amount_cad: amountCad,
        reward_status: String(existingReward.reward_status ?? ""),
      },
    });
  }
  revalidatePath("/admin/partners");
  return { ok: true as const, ...auditWarning(adjustAudit) };
}

export async function adminApproveReferralReward(referralId: string) {
  const ctx = await requireAdminService();
  if (!ctx.ok) return ctx;

  const { data: row } = await ctx.admin
    .from("partner_referrals")
    .select(
      "id, reward_status, reward_amount, contractor_business_name, partners(contact_name, email)"
    )
    .eq("id", referralId)
    .maybeSingle();
  if (!row) return { ok: false as const, error: "Not found" };
  if (row.reward_status !== "qualified" && row.reward_status !== "pending") {
    return { ok: false as const, error: "Reward must be pending or qualified" };
  }

  const { error: approveError } = await ctx.admin
    .from("partner_referrals")
    .update({ reward_status: "approved", updated_at: new Date().toISOString() })
    .eq("id", referralId)
    .in("reward_status", ["pending", "qualified"]);
  if (approveError) return { ok: false as const, error: approveError.message };

  const approveAudit = await recordAdminAudit(ctx.admin, {
    adminEmail: ctx.email,
    action: ADMIN_AUDIT_ACTIONS.referralRewardApproved,
    targetType: "partner_referral",
    targetId: referralId,
    metadata: {
      from_status: String(row.reward_status),
      to_status: "approved",
      amount_cad: Number(row.reward_amount),
    },
    idempotencyKey: buildAuditIdempotencyKey(
      ADMIN_AUDIT_ACTIONS.referralRewardApproved,
      referralId
    ),
  });

  const partners = row.partners as
    | { contact_name?: string; email?: string }
    | { contact_name?: string; email?: string }[]
    | null;
  const p = Array.isArray(partners) ? partners[0] : partners;
  if (p?.email) {
    void sendPartnerReferralLifecycleEmail({
      to: p.email,
      contactName: p.contact_name ?? "Partner",
      kind: "reward_approved",
      businessName: row.contractor_business_name,
      amountCad: Number(row.reward_amount),
    });
  }

  revalidatePath("/admin/partners");
  return { ok: true as const, ...auditWarning(approveAudit) };
}

export async function adminMarkReferralPaid(
  referralId: string,
  input: { paymentMethod?: string; paymentReference?: string; notes?: string }
) {
  const ctx = await requireAdminService();
  if (!ctx.ok) return ctx;

  // Idempotent, conditionally-linked, self-compensating (see single-referral-payout.ts).
  const paid = await recordSingleReferralPayout(ctx.admin, {
    referralId,
    paymentMethod: input.paymentMethod,
    paymentReference: input.paymentReference,
    notes: input.notes,
    createdBy: ctx.email,
  });
  if (!paid.ok) return { ok: false as const, error: paid.error };

  const audit = await recordAdminAudit(ctx.admin, {
    adminEmail: ctx.email,
    action: ADMIN_AUDIT_ACTIONS.referralMarkedPaid,
    targetType: "partner_referral",
    targetId: referralId,
    metadata: {
      payout_id: paid.payoutId,
      partner_id: paid.partnerId,
      amount_cad: paid.amount,
      has_payment_reference: Boolean(input.paymentReference?.trim()),
      resumed_after_interruption: paid.resumed,
    },
    idempotencyKey: buildAuditIdempotencyKey(
      ADMIN_AUDIT_ACTIONS.referralMarkedPaid,
      referralId
    ),
  });

  trackProductEventSafe({
    profileId: paid.contractorProfileId,
    eventName: PRODUCT_ANALYTICS_EVENTS.partner_reward_paid,
    source: "admin_partners",
    metadata: { partner_id: paid.partnerId, amount: paid.amount },
  });

  if (paid.partner?.email) {
    void sendPartnerReferralLifecycleEmail({
      to: paid.partner.email,
      contactName: paid.partner.contact_name ?? "Partner",
      kind: "reward_paid",
      businessName: paid.contractorBusinessName,
      amountCad: paid.amount,
      paymentDate: paid.paidAt,
      paymentReference: input.paymentReference?.trim() || null,
    });
  }

  revalidatePath("/admin/partners");
  return { ok: true as const, ...auditWarning(audit) };
}
export async function adminResendPartnerVerificationEmail(applicationId: string) {
  const ctx = await requireAdminService();
  if (!ctx.ok) return ctx;

  const { data: app } = await ctx.admin
    .from("partner_applications")
    .select("id, email, auth_user_id")
    .eq("id", applicationId)
    .maybeSingle();
  if (!app) return { ok: false as const, error: "Application not found" };
  if (!app.auth_user_id) {
    return {
      ok: false as const,
      error: "No Auth account is linked to this application.",
    };
  }

  const redirectTo = `${resolveAppUrl()}/auth/callback?next=${encodeURIComponent("/partner/status")}`;
  const { error } = await ctx.admin.auth.resend({
    type: "signup",
    email: String(app.email).trim().toLowerCase(),
    options: { emailRedirectTo: redirectTo },
  });
  if (error) {
    return {
      ok: false as const,
      error:
        error.message ||
        "Could not resend verification. Ask the applicant to use Resend on the login page.",
    };
  }

  await recordAdminAudit(ctx.admin, {
    adminEmail: ctx.email,
    action: ADMIN_AUDIT_ACTIONS.partnerVerificationEmailResent,
    targetType: "partner_application",
    targetId: applicationId,
  });

  revalidatePath("/admin/partners");
  return { ok: true as const };
}

/**
 * Sends the partner a real password-reset email through Supabase Auth.
 *
 * History: this used `auth.admin.generateLink({ type: "recovery" })`, which only RETURNS a
 * link and sends nothing; the link was discarded and the action still reported success.
 * Now delivery goes through `resetPasswordForEmail` (see `partner-password-reset.ts`), the
 * same mechanism as the public "Forgot password" page, and success is reported only when
 * that request succeeds. No recovery token or reset URL is ever read, logged or returned.
 */
export async function adminSendPartnerPasswordResetEmail(applicationId: string) {
  const ctx = await requireAdminService();
  if (!ctx.ok) return ctx;

  const { data: app } = await ctx.admin
    .from("partner_applications")
    .select("id, email, auth_user_id")
    .eq("id", applicationId)
    .maybeSingle();
  if (!app) return { ok: false as const, error: "Application not found" };

  // Resolve the Auth account first so we never claim an email was sent to an address
  // that has no account behind it (Supabase answers 200 for unknown emails).
  let authEmail: string | null = null;
  if (app.auth_user_id) {
    const { data, error } = await ctx.admin.auth.admin.getUserById(String(app.auth_user_id));
    authEmail = !error && data?.user?.email ? data.user.email : null;
  } else {
    const found = await findAuthUserByEmail(
      (page, perPage) => ctx.admin.auth.admin.listUsers({ page, perPage }),
      String(app.email)
    );
    authEmail = found?.email ?? null;
  }
  if (!authEmail) {
    return {
      ok: false as const,
      error:
        "No sign-in account exists for this partner yet, so there is no password to reset. Ask them to sign up or finish account setup first.",
    };
  }

  const send = createRecoveryEmailSender();
  if (!send) {
    return {
      ok: false as const,
      error: "Email delivery is not configured on this deployment, so no email was sent.",
    };
  }

  const result = await deliverPartnerPasswordReset({
    email: authEmail,
    appUrl: resolveAppUrl(),
    send,
  });
  if (!result.ok) {
    console.error("[admin-partners] password reset delivery failed", { applicationId });
    return { ok: false as const, error: result.error };
  }

  await recordAdminAudit(ctx.admin, {
    adminEmail: ctx.email,
    action: ADMIN_AUDIT_ACTIONS.partnerPasswordResetEmailSent,
    targetType: "partner_application",
    targetId: applicationId,
  });

  revalidatePath("/admin/partners");
  return { ok: true as const };
}