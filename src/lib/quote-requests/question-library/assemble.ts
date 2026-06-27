import type { FollowUpQuestion } from "@/lib/quote-requests/follow-up-types";
import type { LibraryQuestion } from "@/lib/quote-requests/question-library/types";
import { sortLibraryQuestions } from "@/lib/quote-requests/question-library/sort";
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
