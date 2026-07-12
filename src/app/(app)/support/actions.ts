"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { PRODUCT_ANALYTICS_EVENTS, trackProductEventSafe } from "@/lib/product-analytics";
import { SUPPORT_APP_VERSION } from "@/lib/support/types";
import {
  adminUserUrl,
  featureRequestCategoryLabel,
  formatOpsDateTime,
  sendOpsNotification,
  supportTicketCategoryLabel,
} from "@/lib/support/ops-notifications";

export type SupportTicketCategory =
  | "general_question"
  | "need_help"
  | "bug_report"
  | "feature_suggestion"
  | "billing";

export type FeatureRequestCategory =
  | "quoting"
  | "customers"
  | "billing"
  | "mobile"
  | "integrations"
  | "reporting"
  | "other";

export type SupportFormResult =
  | { success: true }
  | { success: false; error: string };

function trimRequired(value: FormDataEntryValue | null, label: string): string | SupportFormResult {
  const s = String(value ?? "").trim();
  if (!s) return { success: false, error: `${label} is required.` };
  return s;
}

async function markEmailNotificationSent(
  table: "support_tickets" | "feature_requests",
  id: string
): Promise<void> {
  const admin = createServiceRoleClient();
  if (!admin) {
    console.error(
      `[markEmailNotificationSent] SUPABASE_SERVICE_ROLE_KEY missing — cannot set email_notification_sent_at on ${table} ${id}`
    );
    return;
  }
  const { error } = await admin
    .from(table)
    .update({ email_notification_sent_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    console.error(`[markEmailNotificationSent] ${table}`, error.message);
  }
}

export async function submitSupportTicket(formData: FormData): Promise<SupportFormResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Please sign in to contact support." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, business_name, contractor_name")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile) return { success: false, error: "Profile not found." };

  const name = trimRequired(formData.get("name"), "Name");
  if (typeof name !== "string") return name;
  const email = trimRequired(formData.get("email"), "Email");
  if (typeof email !== "string") return email;
  const subject = trimRequired(formData.get("subject"), "Subject");
  if (typeof subject !== "string") return subject;
  const message = trimRequired(formData.get("message"), "Message");
  if (typeof message !== "string") return message;
  const category = String(formData.get("category") ?? "").trim() as SupportTicketCategory;
  const allowed: SupportTicketCategory[] = [
    "general_question",
    "need_help",
    "bug_report",
    "feature_suggestion",
    "billing",
  ];
  if (!allowed.includes(category)) {
    return { success: false, error: "Please choose a category." };
  }

  const submittedAt = new Date().toISOString();
  const metadata = {
    current_page: String(formData.get("current_page") ?? "").trim() || null,
    browser: String(formData.get("browser") ?? "").trim() || null,
    operating_system: String(formData.get("operating_system") ?? "").trim() || null,
    screen_size: String(formData.get("screen_size") ?? "").trim() || null,
    user_agent: String(formData.get("user_agent") ?? "").trim() || null,
    profile_id: String(profile.id),
    user_id: user.id,
    app_version: SUPPORT_APP_VERSION,
    submitted_at: submittedAt,
  };

  const { data: ticket, error } = await supabase
    .from("support_tickets")
    .insert({
      profile_id: profile.id,
      name,
      email,
      subject,
      category,
      message,
      metadata,
      status: "open",
    })
    .select("id")
    .single();

  if (error || !ticket) {
    console.error("[submitSupportTicket]", error?.message);
    return { success: false, error: "Could not send your message. Please try again." };
  }

  trackProductEventSafe({
    profileId: String(profile.id),
    eventName: PRODUCT_ANALYTICS_EVENTS.support_ticket_created,
    source: "support_contact",
    metadata: {
      ticket_id: ticket.id,
      category,
    },
  });

  const businessName = String(profile.business_name ?? "").trim() || "—";
  const notify = await sendOpsNotification({
    kind: "support_ticket",
    subject: "New JobProof Support Request",
    replyTo: email,
    fields: [
      { label: "Contractor name", value: name },
      { label: "Business name", value: businessName },
      { label: "Email", value: email },
      { label: "Category", value: supportTicketCategoryLabel(category) },
      { label: "Subject", value: subject },
      { label: "Date/time", value: formatOpsDateTime(submittedAt) },
      { label: "User ID", value: user.id },
      { label: "Profile ID", value: String(profile.id) },
      { label: "Current page", value: metadata.current_page ?? "—" },
      { label: "Browser", value: metadata.browser ?? "—" },
      { label: "Operating system", value: metadata.operating_system ?? "—" },
      { label: "Screen size", value: metadata.screen_size ?? "—" },
      { label: "App version", value: SUPPORT_APP_VERSION },
      { label: "Admin", value: adminUserUrl(String(profile.id)) },
    ],
    messageLabel: "Message",
    messageBody: message,
  });

  if (notify.ok) {
    await markEmailNotificationSent("support_tickets", ticket.id);
    trackProductEventSafe({
      profileId: String(profile.id),
      eventName: PRODUCT_ANALYTICS_EVENTS.support_ticket_email_sent,
      source: "support_contact",
      metadata: { ticket_id: ticket.id },
    });
  } else {
    trackProductEventSafe({
      profileId: String(profile.id),
      eventName: PRODUCT_ANALYTICS_EVENTS.support_ticket_email_failed,
      source: "support_contact",
      metadata: {
        ticket_id: ticket.id,
        error: notify.error.slice(0, 200),
        skipped: notify.skipped === true,
      },
    });
  }

  return { success: true };
}

