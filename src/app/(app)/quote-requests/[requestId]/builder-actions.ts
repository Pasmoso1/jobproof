"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
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
