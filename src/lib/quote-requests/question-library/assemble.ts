import type { FollowUpQuestion } from "@/lib/quote-requests/follow-up-types";
import { isFollowUpQuestionType } from "@/lib/quote-requests/follow-up-types";
import type { LibraryQuestion } from "@/lib/quote-requests/question-library/types";
import { sortLibraryQuestions } from "@/lib/quote-requests/question-library/sort";
import type { ScopeFit } from "@/lib/quote-requests/scope-assessment";
import {
  customLimitForScope,
  libraryLimitForScope,
  minQuestionsForScope,
  totalLimitForScope,
} from "@/lib/quote-requests/scope-fallback";
import { generateUUID } from "@/lib/utils/uuid";

const MIN_QUESTIONS = 3;
const MAX_QUESTIONS = 8;
const TARGET_QUESTIONS = 6;

export function libraryQuestionToFollowUp(
  question: LibraryQuestion,
  displayOrder: number
): FollowUpQuestion {
  return {
    id: generateUUID(),
    question: question.question,
    question_type: question.questionType,
    options: question.choices,
    display_order: displayOrder,
    library_question_id: question.id,
    is_custom: false,
  };
}

export function buildClarificationFollowUpQuestion(text: string): FollowUpQuestion {
  return {
    id: generateUUID(),
    question: text.trim(),
    question_type: "short_text",
    display_order: 1,
  };
}

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ");
}

function isLikelyKnownFromDescription(
  description: string,
  question: LibraryQuestion,
  knownTags: string[]
): boolean {
  const desc = normalizeText(description);
  const known = new Set(knownTags.map((t) => normalizeText(t)));

  for (const tag of question.tags) {
    const normalizedTag = normalizeText(tag.replace(/_/g, " "));
    if (known.has(normalizedTag) || known.has(tag)) return true;
    if (normalizedTag.length >= 4 && desc.includes(normalizedTag)) return true;
  }

  for (const word of question.requiredInformation.toLowerCase().split(/\s+/)) {
    if (word.length >= 6 && desc.includes(word)) {
      return true;
    }
  }

  return false;
}

export function assembleFollowUpQuestions(input: {
  libraryQuestions: LibraryQuestion[];
  selectedIds: string[];
  description: string;
  knownTags?: string[];
  clarificationQuestion?: string | null;
}): FollowUpQuestion[] {
  const byId = new Map(input.libraryQuestions.map((q) => [q.id, q]));
  const knownTags = input.knownTags ?? [];

  const selected: LibraryQuestion[] = [];
  const seen = new Set<string>();

  for (const id of input.selectedIds) {
    const question = byId.get(id);
    if (!question || seen.has(id)) continue;
    if (isLikelyKnownFromDescription(input.description, question, knownTags)) continue;
    seen.add(id);
    selected.push(question);
    if (selected.length >= MAX_QUESTIONS) break;
  }

  let sorted = sortLibraryQuestions(selected);

  if (sorted.length < MIN_QUESTIONS) {
    const fillers = sortLibraryQuestions(
      input.libraryQuestions.filter(
        (q) =>
          !seen.has(q.id) &&
          !isLikelyKnownFromDescription(input.description, q, knownTags)
      )
    );
    for (const question of fillers) {
      if (sorted.length >= TARGET_QUESTIONS) break;
      seen.add(question.id);
      sorted.push(question);
    }
    sorted = sortLibraryQuestions(sorted).slice(0, MAX_QUESTIONS);
  }

  const result: FollowUpQuestion[] = [];
  let order = 1;

  if (input.clarificationQuestion?.trim()) {
    result.push({
      ...buildClarificationFollowUpQuestion(input.clarificationQuestion),
      display_order: order,
    });
    order += 1;
  }

  for (const question of sorted.slice(0, input.clarificationQuestion ? MAX_QUESTIONS - 1 : MAX_QUESTIONS)) {
    result.push(libraryQuestionToFollowUp(question, order));
    order += 1;
  }

  return result;
}

