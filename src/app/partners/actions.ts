"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendOpsNotification } from "@/lib/support/ops-notifications";
import { sendPartnerApplicationReceivedEmail } from "@/lib/partners/emails";
import {
  PARTNER_AGREEMENT_VERSION,
  PARTNER_TYPES,
} from "@/lib/partners/constants";
import { PRODUCT_ANALYTICS_EVENTS, trackProductEventSafe } from "@/lib/product-analytics";
import { validateCanadianPhone } from "@/lib/canada/phone";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function trackPartnerPublicEvent(
  event:
    | "founding_partner_section_viewed"
    | "partner_agreement_viewed"
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

export type PartnerApplyResult =
  | { success: true }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

export async function submitPartnerApplication(
  formData: FormData
): Promise<PartnerApplyResult> {
  const organizationName = String(formData.get("organization_name") ?? "").trim();
  const contactName = String(formData.get("contact_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const website = String(formData.get("website") ?? "").trim();
  const partnerType = String(formData.get("partner_type") ?? "").trim();
  const estimatedAudience = String(formData.get("estimated_audience") ?? "").trim();
  const promotionPlan = String(formData.get("promotion_plan") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  const agreementAccepted = formData.get("agreement_accepted") === "on";

  const fieldErrors: Record<string, string> = {};
  if (!organizationName) fieldErrors.organization_name = "Organization name is required.";
  if (!contactName) fieldErrors.contact_name = "Contact name is required.";
  if (!email || !EMAIL_RE.test(email)) fieldErrors.email = "Enter a valid email address.";
  if (phone) {
    const phoneErr = validateCanadianPhone(phone, { required: false, label: "phone number" });
    if (phoneErr) fieldErrors.phone = phoneErr;
  }
  if (!PARTNER_TYPES.some((t) => t.value === partnerType)) {
    fieldErrors.partner_type = "Select a partner type.";
  }
  if (!promotionPlan) fieldErrors.promotion_plan = "Tell us how you plan to promote JobProof.";
  if (!reason) fieldErrors.reason = "Tell us why you’d like to become a partner.";
  if (!agreementAccepted) {
    fieldErrors.agreement_accepted =
      "You must read and accept the Partner Program Agreement.";
  }
  if (Object.keys(fieldErrors).length) {
    return { success: false, error: "Please fix the highlighted fields.", fieldErrors };
  }

  const supabase = await createClient();
  const agreementAcceptedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("partner_applications")
    .insert({
      organization_name: organizationName,
      contact_name: contactName,
      email,
      phone: phone || null,
      website: website || null,
      partner_type: partnerType,
      estimated_audience: estimatedAudience || null,
      promotion_plan: promotionPlan,
      reason,
      status: "submitted",
      agreement_version: PARTNER_AGREEMENT_VERSION,
      agreement_accepted_at: agreementAcceptedAt,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[partners] application insert failed", error.message);
    return {
      success: false,
      error: "Could not submit your application. Please try again or contact us.",
    };
  }

  trackProductEventSafe({
    profileId: null,
    eventName: PRODUCT_ANALYTICS_EVENTS.partner_application_submitted,
    source: "partners_apply",
    metadata: { partner_type: partnerType, application_id: data?.id ?? null },
  });
  trackProductEventSafe({
    profileId: null,
    eventName: PRODUCT_ANALYTICS_EVENTS.partner_agreement_accepted,
    source: "partners_apply",
    metadata: {
      agreement_version: PARTNER_AGREEMENT_VERSION,
      application_id: data?.id ?? null,
    },
  });

  const confirm = await sendPartnerApplicationReceivedEmail({
    to: email,
    contactName,
  });
  if (confirm.ok && data?.id) {
    const admin = createServiceRoleClient();
    if (admin) {
      await admin
        .from("partner_applications")
        .update({ applicant_confirmation_sent_at: new Date().toISOString() })
        .eq("id", data.id);
    }
  }

  const ops = await sendOpsNotification({
    kind: "partner_portal_application",
    subject: `Partner application: ${organizationName}`,
    replyTo: email,
    fields: [
      { label: "Organization", value: organizationName },
      { label: "Contact", value: contactName },
      { label: "Email", value: email },
      { label: "Phone", value: phone || "—" },
      { label: "Website", value: website || "—" },
      { label: "Partner type", value: partnerType },
      { label: "Estimated audience", value: estimatedAudience || "—" },
      { label: "Application ID", value: String(data?.id ?? "") },
      { label: "Agreement version", value: PARTNER_AGREEMENT_VERSION },
      { label: "Agreement accepted", value: agreementAcceptedAt },
    ],
    messageLabel: "Promotion plan / reason",
    messageBody: `Promotion plan:\n${promotionPlan}\n\nWhy partner:\n${reason}`,
  });
  if (ops.ok && data?.id) {
    const admin = createServiceRoleClient();
    if (admin) {
      await admin
        .from("partner_applications")
        .update({ email_notification_sent_at: new Date().toISOString() })
        .eq("id", data.id);
    }
  }

  return { success: true };
}
