"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolvePublicAppOrigin } from "@/lib/app-origin";
import { sendEstimate } from "@/app/(app)/estimates/estimate-actions";
import { upsertEstimateFromQuoteBuilder } from "@/lib/quote-requests/quote-builder/create-estimate";
import { sendQuoteSentCustomerSms } from "@/lib/quote-requests/quote-sent-notifications";
import {
  generateQuoteBuilderDraft,
  loadQuoteBuilderDraft,
} from "@/lib/quote-requests/quote-builder/persist";
import {
  isQuoteBuilderSectionKey,
  mapBuilderSectionRow,
  parseSectionContent,
  type QuoteBuilderDraft,
  type QuoteBuilderSectionContent,
} from "@/lib/quote-requests/quote-builder/types";
import {
  PRODUCT_ANALYTICS_EVENTS,
  trackProductEventSafe,
} from "@/lib/product-analytics";

type ActionError = { success: false; error: string };

async function requireProfileAndRequest(requestId: string) {
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

  if (!profile?.id) {
    return { supabase, profileId: null as string | null, request: null };
  }

  const { data: request } = await supabase
    .from("quote_requests")
    .select("id, contractor_id")
    .eq("id", requestId)
    .eq("contractor_id", profile.id)
    .maybeSingle();

  return { supabase, profileId: profile.id, request };
}

export async function loadQuoteBuilderForRequest(
  supabase: Awaited<ReturnType<typeof createClient>>,
  requestId: string
): Promise<QuoteBuilderDraft> {
  const admin = createServiceRoleClient() ?? supabase;
  const draft = await loadQuoteBuilderDraft(admin, requestId);
  return (
    draft ?? {
      quoteRequestId: requestId,
      status: "empty",
      version: 1,
      generatedAt: null,
      siteVisitBanner: false,
      sections: [],
    }
  );
}

export type GenerateQuoteBuilderResult =
  | { success: true; draft: QuoteBuilderDraft }
  | ActionError;

export async function generateQuoteBuilderDraftAction(
  requestId: string,
  regenerate = false
): Promise<GenerateQuoteBuilderResult> {
  const { profileId, request } = await requireProfileAndRequest(requestId);
  if (!profileId || !request) {
    return { success: false, error: "Quote request not found." };
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return { success: false, error: "Could not generate draft right now." };
  }

  const draft = await generateQuoteBuilderDraft(admin, requestId, { regenerate });
  if (!draft) {
    return { success: false, error: "Could not generate quote draft." };
  }

  revalidatePath(`/quote-requests/${requestId}`);
  return { success: true, draft };
}

export type SaveBuilderSectionResult =
  | { success: true; section: QuoteBuilderDraft["sections"][number] }
  | ActionError;

export async function saveQuoteBuilderSection(
  requestId: string,
  sectionKey: string,
  content: QuoteBuilderSectionContent
): Promise<SaveBuilderSectionResult> {
  const { supabase, profileId, request } = await requireProfileAndRequest(requestId);
  if (!profileId || !request) {
    return { success: false, error: "Quote request not found." };
  }

  if (!isQuoteBuilderSectionKey(sectionKey)) {
    return { success: false, error: "Invalid section." };
  }

  const parsed = parseSectionContent(sectionKey, content);
  const now = new Date().toISOString();

  const { data: updated, error } = await supabase
    .from("quote_request_builder_sections")
    .update({
      content: parsed,
      contractor_edited: true,
      contractor_edited_at: now,
      source: "contractor",
    })
    .eq("quote_request_id", requestId)
    .eq("section_key", sectionKey)
    .eq("contractor_id", profileId)
    .select("*")
    .single();

  if (error || !updated) {
    console.error("[saveQuoteBuilderSection]", error);
    return { success: false, error: "Could not save section." };
  }

  await supabase
    .from("quote_requests")
    .update({ quote_builder_status: "draft" })
    .eq("id", requestId)
    .eq("contractor_id", profileId);

  trackProductEventSafe({
    profileId,
    eventName: PRODUCT_ANALYTICS_EVENTS.quote_section_edited,
    route: `/quote-requests/${requestId}`,
    source: "quote_builder",
    metadata: {
      request_id: requestId,
      section_key: sectionKey,
    },
  });

  const mapped = mapBuilderSectionRow(updated);
  if (!mapped) {
    return { success: false, error: "Could not read saved section." };
  }

  revalidatePath(`/quote-requests/${requestId}`);
  return { success: true, section: mapped };
}

export type MarkQuoteBuilderReadyResult = { success: true } | ActionError;

