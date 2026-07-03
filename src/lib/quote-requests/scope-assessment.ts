import type { CustomerProblem, ProblemConfidence } from "@/lib/quote-requests/problem-classification";
import type { AiQuestionSelectionResponse } from "@/lib/quote-requests/question-library/types";
import type { StoredWorkComponent } from "@/lib/quote-requests/work-components/types";
import { isScopeConfidence } from "@/lib/quote-requests/work-components/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { maybeGenerateProjectBrief } from "@/lib/quote-requests/project-brief/persist";

export type { CustomerProblem, ProblemConfidence };

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
  confidence?: ProblemConfidence;
  workComponents?: StoredWorkComponent[];
  specialistTrades?: string[];
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

type RawScopeAssessment = AiQuestionSelectionResponse["scopeAssessment"] & {
  confidence?: string;
  workComponents?: Array<{
    key?: string;
    label?: string;
    capability?: string;
    typicalSpecialist?: string;
  }>;
  specialistTrades?: string[];
};

export function normalizeScopeAssessment(
  raw: RawScopeAssessment | null | undefined,
  fallback: ScopeAssessment
): ScopeAssessment {
  const fitRaw = String(raw?.fit ?? "").trim();
  const fit = isScopeFit(fitRaw) ? fitRaw : fallback.fit;

  const confidenceRaw = String(raw?.confidence ?? "").trim();
  const confidence = isScopeConfidence(confidenceRaw)
    ? confidenceRaw
    : fallback.confidence;

  const workComponents = parseWorkComponents(raw?.workComponents, fallback.workComponents);
  const specialistTrades =
    Array.isArray(raw?.specialistTrades) && raw.specialistTrades.length > 0
      ? raw.specialistTrades.map((t) => String(t).trim()).filter(Boolean)
      : fallback.specialistTrades;

  const contractorNote =
    String(raw?.contractorNote ?? fallback.contractorNote).trim() ||
    fallback.contractorNote;

  return {
    fit,
    reason: String(raw?.reason ?? fallback.reason).trim() || fallback.reason,
    contractorNote,
    customerClarificationNeeded:
      raw?.customerClarificationNeeded ?? fallback.customerClarificationNeeded,
    confidence,
    workComponents,
    specialistTrades,
  };
}

function parseWorkComponents(
  raw: RawScopeAssessment["workComponents"],
  fallback?: StoredWorkComponent[]
): StoredWorkComponent[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return fallback;
  const parsed: StoredWorkComponent[] = [];
  for (const item of raw) {
    const key = String(item.key ?? "").trim();
    const label = String(item.label ?? "").trim();
    const capability = String(item.capability ?? "").trim();
    if (!label) continue;
    if (
      capability !== "clearly_performs" &&
      capability !== "may_perform" &&
      capability !== "unlikely_to_perform"
    ) {
      continue;
    }
    parsed.push({
      key: key as StoredWorkComponent["key"],
      label,
      capability,
      typicalSpecialist: item.typicalSpecialist
        ? String(item.typicalSpecialist).trim()
        : undefined,
    });
  }
  return parsed.length > 0 ? parsed : fallback;
}

export async function saveQuoteRequestScopeAssessment(
  admin: SupabaseClient,
  requestId: string,
  assessment: ScopeAssessment,
  customerProblem?: CustomerProblem | null
): Promise<void> {
  const update: Record<string, unknown> = {
    ai_scope_fit: assessment.fit,
    ai_scope_reason: assessment.reason,
    ai_scope_contractor_note: assessment.contractorNote,
    ai_scope_customer_clarification_needed: assessment.customerClarificationNeeded,
    ai_scope_confidence: assessment.confidence ?? null,
    ai_work_components: assessment.workComponents ?? null,
    ai_specialist_trades: assessment.specialistTrades ?? null,
  };

  if (customerProblem) {
    update.ai_customer_problem_label = customerProblem.label;
    update.ai_customer_problem_confidence = customerProblem.confidence;
    update.ai_customer_problem_reasoning = customerProblem.reasoning;
  }

  const { error } = await admin.from("quote_requests").update(update).eq("id", requestId);

  if (error) {
    console.error("[scope-assessment] save failed", { requestId, message: error.message });
    return;
  }

  void maybeGenerateProjectBrief(admin, requestId, "scope_update", false).catch((err) => {
    console.error("[scope-assessment] project brief generation failed", err);
  });
}
