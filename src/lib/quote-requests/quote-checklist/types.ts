import type { ProjectBrief } from "@/lib/quote-requests/project-brief/types";
import type { PreviousInterviewAnswer } from "@/lib/quote-requests/follow-up-types";
import type { StoredWorkComponent } from "@/lib/quote-requests/work-components/types";

export type QuoteChecklistTrigger =
  | "submission"
  | "interview_complete"
  | "project_brief_update"
  | "significant_update";

export type QuoteChecklistContext = {
  requestId: string;
  contractorId: string;
  customerName: string;
  projectType: string;
  description: string;
  isUrgent: boolean;
  photoCount: number;
  previousAnswers: PreviousInterviewAnswer[];
  interviewCompleted: boolean;
  scopeFit: string | null;
  scopeReason: string | null;
  contractorNote: string | null;
  customerProblemLabel: string | null;
  workComponents: StoredWorkComponent[] | null;
  specialistTrades: string[] | null;
  primaryTrade: string | null;
  additionalTrades: string[];
  extraCapabilities: string | null;
  projectBrief: ProjectBrief | null;
  trigger: QuoteChecklistTrigger;
};

export const CHECKLIST_CATEGORIES = [
  "before_contacting_customer",
  "during_first_conversation",
  "site_visit",
  "pricing_considerations",
  "potential_risks",
  "recommended_next_action",
] as const;

export type ChecklistCategory = (typeof CHECKLIST_CATEGORIES)[number];

export const CHECKLIST_PRIORITIES = ["Critical", "Important", "Optional"] as const;

export type ChecklistPriority = (typeof CHECKLIST_PRIORITIES)[number];

export const CHECKLIST_GENERATED_FROM = [
  "description",
  "photos",
  "follow_up_answers",
  "scope_assessment",
  "project_brief",
  "work_components",
  "customer_request",
  "contractor_trades",
  "urgency",
] as const;

export type ChecklistGeneratedFrom = (typeof CHECKLIST_GENERATED_FROM)[number];

export type ChecklistItemDraft = {
  stableKey: string;
  category: ChecklistCategory;
  title: string;
  description: string;
  priority: ChecklistPriority;
  generatedFrom: ChecklistGeneratedFrom;
  aiReason: string;
  displayOrder: number;
};

export type QuoteChecklistItem = {
  id: string;
  quoteRequestId: string;
  contractorId: string;
  stableKey: string;
  category: ChecklistCategory;
  title: string;
  description: string;
  priority: ChecklistPriority;
  displayOrder: number;
  completed: boolean;
  completedAt: string | null;
  completedBy: string | null;
  generatedFrom: string;
  aiReason: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export const CHECKLIST_CATEGORY_LABELS: Record<ChecklistCategory, string> = {
  before_contacting_customer: "Before contacting the customer",
  during_first_conversation: "During the first conversation",
  site_visit: "Site visit",
  pricing_considerations: "Pricing considerations",
  potential_risks: "Potential risks",
  recommended_next_action: "Recommended next action",
};

export const CHECKLIST_CATEGORY_DEFAULT_OPEN: Partial<Record<ChecklistCategory, boolean>> = {
  before_contacting_customer: true,
  site_visit: true,
};

export function isChecklistCategory(value: string): value is ChecklistCategory {
  return (CHECKLIST_CATEGORIES as readonly string[]).includes(value);
}

export function isChecklistPriority(value: string): value is ChecklistPriority {
  return (CHECKLIST_PRIORITIES as readonly string[]).includes(value);
}

export function isChecklistGeneratedFrom(value: string): value is ChecklistGeneratedFrom {
  return (CHECKLIST_GENERATED_FROM as readonly string[]).includes(value);
}

export function mapChecklistRow(row: {
  id: string;
  quote_request_id: string;
  contractor_id: string;
  stable_key: string;
  category: string;
  title: string;
  description: string;
  priority: string;
  display_order: number;
  completed: boolean;
  completed_at: string | null;
  completed_by: string | null;
  generated_from: string;
  ai_reason: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}): QuoteChecklistItem {
  return {
    id: row.id,
    quoteRequestId: row.quote_request_id,
    contractorId: row.contractor_id,
    stableKey: row.stable_key,
    category: row.category as ChecklistCategory,
    title: row.title,
    description: row.description,
    priority: row.priority as ChecklistPriority,
    displayOrder: row.display_order,
    completed: row.completed,
    completedAt: row.completed_at,
    completedBy: row.completed_by,
    generatedFrom: row.generated_from,
    aiReason: row.ai_reason,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
