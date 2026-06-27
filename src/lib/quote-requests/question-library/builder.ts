import type {
  LibraryQuestion,
  LibraryTradeKey,
  QuestionCategory,
  QuestionPriority,
} from "@/lib/quote-requests/question-library/types";
import type { FollowUpQuestionType } from "@/lib/quote-requests/follow-up-types";

type QuestionInput = {
  id: string;
  category: QuestionCategory;
  priority: QuestionPriority;
  question: string;
  questionType: FollowUpQuestionType;
  choices?: string[];
  requiredInformation: string;
  tags: string[];
};

export function defineTradeQuestions(
  trade: LibraryTradeKey,
  questions: QuestionInput[]
): LibraryQuestion[] {
  return questions.map((q) => ({
    ...q,
    trade,
  }));
}

export function defineSharedQuestions(questions: QuestionInput[]): LibraryQuestion[] {
  return questions.map((q) => ({
    ...q,
    trade: "shared" as const,
  }));
}
