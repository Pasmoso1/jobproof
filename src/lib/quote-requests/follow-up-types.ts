export const FOLLOW_UP_QUESTION_TYPES = [
  "multiple_choice",
  "checkbox",
  "short_text",
  "number",
  "date",
  "yes_no",
] as const;

export type FollowUpQuestionType = (typeof FOLLOW_UP_QUESTION_TYPES)[number];

export type FollowUpQuestion = {
  id: string;
  question: string;
  question_type: FollowUpQuestionType;
  options?: string[];
  display_order: number;
};

export type QuoteRequestFollowUpAnswer = {
  id: string;
  quote_request_id: string;
  question: string;
  answer: string | null;
  question_type: string;
  display_order: number;
  created_at: string;
};

export type GenerateFollowUpQuestionsResult =
  | { ok: true; questions: FollowUpQuestion[]; usedFallback: boolean }
  | { ok: false; reason: "not_configured" | "access_denied" | "generate_failed" };

export function isFollowUpQuestionType(value: string): value is FollowUpQuestionType {
  return (FOLLOW_UP_QUESTION_TYPES as readonly string[]).includes(value);
}

export function formatFollowUpAnswerDisplay(
  answer: string | null,
  questionType: string
): string {
  if (answer == null || answer.trim() === "") {
    return "—";
  }
  if (questionType === "checkbox") {
    return answer
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean)
      .join(", ");
  }
  return answer.trim();
}
