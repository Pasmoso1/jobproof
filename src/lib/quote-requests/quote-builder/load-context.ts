import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseProjectBrief } from "@/lib/quote-requests/project-brief/types";
import type { QuoteBuilderContext } from "@/lib/quote-requests/quote-builder/context";
import { mapChecklistRow } from "@/lib/quote-requests/quote-checklist/types";
import { loadSiteVisitNotesRecord } from "@/app/(app)/quote-requests/[requestId]/site-visit-notes-actions";
import { buildQuoteBuilderSiteVisitInput } from "@/lib/quote-requests/site-visit-notes/quote-builder-input";
import { normalizeAdditionalTrades } from "@/lib/quote-requests/trade";
import type { StoredWorkComponent } from "@/lib/quote-requests/work-components/types";

function parseWorkComponents(raw: unknown): StoredWorkComponent[] | null {
  if (!Array.isArray(raw)) return null;
  return raw as StoredWorkComponent[];
}

function detectSiteVisitCustomerChanges(
  description: string,
  siteVisit: ReturnType<typeof buildQuoteBuilderSiteVisitInput>
): boolean {
  if (!siteVisit) return false;
  const customerSection = siteVisit.organizedSections.find((s) => s.key === "customer_requests");
  if (!customerSection || customerSection.observations.length === 0) return false;
  const descLower = description.trim().toLowerCase();
  return customerSection.observations.some(
    (obs) => !descLower.includes(obs.trim().toLowerCase().slice(0, 40))
  );
}

export function computeQuoteBuilderInputHash(context: QuoteBuilderContext): string {
  const payload = JSON.stringify({
    description: context.description.trim(),
    projectType: context.projectType.trim(),
    isUrgent: context.isUrgent,
    photoCount: context.photoCount,
    answers: context.followUpAnswers.map((a) => ({ q: a.question, a: a.answer })),
    briefAt: context.projectBrief?.generatedAt ?? null,
    scopeFit: context.scopeFit,
    workComponents: context.workComponents,
    siteVisitAt: context.siteVisit?.capturedAt ?? null,
    siteVisitQuick: context.siteVisit?.quickNotes ?? "",
    checklistCount: context.checklistItems.filter((i) => i.completed).length,
    primaryTrade: context.primaryTrade,
    additionalTrades: context.additionalTrades,
  });
  return createHash("sha256").update(payload).digest("hex");
}

export async function loadQuoteBuilderContext(
  admin: SupabaseClient,
  requestId: string
): Promise<QuoteBuilderContext | null> {
  const { data: request, error } = await admin
    .from("quote_requests")
    .select(
      "id, contractor_id, customer_name, project_type, description, property_address, is_urgent, project_brief, ai_scope_fit, ai_scope_reason, ai_scope_contractor_note, ai_customer_problem_label, ai_work_components, ai_specialist_trades"
    )
    .eq("id", requestId)
    .maybeSingle();

  if (error || !request) {
    console.error("[quote-builder] load request failed", error);
    return null;
  }

  const { data: profile } = await admin
    .from("profiles")
    .select(
      "quote_primary_trade, quote_additional_trades, contractor_extra_capabilities, business_name, quote_pricing_profile, default_contract_warranty_note"
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

  const { data: checklistRows } = await admin
    .from("quote_request_checklist_items")
    .select("*")
    .eq("quote_request_id", requestId)
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  const siteVisitRecord = await loadSiteVisitNotesRecord(admin, requestId);
  const siteVisit = buildQuoteBuilderSiteVisitInput(siteVisitRecord);
  const description = String(request.description);

  return {
    requestId,
    contractorId: String(request.contractor_id),
    customerName: String(request.customer_name),
    projectType: String(request.project_type),
    description,
    propertyAddress: String(request.property_address),
    isUrgent: Boolean(request.is_urgent),
    photoCount: (attachments ?? []).length,
    followUpAnswers: (answers ?? []).map((a) => ({
      question: String(a.question),
      answer: a.answer == null ? null : String(a.answer),
      question_type: String(a.question_type),
      display_order: Number(a.display_order),
      library_question_id: a.library_question_id ? String(a.library_question_id) : null,
    })),
    projectBrief: parseProjectBrief(request.project_brief),
    checklistItems: (checklistRows ?? []).map(mapChecklistRow),
    siteVisit,
    scopeFit: request.ai_scope_fit ? String(request.ai_scope_fit) : null,
    scopeReason: request.ai_scope_reason ? String(request.ai_scope_reason) : null,
    contractorNote: request.ai_scope_contractor_note
      ? String(request.ai_scope_contractor_note)
      : null,
    customerProblemLabel: request.ai_customer_problem_label
      ? String(request.ai_customer_problem_label)
      : null,
    workComponents: parseWorkComponents(request.ai_work_components),
    specialistTrades: Array.isArray(request.ai_specialist_trades)
      ? request.ai_specialist_trades.map(String)
      : null,
    primaryTrade: profile?.quote_primary_trade ? String(profile.quote_primary_trade) : null,
    additionalTrades: normalizeAdditionalTrades(profile?.quote_additional_trades),
    extraCapabilities: profile?.contractor_extra_capabilities
      ? String(profile.contractor_extra_capabilities)
      : null,
    businessName: profile?.business_name ? String(profile.business_name) : null,
    pricingProfile: profile?.quote_pricing_profile
      ? String(profile.quote_pricing_profile)
      : null,
    defaultWarrantyNote: profile?.default_contract_warranty_note
      ? String(profile.default_contract_warranty_note)
      : null,
    siteVisitHasCustomerChanges: detectSiteVisitCustomerChanges(description, siteVisit),
  };
}

export function siteVisitObservations(context: QuoteBuilderContext): string[] {
  if (!context.siteVisit) return [];
  return context.siteVisit.organizedSections.flatMap((s) => s.observations);
}

export function siteVisitSectionObservations(
  context: QuoteBuilderContext,
  key: string
): string[] {
  if (!context.siteVisit) return [];
  const section = context.siteVisit.organizedSections.find((s) => s.key === key);
  return section?.observations ?? [];
}