export async function markQuoteBuilderReady(
  requestId: string
): Promise<MarkQuoteBuilderReadyResult> {
  const { supabase, profileId, request } = await requireProfileAndRequest(requestId);
  if (!profileId || !request) {
    return { success: false, error: "Quote request not found." };
  }

  const { count } = await supabase
    .from("quote_request_builder_sections")
    .select("id", { count: "exact", head: true })
    .eq("quote_request_id", requestId);

  if (!count) {
    return { success: false, error: "Generate a draft before marking ready." };
  }

  const { error } = await supabase
    .from("quote_requests")
    .update({ quote_builder_status: "ready" })
    .eq("id", requestId)
    .eq("contractor_id", profileId);

  if (error) {
    console.error("[markQuoteBuilderReady]", error);
    return { success: false, error: "Could not update status." };
  }

  trackProductEventSafe({
    profileId,
    eventName: PRODUCT_ANALYTICS_EVENTS.quote_marked_ready,
    route: `/quote-requests/${requestId}`,
    source: "quote_builder",
    metadata: { request_id: requestId },
  });

  revalidatePath(`/quote-requests/${requestId}`);
  return { success: true };
}

export type SaveQuoteBuilderDraftResult = { success: true } | ActionError;

export async function saveQuoteBuilderDraft(
  requestId: string
): Promise<SaveQuoteBuilderDraftResult> {
  const { supabase, profileId, request } = await requireProfileAndRequest(requestId);
  if (!profileId || !request) {
    return { success: false, error: "Quote request not found." };
  }

  const { error } = await supabase
    .from("quote_requests")
    .update({ quote_builder_status: "draft" })
    .eq("id", requestId)
    .eq("contractor_id", profileId);

  if (error) {
    return { success: false, error: "Could not save draft." };
  }

  revalidatePath(`/quote-requests/${requestId}`);
  return { success: true };
}

export type SendQuoteFromBuilderResult =
  | {
      success: true;
      estimateId: string;
      emailSent: boolean;
      smsSent: boolean;
      emailWarning?: string;
      smsWarning?: string;
    }
  | { success: false; error: string };

