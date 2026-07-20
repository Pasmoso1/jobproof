"use server";

import { revalidatePath } from "next/cache";
import { requireAdminUser } from "@/lib/admin-auth";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  countFoundingPartners,
  createPartnerFromApplication,
} from "@/lib/partners/approve";
import {
  buildPartnerReferralUrl,
  FOUNDING_PARTNER_LIMIT,
  type PartnerLevel,
} from "@/lib/partners/constants";
import {
  sendPartnerApprovedEmail,
  sendPartnerDeclinedEmail,
  sendPartnerReferralLifecycleEmail,
} from "@/lib/partners/emails";
import { PRODUCT_ANALYTICS_EVENTS, trackProductEventSafe } from "@/lib/product-analytics";
import { resolveAppUrl } from "@/lib/stripe";

async function requireAdminService() {
  const auth = await requireAdminUser();
  if (!auth.ok) return { ok: false as const, error: "Unauthorized" };
  const admin = createServiceRoleClient();
  if (!admin) return { ok: false as const, error: "Service role unavailable" };
  return { ok: true as const, admin, email: auth.userEmail };
}

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
      },
      {
        levelOverride: levelOverride || undefined,
        reviewedBy: ctx.email,
      }
    );

    const referralUrl = buildPartnerReferralUrl(resolveAppUrl(), created.referralCode);
    await sendPartnerApprovedEmail({
      to: app.email,
      contactName: app.contact_name,
      organizationName: app.organization_name,
      level: created.level,
      referralCode: created.referralCode,
      referralUrl,
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
    trackProductEventSafe({
      profileId: null,
      eventName:
        created.level === "founding"
          ? PRODUCT_ANALYTICS_EVENTS.founding_partner_approved
          : PRODUCT_ANALYTICS_EVENTS.standard_partner_approved,
      source: "admin_partners",
      metadata: { partner_id: created.partnerId },
    });

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
  await ctx.admin
    .from("partner_applications")
    .update({
      status: "declined",
      decline_reason: reason,
      reviewed_at: reviewedAt,
      reviewed_by: ctx.email,
    })
    .eq("id", applicationId);

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

export async function adminSuspendPartner(partnerId: string) {
  const ctx = await requireAdminService();
  if (!ctx.ok) return ctx;
  await ctx.admin
    .from("partners")
    .update({ status: "suspended", updated_at: new Date().toISOString() })
    .eq("id", partnerId);
  revalidatePath("/admin/partners");
  return { ok: true as const };
}

export async function adminReactivatePartner(partnerId: string) {
  const ctx = await requireAdminService();
  if (!ctx.ok) return ctx;
  await ctx.admin
    .from("partners")
    .update({ status: "active", updated_at: new Date().toISOString() })
    .eq("id", partnerId);
  revalidatePath("/admin/partners");
  return { ok: true as const };
}

export async function adminChangePartnerLevel(partnerId: string, level: PartnerLevel) {
  const ctx = await requireAdminService();
  if (!ctx.ok) return ctx;
  if (level === "founding") {
    const { data: existing } = await ctx.admin
      .from("partners")
      .select("partner_level")
      .eq("id", partnerId)
      .maybeSingle();
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
  await ctx.admin
    .from("partners")
    .update({ partner_level: level, updated_at: new Date().toISOString() })
    .eq("id", partnerId);
  revalidatePath("/admin/partners");
  return { ok: true as const };
}

export async function adminAdjustReferralReward(referralId: string, amountCad: number) {
  const ctx = await requireAdminService();
  if (!ctx.ok) return ctx;
  if (!Number.isFinite(amountCad) || amountCad < 0) {
    return { ok: false as const, error: "Invalid amount" };
  }
  await ctx.admin
    .from("partner_referrals")
    .update({ reward_amount: amountCad, updated_at: new Date().toISOString() })
    .eq("id", referralId);
  revalidatePath("/admin/partners");
  return { ok: true as const };
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

  await ctx.admin
    .from("partner_referrals")
    .update({ reward_status: "approved", updated_at: new Date().toISOString() })
    .eq("id", referralId);

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
  return { ok: true as const };
}

export async function adminMarkReferralPaid(
  referralId: string,
  input: { paymentMethod?: string; paymentReference?: string; notes?: string }
) {
  const ctx = await requireAdminService();
  if (!ctx.ok) return ctx;

  const { data: row } = await ctx.admin
    .from("partner_referrals")
    .select(
      "id, partner_id, reward_status, reward_amount, contractor_profile_id, contractor_business_name, partners(contact_name, email)"
    )
    .eq("id", referralId)
    .maybeSingle();
  if (!row) return { ok: false as const, error: "Not found" };
  if (row.reward_status === "paid") return { ok: false as const, error: "Already paid" };

  const amount = Number(row.reward_amount);
  const paidAt = new Date().toISOString();
  const { data: payout, error: payoutErr } = await ctx.admin
    .from("partner_payouts")
    .insert({
      partner_id: row.partner_id,
      amount,
      payment_method: input.paymentMethod?.trim() || "e-transfer",
      payment_reference: input.paymentReference?.trim() || null,
      notes: input.notes?.trim() || null,
      paid_at: paidAt,
    })
    .select("id")
    .single();

  if (payoutErr || !payout) {
    return { ok: false as const, error: payoutErr?.message ?? "Payout insert failed" };
  }

  await ctx.admin
    .from("partner_referrals")
    .update({
      reward_status: "paid",
      reward_paid_at: new Date().toISOString(),
      payout_id: payout.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", referralId);

  trackProductEventSafe({
    profileId: String(row.contractor_profile_id),
    eventName: PRODUCT_ANALYTICS_EVENTS.partner_reward_paid,
    source: "admin_partners",
    metadata: { partner_id: String(row.partner_id), amount },
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
      kind: "reward_paid",
      businessName: row.contractor_business_name,
      amountCad: amount,
      paymentDate: paidAt,
      paymentReference: input.paymentReference?.trim() || null,
    });
  }

  revalidatePath("/admin/partners");
  return { ok: true as const };
}
