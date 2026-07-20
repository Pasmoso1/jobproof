"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendOpsNotification } from "@/lib/support/ops-notifications";
import { sendPartnerApplicationReceivedEmail } from "@/lib/partners/emails";
import { PARTNER_AGREEMENT_VERSION } from "@/lib/partners/constants";
import { PRODUCT_ANALYTICS_EVENTS, trackProductEventSafe } from "@/lib/product-analytics";
import { submitPartnerApplicationCore } from "@/lib/partners/submit-application";
import type { PartnerApplyResult } from "@/lib/partners/submit-application";

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

export async function submitPartnerApplication(
  formData: FormData
): Promise<PartnerApplyResult> {
  const supabase = await createClient();
  const admin = createServiceRoleClient();

  const result = await submitPartnerApplicationCore({
    formData,
    insertClient: {
      from: (table) => ({
        insert: (row) =>
          // Intentionally no .select() — anon has INSERT but not SELECT under RLS.
          supabase.from(table).insert(row) as PromiseLike<{
            error: {
              code?: string;
              message?: string;
              details?: string;
              hint?: string;
            } | null;
          }>,
      }),
    },
    findOpenApplicationIdByEmail: admin
      ? async (email) => {
          const { data, error } = await admin
            .from("partner_applications")
            .select("id")
            .eq("email", email)
            .in("status", ["submitted", "under_review"])
            .limit(1);
          if (error) {
            console.error("[partners] open-application lookup failed", {
              code: error.code ?? null,
              message: error.message ?? null,
              details: error.details ?? null,
              hint: error.hint ?? null,
            });
            return null;
          }
          return data?.[0]?.id ? String(data[0].id) : null;
        }
      : undefined,
  });

  if (!result.success) return result;

  const applicationId = result.applicationId;
  const organizationName = String(formData.get("organization_name") ?? "").trim();
  const contactName = String(formData.get("contact_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const website = String(formData.get("website") ?? "").trim();
  const partnerType = String(formData.get("partner_type") ?? "").trim();
  const estimatedAudience = String(formData.get("estimated_audience") ?? "").trim();
  const promotionPlan = String(formData.get("promotion_plan") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();

  trackProductEventSafe({
    profileId: null,
    eventName: PRODUCT_ANALYTICS_EVENTS.partner_application_submitted,
    source: "partners_apply",
    metadata: { partner_type: partnerType, application_id: applicationId },
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
  });
  if (confirm.ok && admin) {
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
      { label: "Phone", value: phone || "—" },
      { label: "Website", value: website || "—" },
      { label: "Partner type", value: partnerType },
      { label: "Estimated audience", value: estimatedAudience || "—" },
      { label: "Application ID", value: applicationId },
      { label: "Agreement version", value: PARTNER_AGREEMENT_VERSION },
    ],
    messageLabel: "Promotion plan / reason",
    messageBody: `Promotion plan:\n${promotionPlan}\n\nWhy partner:\n${reason}`,
  });
  if (ops.ok && admin) {
    await admin
      .from("partner_applications")
      .update({ email_notification_sent_at: new Date().toISOString() })
      .eq("id", applicationId);
  }

  return { success: true, applicationId };
}
