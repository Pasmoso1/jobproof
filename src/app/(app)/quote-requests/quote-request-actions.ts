"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  PRODUCT_ANALYTICS_EVENTS,
  trackProductEventSafe,
  type ProductAnalyticsEventName,
} from "@/lib/product-analytics";
import {
  QUOTE_REQUEST_STORAGE_BUCKET,
  type QuoteRequestStatus,
} from "@/lib/quote-requests/constants";
import { hoursSinceSubmission } from "@/lib/quote-requests/response-alerts";
import { sendQuoteRequestSiteVisitCustomerEmail } from "@/lib/quote-requests/notifications";
import { sendQuoteRequestSiteVisitCustomerSms } from "@/lib/quote-requests/sms-notifications";
import {
  DECLINE_EVENT_TYPES,
  DECLINE_REASON_LABELS,
  sendQuoteRequestDeclineCustomerEmail,
  sendQuoteRequestDeclineCustomerSms,
  type QuoteRequestDeclineReason,
} from "@/lib/quote-requests/decline-notifications";
import { isScopeFit } from "@/lib/quote-requests/scope-assessment";
import { mapChecklistRow, type QuoteChecklistItem } from "@/lib/quote-requests/quote-checklist/types";
import { loadSiteVisitNotesRecord } from "@/app/(app)/quote-requests/[requestId]/site-visit-notes-actions";
import { loadQuoteBuilderForRequest } from "@/app/(app)/quote-requests/[requestId]/builder-actions";
import type { QuoteBuilderDraft } from "@/lib/quote-requests/quote-builder/types";
import type {
  QuoteRequest,
  QuoteRequestAttachment,
  QuoteRequestEvent,
  QuoteRequestFollowUpAnswer,
} from "@/types/database";

export type QuoteRequestListRow = QuoteRequest;

export type QuoteRequestDetail = QuoteRequest & {
  attachments: Array<QuoteRequestAttachment & { signedUrl: string | null }>;
  followUpAnswers: QuoteRequestFollowUpAnswer[];
  events: QuoteRequestEvent[];
  checklistItems: QuoteChecklistItem[];
  siteVisitNotes: import("@/lib/quote-requests/site-visit-notes/types").SiteVisitNotesRecord;
  quoteBuilder: QuoteBuilderDraft;
};

async function requireProfileId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!profile?.id) throw new Error("Profile not found.");
  return String(profile.id);
}

export async function getQuoteRequestsList(): Promise<QuoteRequestListRow[]> {
  const profileId = await requireProfileId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("quote_requests")
    .select("*")
    .eq("contractor_id", profileId)
    .order("submitted_at", { ascending: false });

  if (error) {
    console.error("[getQuoteRequestsList]", error);
    return [];
  }
  return (data ?? []) as QuoteRequestListRow[];
}

export async function getQuoteRequestDetail(
  requestId: string
): Promise<QuoteRequestDetail | null> {
  const profileId = await requireProfileId();
  const supabase = await createClient();

  const { data: request, error } = await supabase
    .from("quote_requests")
    .select("*")
    .eq("id", requestId)
    .eq("contractor_id", profileId)
    .maybeSingle();

  if (error || !request) return null;

  const { data: attachments } = await supabase
    .from("quote_request_attachments")
    .select("*")
    .eq("quote_request_id", requestId)
    .order("created_at", { ascending: true });

  const withUrls = await Promise.all(
    (attachments ?? []).map(async (att) => {
      const { data: signed } = await supabase.storage
        .from(QUOTE_REQUEST_STORAGE_BUCKET)
        .createSignedUrl(att.file_path, 3600);
      return {
        ...(att as QuoteRequestAttachment),
        signedUrl: signed?.signedUrl ?? null,
      };
    })
  );

  const { data: followUpAnswers } = await supabase
    .from("quote_request_followup_answers")
    .select("*")
    .eq("quote_request_id", requestId)
    .order("display_order", { ascending: true });

  const { data: events } = await supabase
    .from("quote_request_events")
    .select("*")
    .eq("quote_request_id", requestId)
    .order("created_at", { ascending: false });

  const { data: checklistRows } = await supabase
    .from("quote_request_checklist_items")
    .select("*")
    .eq("quote_request_id", requestId)
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  const siteVisitNotes = await loadSiteVisitNotesRecord(supabase, requestId);
  const quoteBuilder = await loadQuoteBuilderForRequest(supabase, requestId);

  return {
    ...(request as QuoteRequest),
    attachments: withUrls,
    followUpAnswers: (followUpAnswers ?? []) as QuoteRequestFollowUpAnswer[],
    events: (events ?? []) as QuoteRequestEvent[],
    checklistItems: (checklistRows ?? []).map(mapChecklistRow),
    siteVisitNotes,
    quoteBuilder,
  };
}