export async function submitFeatureRequest(formData: FormData): Promise<SupportFormResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Please sign in to submit a feature request." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, business_name, contractor_name, business_contact_email")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile) return { success: false, error: "Profile not found." };

  const title = trimRequired(formData.get("title"), "Title");
  if (typeof title !== "string") return title;
  const description = trimRequired(formData.get("description"), "Description");
  if (typeof description !== "string") return description;
  const category = String(formData.get("category") ?? "").trim() as FeatureRequestCategory;
  const allowed: FeatureRequestCategory[] = [
    "quoting",
    "customers",
    "billing",
    "mobile",
    "integrations",
    "reporting",
    "other",
  ];
  if (!allowed.includes(category)) {
    return { success: false, error: "Please choose a category." };
  }

  const { data: request, error } = await supabase
    .from("feature_requests")
    .insert({
      profile_id: profile.id,
      title,
      description,
      category,
      status: "submitted",
      vote_count: 0,
    })
    .select("id")
    .single();

  if (error || !request) {
    console.error("[submitFeatureRequest]", error?.message);
    return { success: false, error: "Could not save your request. Please try again." };
  }

  trackProductEventSafe({
    profileId: String(profile.id),
    eventName: PRODUCT_ANALYTICS_EVENTS.feature_request_created,
    source: "support_feature_requests",
    metadata: {
      feature_request_id: request.id,
      category,
    },
  });

  const contractorName =
    String(profile.contractor_name ?? "").trim() ||
    String(profile.business_name ?? "").trim() ||
    "—";
  const businessName = String(profile.business_name ?? "").trim() || "—";
  const replyEmail =
    String(profile.business_contact_email ?? "").trim() || String(user.email ?? "").trim();
  const submittedAt = new Date().toISOString();

  if (!replyEmail) {
    console.error(
      "[submitFeatureRequest] No contractor email for Reply-To — notification skipped; request saved"
    );
    trackProductEventSafe({
      profileId: String(profile.id),
      eventName: PRODUCT_ANALYTICS_EVENTS.feature_request_email_failed,
      source: "support_feature_requests",
      metadata: {
        feature_request_id: request.id,
        error: "Missing contractor email for Reply-To",
        skipped: true,
      },
    });
    return { success: true };
  }

  const notify = await sendOpsNotification({
    kind: "feature_request",
    subject: "New JobProof Feature Request",
    replyTo: replyEmail,
    fields: [
      { label: "Contractor name", value: contractorName },
      { label: "Business name", value: businessName },
      { label: "Email", value: replyEmail },
      { label: "Feature title", value: title },
      { label: "Category", value: featureRequestCategoryLabel(category) },
      { label: "Date/time", value: formatOpsDateTime(submittedAt) },
      { label: "User ID", value: user.id },
      { label: "Profile ID", value: String(profile.id) },
      { label: "Admin", value: adminUserUrl(String(profile.id)) },
    ],
    messageLabel: "Description",
    messageBody: description,
  });

  if (notify.ok) {
    await markEmailNotificationSent("feature_requests", request.id);
    trackProductEventSafe({
      profileId: String(profile.id),
      eventName: PRODUCT_ANALYTICS_EVENTS.feature_request_email_sent,
      source: "support_feature_requests",
      metadata: { feature_request_id: request.id },
    });
  } else {
    trackProductEventSafe({
      profileId: String(profile.id),
      eventName: PRODUCT_ANALYTICS_EVENTS.feature_request_email_failed,
      source: "support_feature_requests",
      metadata: {
        feature_request_id: request.id,
        error: notify.error.slice(0, 200),
        skipped: notify.skipped === true,
      },
    });
  }

  return { success: true };
}
