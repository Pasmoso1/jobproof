import type {
  LibraryQuestion,
  QuestionCategory,
  QuestionPriority,
} from "@/lib/quote-requests/question-library/types";

const CATEGORY_ORDER: Record<QuestionCategory, number> = {
  project_size: 0,
  existing_conditions: 1,
  materials: 2,
  special_features: 3,
  access_removal: 4,
  timeline: 5,
  customer_preferences: 6,
};

const PRIORITY_ORDER: Record<QuestionPriority, number> = {
  very_high: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function compareLibraryQuestions(a: LibraryQuestion, b: LibraryQuestion): number {
  const categoryDiff = CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category];
  if (categoryDiff !== 0) return categoryDiff;

  const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
  if (priorityDiff !== 0) return priorityDiff;

  return a.id.localeCompare(b.id);
}

export function sortLibraryQuestions(questions: LibraryQuestion[]): LibraryQuestion[] {
  return [...questions].sort(compareLibraryQuestions);
}