export type UpdateQuoteRequestStatusResult =
  | { success: true }
  | { success: false; error: string };

export type MarkQuoteRequestSiteVisitResult =
  | {
      success: true;
      emailSent: boolean;
      smsSent: boolean;
      emailWarning?: string;
      smsWarning?: string;
    }
  | { success: false; error: string };

function revalidateQuoteRequestSurfaces(requestId: string) {
  revalidatePath("/dashboard");
  revalidatePath("/quote-requests");
  revalidatePath(`/quote-requests/${requestId}`);
}

async function updateQuoteRequestStatus(
  requestId: string,
  status: QuoteRequestStatus,
  analyticsEvent?: ProductAnalyticsEventName
): Promise<UpdateQuoteRequestStatusResult> {
  const profileId = await requireProfileId();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("quote_requests")
    .select("contractor_id, submitted_at, status")
    .eq("id", requestId)
    .eq("contractor_id", profileId)
    .maybeSingle();

  const { error } = await supabase
    .from("quote_requests")
    .update({ status })
    .eq("id", requestId)
    .eq("contractor_id", profileId);

  if (error) {
    console.error("[updateQuoteRequestStatus]", error);
    return { success: false, error: "Could not update this request." };
  }

  if (analyticsEvent && existing?.contractor_id && existing.submitted_at) {
    trackProductEventSafe({
      profileId: String(existing.contractor_id),
      eventName: analyticsEvent,
      route: `/quote-requests/${requestId}`,
      source: "quote_request_actions",
      metadata: {
        request_id: requestId,
        contractor_id: String(existing.contractor_id),
        hours_since_submission: Math.round(hoursSinceSubmission(String(existing.submitted_at)) * 10) / 10,
        previous_status: String(existing.status),
        new_status: status,
      },
    });
  }

  revalidateQuoteRequestSurfaces(requestId);
  return { success: true };
}

export async function markQuoteRequestReviewed(requestId: string) {
  return updateQuoteRequestStatus(
    requestId,
    "reviewed",
    PRODUCT_ANALYTICS_EVENTS.quote_request_reviewed
  );
}

export async function markQuoteRequestResponded(requestId: string) {
  return updateQuoteRequestStatus(
    requestId,
    "responded",
    PRODUCT_ANALYTICS_EVENTS.quote_request_responded
  );
}