export function normalizeCustomQuestionsFromAi(
  raw: Array<{
    question?: string;
    question_type?: string;
    options?: string[];
    display_order?: number;
  }>,
  limit: number
): FollowUpQuestion[] {
  const result: FollowUpQuestion[] = [];

  for (const item of raw) {
    const question = String(item.question ?? "").trim();
    const questionType = String(item.question_type ?? "").trim();
    if (!question || !isFollowUpQuestionType(questionType)) continue;

    const options =
      questionType === "multiple_choice" || questionType === "checkbox"
        ? (item.options ?? []).map((o) => String(o).trim()).filter(Boolean).slice(0, 8)
        : undefined;

    if (
      (questionType === "multiple_choice" || questionType === "checkbox") &&
      (!options || options.length < 2)
    ) {
      continue;
    }

    result.push({
      id: generateUUID(),
      question,
      question_type: questionType,
      options,
      display_order: result.length + 1,
    });

    if (result.length >= limit) break;
  }

  return result;
}

export function buildScopedFollowUpQuestions(input: {
  scopeFit: ScopeFit;
  libraryQuestions: LibraryQuestion[];
  selectedIds: string[];
  customQuestions: FollowUpQuestion[];
  description: string;
  knownTags?: string[];
  clarificationQuestion?: string | null;
}): FollowUpQuestion[] {
  const libraryLimit = libraryLimitForScope(input.scopeFit);
  const customLimit = customLimitForScope(input.scopeFit);
  const totalLimit = totalLimitForScope(input.scopeFit);
  const minQuestions = minQuestionsForScope(input.scopeFit);

  const librarySlice = assembleFollowUpQuestions({
    libraryQuestions: input.libraryQuestions,
    selectedIds: input.selectedIds,
    description: input.description,
    knownTags: input.knownTags,
    clarificationQuestion: null,
  }).slice(0, libraryLimit);

  const customSlice = input.customQuestions.slice(0, customLimit);

  const result: FollowUpQuestion[] = [];
  let order = 1;

  if (input.clarificationQuestion?.trim()) {
    result.push({
      ...buildClarificationFollowUpQuestion(input.clarificationQuestion),
      display_order: order,
    });
    order += 1;
  }

  for (const question of customSlice) {
    if (result.length >= totalLimit) break;
    result.push({ ...question, display_order: order });
    order += 1;
  }

  for (const question of librarySlice) {
    if (result.length >= totalLimit) break;
    result.push({ ...question, display_order: order });
    order += 1;
  }

  if (result.length < minQuestions && input.scopeFit === "within_scope") {
    const fillers = assembleFollowUpQuestions({
      libraryQuestions: input.libraryQuestions,
      selectedIds: selectFallbackLibraryQuestionIds(
        input.libraryQuestions,
        input.description
      ),
      description: input.description,
      knownTags: input.knownTags,
    });
    for (const question of fillers) {
      if (result.length >= totalLimit) break;
      if (result.some((r) => r.question === question.question)) continue;
      result.push({ ...question, display_order: order });
      order += 1;
    }
  }

  return result.slice(0, totalLimit);
}

export function selectFallbackLibraryQuestionIds(
  libraryQuestions: LibraryQuestion[],
  description: string
): string[] {
  const sorted = sortLibraryQuestions(libraryQuestions);
  const ids: string[] = [];

  for (const question of sorted) {
    if (isLikelyKnownFromDescription(description, question, [])) continue;
    ids.push(question.id);
    if (ids.length >= TARGET_QUESTIONS) break;
  }

  if (ids.length < MIN_QUESTIONS) {
    for (const question of sorted) {
      if (ids.includes(question.id)) continue;
      ids.push(question.id);
      if (ids.length >= MIN_QUESTIONS) break;
    }
  }

  return ids;
}
