import type { FollowUpQuestion } from "@/lib/quote-requests/follow-up-types";
import {
  assembleFollowUpQuestions,
  selectFallbackLibraryQuestionIds,
} from "@/lib/quote-requests/question-library/assemble";
import { getLibraryQuestionsForTrades } from "@/lib/quote-requests/question-library/registry";
import { resolveLibraryTrades } from "@/lib/quote-requests/question-library/resolve-trade";

/**
 * Priority-based library selection when AI is unavailable.
 */
export function getGenericFollowUpQuestions(
  projectType: string,
  primaryTrade: string | null,
  primaryTradeOther: string | null = null
): FollowUpQuestion[] {
  const libraryTrades = resolveLibraryTrades({
    primaryTrade,
    primaryTradeOther,
    projectType,
  });

  const libraryQuestions = getLibraryQuestionsForTrades(libraryTrades);
  const selectedIds = selectFallbackLibraryQuestionIds(libraryQuestions, projectType);

  return assembleFollowUpQuestions({
    libraryQuestions,
    selectedIds,
    description: projectType,
  });
}