export async function markQuoteRequestSiteVisit(
  requestId: string
): Promise<MarkQuoteRequestSiteVisitResult> {
  const profileId = await requireProfileId();
  const supabase = await createClient();

  const { data: request } = await supabase
    .from("quote_requests")
    .select(
      "id, contractor_id, customer_name, customer_email, customer_phone, property_address, project_type, submitted_at, status"
    )
    .eq("id", requestId)
    .eq("contractor_id", profileId)
    .maybeSingle();

  if (!request) {
    return { success: false, error: "Could not find this quote request." };
  }

  const { error } = await supabase
    .from("quote_requests")
    .update({ status: "site_visit_requested" })
    .eq("id", requestId)
    .eq("contractor_id", profileId);

  if (error) {
    console.error("[markQuoteRequestSiteVisit] update failed", error);
    return { success: false, error: "Could not update this request." };
  }

  if (request.submitted_at) {
    trackProductEventSafe({
      profileId: String(request.contractor_id),
      eventName: PRODUCT_ANALYTICS_EVENTS.quote_request_site_visit_requested,
      route: `/quote-requests/${requestId}`,
      source: "quote_request_actions",
      metadata: {
        request_id: requestId,
        contractor_id: String(request.contractor_id),
        hours_since_submission:
          Math.round(hoursSinceSubmission(String(request.submitted_at)) * 10) / 10,
        previous_status: String(request.status),
        new_status: "site_visit_requested",
      },
    });
  }

  revalidateQuoteRequestSurfaces(requestId);

  const customerEmailPresent = Boolean(String(request.customer_email ?? "").trim());
  const customerPhonePresent = Boolean(String(request.customer_phone ?? "").trim());

  const notificationPayload = {
    requestId,
    contractorId: String(request.contractor_id),
    customerName: String(request.customer_name),
    projectType: String(request.project_type),
  };

  const [emailResult, smsResult] = await Promise.all([
    sendQuoteRequestSiteVisitCustomerEmail({
      ...notificationPayload,
      customerEmail: String(request.customer_email ?? ""),
      propertyAddress: String(request.property_address),
    }),
    sendQuoteRequestSiteVisitCustomerSms({
      ...notificationPayload,
      customerPhone: String(request.customer_phone ?? ""),
    }),
  ]);

  const emailAnalyticsBase = {
    profileId: String(request.contractor_id),
    route: `/quote-requests/${requestId}`,
    source: "quote_request_site_visit_email",
    metadata: {
      request_id: requestId,
      contractor_id: String(request.contractor_id),
      customer_email_present: customerEmailPresent,
    },
  };

  if (emailResult.sent) {
    trackProductEventSafe({
      ...emailAnalyticsBase,
      eventName: PRODUCT_ANALYTICS_EVENTS.quote_request_site_visit_email_sent,
    });
  } else {
    trackProductEventSafe({
      ...emailAnalyticsBase,
      eventName: PRODUCT_ANALYTICS_EVENTS.quote_request_site_visit_email_failed,
      metadata: {
        ...emailAnalyticsBase.metadata,
        reason: emailResult.reason,
      },
    });
  }

  const smsAnalyticsBase = {
    profileId: String(request.contractor_id),
    route: `/quote-requests/${requestId}`,
    source: "quote_request_site_visit_sms",
    metadata: {
      request_id: requestId,
      contractor_id: String(request.contractor_id),
      customer_phone_present: customerPhonePresent,
    },
  };

  if (smsResult.sent) {
    trackProductEventSafe({
      ...smsAnalyticsBase,
      eventName: PRODUCT_ANALYTICS_EVENTS.quote_request_site_visit_sms_sent,
    });
  } else {
    trackProductEventSafe({
      ...smsAnalyticsBase,
      eventName: PRODUCT_ANALYTICS_EVENTS.quote_request_site_visit_sms_failed,
      metadata: {
        ...smsAnalyticsBase.metadata,
        reason: smsResult.reason,
      },
    });
  }

  const emailWarning = emailResult.sent
    ? undefined
    : emailResult.reason === "no_customer_email"
      ? "Customer email not sent (no email on file)."
      : "Customer email could not be sent.";

  const smsWarning = smsResult.sent
    ? undefined
    : smsResult.reason === "no_customer_phone"
      ? "Customer text not sent (no phone on file)."
      : smsResult.reason === "invalid_customer_phone"
        ? "Customer text not sent (invalid phone number)."
        : "Customer text could not be sent.";

  return {
    success: true,
    emailSent: emailResult.sent,
    smsSent: smsResult.sent,
    emailWarning,
    smsWarning,
  };
}

export async function closeQuoteRequest(requestId: string) {
  return updateQuoteRequestStatus(requestId, "closed");
}

export async function convertQuoteRequestPlaceholder(
  requestId: string
): Promise<UpdateQuoteRequestStatusResult> {
  const profileId = await requireProfileId();
  void profileId;
  void requestId;
  return {
    success: false,
    error: "Create customer record is coming soon. This will create a customer and job from the quote request.",
  };
}

const DECLINE_ANALYTICS: Record<QuoteRequestDeclineReason, ProductAnalyticsEventName> = {
  service_not_offered: PRODUCT_ANALYTICS_EVENTS.quote_request_declined_service_not_offered,
  capacity: PRODUCT_ANALYTICS_EVENTS.quote_request_declined_capacity,
  not_good_fit: PRODUCT_ANALYTICS_EVENTS.quote_request_declined_not_good_fit,
};