export async function sendQuoteFromBuilder(
  requestId: string
): Promise<SendQuoteFromBuilderResult> {
  const { supabase, profileId, request } = await requireProfileAndRequest(requestId);
  if (!profileId || !request) {
    return { success: false, error: "Quote request not found." };
  }

  const { data: fullRequest } = await supabase
    .from("quote_requests")
    .select(
      "id, contractor_id, customer_id, estimate_id, property_address, project_type, customer_name, customer_phone, quote_builder_status"
    )
    .eq("id", requestId)
    .eq("contractor_id", profileId)
    .maybeSingle();

  if (!fullRequest) {
    return { success: false, error: "Quote request not found." };
  }

  if (String(fullRequest.quote_builder_status) === "sent") {
    return { success: false, error: "This quote has already been sent." };
  }

  const customerId = String(fullRequest.customer_id ?? "").trim();
  if (!customerId) {
    return { success: false, error: "Add the customer before sending the quote." };
  }

  const { data: sectionRows } = await supabase
    .from("quote_request_builder_sections")
    .select("*")
    .eq("quote_request_id", requestId)
    .order("display_order", { ascending: true });

  const sections = (sectionRows ?? [])
    .map(mapBuilderSectionRow)
    .filter((s): s is NonNullable<ReturnType<typeof mapBuilderSectionRow>> => s !== null);

  if (!sections.length) {
    return { success: false, error: "Create a quote before sending." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("province")
    .eq("id", profileId)
    .single();

  const upsert = await upsertEstimateFromQuoteBuilder(supabase, {
    profileId,
    requestId,
    customerId,
    existingEstimateId: (fullRequest.estimate_id as string | null) ?? null,
    projectType: String(fullRequest.project_type ?? ""),
    propertyAddress: String(fullRequest.property_address ?? ""),
    profileProvince: (profile?.province as string | null) ?? null,
    sections,
  });

  if ("error" in upsert) {
    return { success: false, error: upsert.error };
  }

  const estimateId = upsert.estimateId;

  const { error: preparedEventError } = await supabase.from("quote_request_events").insert({
    quote_request_id: requestId,
    contractor_id: profileId,
    event_type: "quote_prepared",
    event_label: "Quote prepared as estimate",
    metadata: { estimate_id: estimateId },
  });
  if (preparedEventError) {
    console.error("[sendQuoteFromBuilder prepared event]", preparedEventError);
  }

  const sendResult = await sendEstimate(estimateId);
  if ("error" in sendResult) {
    return { success: false, error: sendResult.error };
  }

  let emailWarning: string | undefined;
  if (!sendResult.emailSent) {
    emailWarning =
      sendResult.emailError ??
      "Quote saved but email could not be sent. Check your email configuration and try again from Estimates.";
  }

  let smsSent = false;
  let smsWarning: string | undefined;

  if (sendResult.emailSent) {
    const { data: sentEstimate } = await supabase
      .from("estimates")
      .select("title, public_token")
      .eq("id", estimateId)
      .single();

    const publicToken = String(sentEstimate?.public_token ?? "").trim();
    const publicUrl = publicToken
      ? `${resolvePublicAppOrigin()}/estimate/${publicToken}`
      : "";

    const smsResult = await sendQuoteSentCustomerSms({
      requestId,
      contractorId: profileId,
      customerName: String(fullRequest.customer_name ?? ""),
      customerPhone: String(fullRequest.customer_phone ?? ""),
      estimateTitle: String(sentEstimate?.title ?? fullRequest.project_type ?? "your project"),
      publicEstimateUrl: publicUrl,
    });

    smsSent = smsResult.sent;
    if (!smsResult.sent) {
      smsWarning =
        smsResult.reason === "no_customer_phone"
          ? "Customer text not sent (no phone on file)."
          : smsResult.reason === "invalid_customer_phone"
            ? "Customer text not sent (invalid phone number)."
            : "Customer text could not be sent.";
    }

    await supabase
      .from("quote_requests")
      .update({
        estimate_id: estimateId,
        quote_builder_status: "sent",
      })
      .eq("id", requestId)
      .eq("contractor_id", profileId);

    const eventRows: Array<{
      quote_request_id: string;
      contractor_id: string;
      event_type: string;
      event_label: string;
      metadata: Record<string, unknown>;
    }> = [
      {
        quote_request_id: requestId,
        contractor_id: profileId,
        event_type: "quote_sent_email_sent",
        event_label: "Quote email sent to customer",
        metadata: { estimate_id: estimateId },
      },
    ];

    if (smsSent) {
      eventRows.push({
        quote_request_id: requestId,
        contractor_id: profileId,
        event_type: "quote_sent_sms_sent",
        event_label: "Quote text sent to customer",
        metadata: { estimate_id: estimateId },
      });
    }

    eventRows.push({
      quote_request_id: requestId,
      contractor_id: profileId,
      event_type: "quote_sent",
      event_label: "Quote sent to customer",
      metadata: { estimate_id: estimateId, email_sent: true, sms_sent: smsSent },
    });

    const { error: eventsError } = await supabase.from("quote_request_events").insert(eventRows);
    if (eventsError) {
      console.error("[sendQuoteFromBuilder events]", eventsError);
    }

    trackProductEventSafe({
      profileId,
      eventName: PRODUCT_ANALYTICS_EVENTS.quote_sent,
      route: `/quote-requests/${requestId}`,
      source: "quote_builder",
      metadata: {
        request_id: requestId,
        estimate_id: estimateId,
        email_sent: true,
        sms_sent: smsSent,
      },
    });

    if (smsSent) {
      trackProductEventSafe({
        profileId,
        eventName: PRODUCT_ANALYTICS_EVENTS.quote_sent_sms_sent,
        route: `/quote-requests/${requestId}`,
        source: "quote_builder",
        metadata: { request_id: requestId, estimate_id: estimateId },
      });
    } else if (smsWarning) {
      trackProductEventSafe({
        profileId,
        eventName: PRODUCT_ANALYTICS_EVENTS.quote_sent_sms_failed,
        route: `/quote-requests/${requestId}`,
        source: "quote_builder",
        metadata: { request_id: requestId, estimate_id: estimateId },
      });
    }
  } else {
    trackProductEventSafe({
      profileId,
      eventName: PRODUCT_ANALYTICS_EVENTS.quote_sent_email_failed,
      route: `/quote-requests/${requestId}`,
      source: "quote_builder",
      metadata: { request_id: requestId, estimate_id: estimateId },
    });

    await supabase.from("quote_request_events").insert({
      quote_request_id: requestId,
      contractor_id: profileId,
      event_type: "quote_sent_email_failed",
      event_label: "Quote email could not be sent",
      metadata: { estimate_id: estimateId },
    });
  }

  revalidatePath(`/quote-requests/${requestId}`);
  revalidatePath("/estimates");
  revalidatePath(`/estimates/${estimateId}`);

  return {
    success: true,
    estimateId,
    emailSent: sendResult.emailSent,
    smsSent,
    emailWarning,
    smsWarning,
  };
}
