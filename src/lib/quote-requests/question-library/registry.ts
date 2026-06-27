import type {
  LibraryQuestion,
  LibraryQuestionCatalogEntry,
  LibraryTradeKey,
} from "@/lib/quote-requests/question-library/types";
import { SHARED_LIBRARY_QUESTIONS } from "@/lib/quote-requests/question-library/shared";
import { BATHROOM_RENOVATION_QUESTIONS } from "@/lib/quote-requests/question-library/trades/bathroom-renovation";
import { CONCRETE_QUESTIONS } from "@/lib/quote-requests/question-library/trades/concrete";
import { DECK_FENCE_QUESTIONS } from "@/lib/quote-requests/question-library/trades/deck-fence";
import { ELECTRICIAN_QUESTIONS } from "@/lib/quote-requests/question-library/trades/electrician";
import { FLOORING_QUESTIONS } from "@/lib/quote-requests/question-library/trades/flooring";
import { GENERAL_RENOVATION_QUESTIONS } from "@/lib/quote-requests/question-library/trades/general-renovation";
import { HANDYMAN_QUESTIONS } from "@/lib/quote-requests/question-library/trades/handyman";
import { HVAC_QUESTIONS } from "@/lib/quote-requests/question-library/trades/hvac";
import { KITCHEN_RENOVATION_QUESTIONS } from "@/lib/quote-requests/question-library/trades/kitchen-renovation";
import { LANDSCAPING_QUESTIONS } from "@/lib/quote-requests/question-library/trades/landscaping";
import { OTHER_QUESTIONS } from "@/lib/quote-requests/question-library/trades/other";
import { PAINTER_QUESTIONS } from "@/lib/quote-requests/question-library/trades/painter";
import { PLUMBER_QUESTIONS } from "@/lib/quote-requests/question-library/trades/plumber";
import { ROOFER_QUESTIONS } from "@/lib/quote-requests/question-library/trades/roofer";
import { WINDOWS_DOORS_QUESTIONS } from "@/lib/quote-requests/question-library/trades/windows-doors";

const TRADE_QUESTION_MAP: Record<LibraryTradeKey, LibraryQuestion[]> = {
  painter: PAINTER_QUESTIONS,
  plumber: PLUMBER_QUESTIONS,
  hvac: HVAC_QUESTIONS,
  electrician: ELECTRICIAN_QUESTIONS,
  roofer: ROOFER_QUESTIONS,
  deck_fence: DECK_FENCE_QUESTIONS,
  flooring: FLOORING_QUESTIONS,
  kitchen_renovation: KITCHEN_RENOVATION_QUESTIONS,
  bathroom_renovation: BATHROOM_RENOVATION_QUESTIONS,
  landscaping: LANDSCAPING_QUESTIONS,
  concrete: CONCRETE_QUESTIONS,
  windows_doors: WINDOWS_DOORS_QUESTIONS,
  general_renovation: GENERAL_RENOVATION_QUESTIONS,
  handyman: HANDYMAN_QUESTIONS,
  other: OTHER_QUESTIONS,
};

const ALL_LIBRARY_QUESTIONS: LibraryQuestion[] = [
  ...SHARED_LIBRARY_QUESTIONS,
  ...Object.values(TRADE_QUESTION_MAP).flat(),
];

const QUESTION_BY_ID = new Map(ALL_LIBRARY_QUESTIONS.map((q) => [q.id, q]));

export function getLibraryQuestionsForTrades(trades: LibraryTradeKey[]): LibraryQuestion[] {
  const seen = new Set<string>();
  const result: LibraryQuestion[] = [];

  for (const question of SHARED_LIBRARY_QUESTIONS) {
    if (!seen.has(question.id)) {
      seen.add(question.id);
      result.push(question);
    }
  }

  for (const trade of trades) {
    for (const question of TRADE_QUESTION_MAP[trade] ?? []) {
      if (!seen.has(question.id)) {
        seen.add(question.id);
        result.push(question);
      }
    }
  }

  return result;
}

export function getLibraryQuestionById(id: string): LibraryQuestion | undefined {
  return QUESTION_BY_ID.get(id);
}

export function toCatalogEntry(question: LibraryQuestion): LibraryQuestionCatalogEntry {
  return {
    id: question.id,
    trade: question.trade,
    category: question.category,
    priority: question.priority,
    requiredInformation: question.requiredInformation,
    tags: question.tags,
  };
}

export function getQuestionCountsByTrade(): Record<LibraryTradeKey | "shared", number> {
  const counts = {} as Record<LibraryTradeKey | "shared", number>;
  counts.shared = SHARED_LIBRARY_QUESTIONS.length;
  for (const [trade, questions] of Object.entries(TRADE_QUESTION_MAP) as Array<
    [LibraryTradeKey, LibraryQuestion[]]
  >) {
    counts[trade] = questions.length;
  }
  return counts;
}

export { ALL_LIBRARY_QUESTIONS, TRADE_QUESTION_MAP };
