import type { AiQuestionSelectionResponse } from "@/lib/quote-requests/question-library/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export const SCOPE_FIT_VALUES = [
  "within_scope",
  "mixed_scope",
  "possibly_out_of_scope",
  "outside_scope",
] as const;

export type ScopeFit = (typeof SCOPE_FIT_VALUES)[number];

export type ScopeAssessment = {
  fit: ScopeFit;
  reason: string;
  contractorNote: string;
  customerClarificationNeeded: boolean;
};

export function isScopeFit(value: string): value is ScopeFit {
  return (SCOPE_FIT_VALUES as readonly string[]).includes(value);
}

export const SCOPE_FIT_BADGE_LABEL: Record<ScopeFit, string> = {
  within_scope: "Likely in scope",
  mixed_scope: "Mixed scope",
  possibly_out_of_scope: "Review scope",
  outside_scope: "May be outside scope",
};

export function normalizeScopeAssessment(
  raw: AiQuestionSelectionResponse["scopeAssessment"] | null | undefined,
  fallback: ScopeAssessment
): ScopeAssessment {
  const fitRaw = String(raw?.fit ?? "").trim();
  const fit = isScopeFit(fitRaw) ? fitRaw : fallback.fit;

  return {
    fit,
    reason: String(raw?.reason ?? fallback.reason).trim() || fallback.reason,
    contractorNote:
      String(raw?.contractorNote ?? fallback.contractorNote).trim() ||
      fallback.contractorNote,
    customerClarificationNeeded:
      raw?.customerClarificationNeeded ?? fallback.customerClarificationNeeded,
  };
}

export async function saveQuoteRequestScopeAssessment(
  admin: SupabaseClient,
  requestId: string,
  assessment: ScopeAssessment
): Promise<void> {
  const { error } = await admin
    .from("quote_requests")
    .update({
      ai_scope_fit: assessment.fit,
      ai_scope_reason: assessment.reason,
      ai_scope_contractor_note: assessment.contractorNote,
      ai_scope_customer_clarification_needed: assessment.customerClarificationNeeded,
    })
    .eq("id", requestId);

  if (error) {
    console.error("[scope-assessment] save failed", { requestId, message: error.message });
  }
}
