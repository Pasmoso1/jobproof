import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PreviousInterviewAnswer } from "@/lib/quote-requests/follow-up-types";
import { parseProjectBrief } from "@/lib/quote-requests/project-brief/types";
import { normalizeAdditionalTrades } from "@/lib/quote-requests/trade";
import type { StoredWorkComponent } from "@/lib/quote-requests/work-components/types";
import { buildFallbackChecklist } from "@/lib/quote-requests/quote-checklist/fallback";
import { generateChecklistWithAi } from "@/lib/quote-requests/quote-checklist/generate";
import {
  checklistCompletionPercentage,
  mergeChecklistItems,
} from "@/lib/quote-requests/quote-checklist/merge";
import type {
  QuoteChecklistContext,
  QuoteChecklistItem,
  QuoteChecklistTrigger,
} from "@/lib/quote-requests/quote-checklist/types";
import { mapChecklistRow } from "@/lib/quote-requests/quote-checklist/types";
import {
  PRODUCT_ANALYTICS_EVENTS,
  trackProductEventSafe,
} from "@/lib/product-analytics";

export function computeChecklistInputHash(context: QuoteChecklistContext): string {
  const payload = JSON.stringify({
    description: context.description.trim(),
    projectType: context.projectType.trim(),
    isUrgent: context.isUrgent,
    photoCount: context.photoCount,
    answers: context.previousAnswers.map((a: { question: string; answer: string | null }) => ({
      q: a.question,
      a: a.answer,
    })),
    interviewCompleted: context.interviewCompleted,
    scopeFit: context.scopeFit,
    scopeReason: context.scopeReason,
    workComponents: context.workComponents,
    projectBriefGeneratedAt: context.projectBrief?.generatedAt ?? null,
    primaryTrade: context.primaryTrade,
    additionalTrades: context.additionalTrades,
    trigger: context.trigger,
  });
  return createHash("sha256").update(payload).digest("hex");
}

export async function loadQuoteChecklistContext(
  admin: SupabaseClient,
  requestId: string,
  trigger: QuoteChecklistTrigger,
  interviewCompleted: boolean
): Promise<QuoteChecklistContext | null> {
  const { data: request, error } = await admin
    .from("quote_requests")
    .select(
      "id, contractor_id, customer_name, project_type, description, is_urgent, project_brief, ai_scope_fit, ai_scope_reason, ai_scope_contractor_note, ai_customer_problem_label, ai_work_components, ai_specialist_trades"
    )
    .eq("id", requestId)
    .maybeSingle();

  if (error || !request) {
    console.error("[quote-checklist] load request failed", error);
    return null;
  }

  const { data: profile } = await admin
    .from("profiles")
    .select(
      "quote_primary_trade, quote_additional_trades, contractor_extra_capabilities"
    )
    .eq("id", request.contractor_id)
    .maybeSingle();

  const { data: attachments } = await admin
    .from("quote_request_attachments")
    .select("id")
    .eq("quote_request_id", requestId);

  const { data: answers } = await admin
    .from("quote_request_followup_answers")
    .select("question, answer, question_type, display_order, library_question_id")
    .eq("quote_request_id", requestId)
    .order("display_order", { ascending: true });

  const previousAnswers: PreviousInterviewAnswer[] = (answers ?? []).map((a) => ({
    question: String(a.question),
    answer: a.answer == null ? null : String(a.answer),
    question_type: String(a.question_type),
    display_order: Number(a.display_order),
    library_question_id: a.library_question_id ? String(a.library_question_id) : null,
  }));

  const workComponents = parseWorkComponents(request.ai_work_components);

  return {
    requestId,
    contractorId: String(request.contractor_id),
    customerName: String(request.customer_name),
    projectType: String(request.project_type),
    description: String(request.description),
    isUrgent: Boolean(request.is_urgent),
    photoCount: (attachments ?? []).length,
    previousAnswers,
    interviewCompleted,
    scopeFit: request.ai_scope_fit ? String(request.ai_scope_fit) : null,
    scopeReason: request.ai_scope_reason ? String(request.ai_scope_reason) : null,
    contractorNote: request.ai_scope_contractor_note
      ? String(request.ai_scope_contractor_note)
      : null,
    customerProblemLabel: request.ai_customer_problem_label
      ? String(request.ai_customer_problem_label)
      : null,
    workComponents,
    specialistTrades: Array.isArray(request.ai_specialist_trades)
      ? request.ai_specialist_trades.map(String)
      : null,
    primaryTrade: profile?.quote_primary_trade ? String(profile.quote_primary_trade) : null,
    additionalTrades: normalizeAdditionalTrades(profile?.quote_additional_trades),
    extraCapabilities: profile?.contractor_extra_capabilities
      ? String(profile.contractor_extra_capabilities)
      : null,
    projectBrief: parseProjectBrief(request.project_brief),
    trigger,
  };
}

