import type { FollowUpQuestionType } from "@/lib/quote-requests/follow-up-types";

export const LIBRARY_TRADES = [
  "painter",
  "plumber",
  "hvac",
  "electrician",
  "roofer",
  "deck_fence",
  "flooring",
  "kitchen_renovation",
  "bathroom_renovation",
  "landscaping",
  "concrete",
  "windows_doors",
  "general_renovation",
  "handyman",
  "other",
] as const;

export type LibraryTradeKey = (typeof LIBRARY_TRADES)[number];

export type QuestionPriority = "very_high" | "high" | "medium" | "low";

export type QuestionCategory =
  | "project_size"
  | "existing_conditions"
  | "materials"
  | "special_features"
  | "access_removal"
  | "timeline"
  | "customer_preferences";

export type LibraryQuestion = {
  id: string;
  trade: LibraryTradeKey | "shared" | "specialty";
  category: QuestionCategory;
  priority: QuestionPriority;
  question: string;
  questionType: FollowUpQuestionType;
  choices?: string[];
  requiredInformation: string;
  tags: string[];
};

export type LibraryQuestionCatalogEntry = {
  id: string;
  trade: LibraryTradeKey | "shared" | "specialty";
  category: QuestionCategory;
  priority: QuestionPriority;
  requiredInformation: string;
  tags: string[];
};

export type AiQuestionSelectionResponse = {
  scopeAssessment?: {
    fit?: string;
    reason?: string;
    contractorNote?: string;
    customerClarificationNeeded?: boolean;
  };
  known_from_description?: string[];
  known_from_photos?: string[];
  selected_question_ids?: string[];
  custom_questions?: Array<{
    question?: string;
    question_type?: string;
    options?: string[];
    display_order?: number;
  }>;
  photo_clarification_needed?: boolean;
  photo_clarification_question?: string | null;
};

export type AiInterviewStepResponse = {
  interview_complete?: boolean;
  complete_reason?: string;
  known_information?: string[];
  customerProblem?: {
    label?: string;
    confidence?: string;
    reasoning?: string;
  };
  scopeAssessment?: AiQuestionSelectionResponse["scopeAssessment"];
  selected_library_question_id?: string | null;
  custom_question?: {
    question?: string;
    question_type?: string;
    options?: string[];
  } | null;
  photo_clarification_needed?: boolean;
  photo_clarification_question?: string | null;
};