export type DeclineQuoteRequestResult =
  | {
      success: true;
      emailSent: boolean;
      smsSent: boolean;
      emailWarning?: string;
      smsWarning?: string;
    }
  | { success: false; error: string };

export async function declineQuoteRequest(
  requestId: string,
  reason: QuoteRequestDeclineReason
): Promise<DeclineQuoteRequestResult> {
  const profileId = await requireProfileId();
  const supabase = await createClient();

  const { data: request } = await supabase
    .from("quote_requests")
    .select(
      "id, contractor_id, customer_name, customer_email, customer_phone, project_type, status, submitted_at, ai_scope_fit, ai_customer_problem_label"
    )
    .eq("id", requestId)
    .eq("contractor_id", profileId)
    .maybeSingle();

  if (!request) {
    return { success: false, error: "Could not find this quote request." };
  }

  if (String(request.status) === "closed") {
    return { success: false, error: "This request is already closed." };
  }

  const scopeFitRaw = String(request.ai_scope_fit ?? "").trim();
  const scopeFit = isScopeFit(scopeFitRaw) ? scopeFitRaw : null;
  const isOutOfScope =
    scopeFit === "outside_scope" || scopeFit === "possibly_out_of_scope";

  if (reason === "service_not_offered" && !isOutOfScope) {
    return {
      success: false,
      error: "This action is only available for requests flagged as outside scope.",
    };
  }

  if (reason === "capacity" && isOutOfScope) {
    return {
      success: false,
      error: "This action is for in-scope requests when you are at capacity.",
    };
  }

  const { error: updateError } = await supabase
    .from("quote_requests")
    .update({ status: "closed" })
    .eq("id", requestId)
    .eq("contractor_id", profileId);

  if (updateError) {
    console.error("[declineQuoteRequest] update failed", updateError);
    return { success: false, error: "Could not update this request." };
  }

  const customerProblem = request.ai_customer_problem_label
    ? String(request.ai_customer_problem_label)
    : null;

  const { error: eventError } = await supabase.from("quote_request_events").insert({
    quote_request_id: requestId,
    contractor_id: profileId,
    event_type: DECLINE_EVENT_TYPES[reason],
    event_label: DECLINE_REASON_LABELS[reason],
    metadata: {
      decline_reason: reason,
      scope_fit: scopeFit,
      customer_problem: customerProblem,
      previous_status: String(request.status),
    },
  });

  if (eventError) {
    console.error("[declineQuoteRequest] event insert failed", eventError);
  }

  trackProductEventSafe({
    profileId,
    eventName: DECLINE_ANALYTICS[reason],
    route: `/quote-requests/${requestId}`,
    source: "quote_request_actions",
    metadata: {
      request_id: requestId,
      contractor_id: profileId,
      scope_fit: scopeFit,
      customer_problem: customerProblem,
      decline_reason: reason,
    },
  });

  revalidateQuoteRequestSurfaces(requestId);

  const notificationPayload = {
    requestId,
    contractorId: profileId,
    customerName: String(request.customer_name),
    customerEmail: String(request.customer_email ?? ""),
    customerPhone: request.customer_phone ? String(request.customer_phone) : null,
    projectType: String(request.project_type),
    reason,
  };

  const [emailResult, smsResult] = await Promise.all([
    sendQuoteRequestDeclineCustomerEmail(notificationPayload),
    sendQuoteRequestDeclineCustomerSms(notificationPayload),
  ]);

  const emailWarning = emailResult.sent
    ? undefined
    : emailResult.reason === "no_customer_email"
      ? "Customer email not sent (no email on file)."
      : "Customer email could not be sent.";

  const smsWarning = smsResult.sent
    ? undefined
    : smsResult.reason === "no_customer_phone"
      ? "Customer text not sent (no phone on file)."
      : smsResult.reason === "invalid_customer_phone"
        ? "Customer text not sent (invalid phone number)."
        : "Customer text could not be sent.";

  return {
    success: true,
    emailSent: emailResult.sent,
    smsSent: smsResult.sent,
    emailWarning,
    smsWarning,
  };
}