function parseWorkComponents(raw: unknown): StoredWorkComponent[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  return raw.map((c) => {
    const item = c as Record<string, unknown>;
    return {
      key: String(item.key ?? "") as StoredWorkComponent["key"],
      label: String(item.label ?? ""),
      capability: String(item.capability ?? "") as StoredWorkComponent["capability"],
      typicalSpecialist: item.typicalSpecialist
        ? String(item.typicalSpecialist)
        : undefined,
    };
  });
}

async function generateDrafts(context: QuoteChecklistContext) {
  const aiDrafts = await generateChecklistWithAi(context);
  return aiDrafts ?? buildFallbackChecklist(context);
}

function trackChecklistAnalytics(
  context: QuoteChecklistContext,
  eventName:
    | typeof PRODUCT_ANALYTICS_EVENTS.checklist_generated
    | typeof PRODUCT_ANALYTICS_EVENTS.checklist_updated,
  items: QuoteChecklistItem[],
  isUpdate: boolean
) {
  trackProductEventSafe({
    profileId: context.contractorId,
    eventName,
    route: `/quote-requests/${context.requestId}`,
    source: "quote_checklist",
    metadata: {
      request_id: context.requestId,
      contractor_id: context.contractorId,
      trigger: context.trigger,
      item_count: items.length,
      completion_percentage: checklistCompletionPercentage(items),
      is_update: isUpdate,
    },
  });
}

export async function maybeGenerateQuoteChecklist(
  admin: SupabaseClient,
  requestId: string,
  trigger: QuoteChecklistTrigger,
  interviewCompleted = false
): Promise<QuoteChecklistItem[] | null> {
  const context = await loadQuoteChecklistContext(
    admin,
    requestId,
    trigger,
    interviewCompleted
  );
  if (!context) return null;

  const inputHash = computeChecklistInputHash(context);

  const { data: existing } = await admin
    .from("quote_requests")
    .select("quote_checklist_input_hash")
    .eq("id", requestId)
    .maybeSingle();

  if (existing?.quote_checklist_input_hash === inputHash) {
    const { data: rows } = await admin
      .from("quote_request_checklist_items")
      .select("*")
      .eq("quote_request_id", requestId)
      .eq("is_active", true)
      .order("display_order", { ascending: true });
    return (rows ?? []).map(mapChecklistRow);
  }

  const isUpdate = Boolean(existing?.quote_checklist_input_hash);
  const drafts = await generateDrafts(context);
  const items = await mergeChecklistItems(admin, {
    quoteRequestId: requestId,
    contractorId: context.contractorId,
    drafts,
  });

  const now = new Date().toISOString();
  await admin
    .from("quote_requests")
    .update({
      quote_checklist_input_hash: inputHash,
      quote_checklist_generated_at: now,
    })
    .eq("id", requestId);

  trackChecklistAnalytics(
    context,
    isUpdate
      ? PRODUCT_ANALYTICS_EVENTS.checklist_updated
      : PRODUCT_ANALYTICS_EVENTS.checklist_generated,
    items,
    isUpdate
  );

  return items;
}

export async function listQuoteChecklistItems(
  admin: SupabaseClient,
  requestId: string
): Promise<QuoteChecklistItem[]> {
  const { data: rows } = await admin
    .from("quote_request_checklist_items")
    .select("*")
    .eq("quote_request_id", requestId)
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  return (rows ?? []).map(mapChecklistRow);
}

/** Run checklist after brief when possible; never blocks customer paths. */
export function triggerQuoteChecklistGeneration(
  admin: SupabaseClient | null,
  requestId: string,
  trigger: QuoteChecklistTrigger,
  interviewCompleted = false
): void {
  if (!admin) return;
  void maybeGenerateQuoteChecklist(admin, requestId, trigger, interviewCompleted).catch(
    (err) => {
      console.error("[quote-checklist] generation failed", err);
    }
  );
}

/** After brief saves, regenerate checklist if brief changed inputs. */
export function triggerChecklistAfterBrief(
  admin: SupabaseClient | null,
  requestId: string,
  interviewCompleted: boolean
): void {
  triggerQuoteChecklistGeneration(
    admin,
    requestId,
    interviewCompleted ? "interview_complete" : "project_brief_update",
    interviewCompleted
  );
}
