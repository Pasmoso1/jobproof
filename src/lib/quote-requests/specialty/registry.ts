import type { LibraryQuestion } from "@/lib/quote-requests/question-library/types";
import { sortLibraryQuestions } from "@/lib/quote-requests/question-library/sort";
import { EXTERIOR_DRAINAGE_QUESTIONS } from "@/lib/quote-requests/specialty/exterior-drainage";
import { FOUNDATION_WATERPROOFING_QUESTIONS } from "@/lib/quote-requests/specialty/foundation-waterproofing";
import type { SpecialtyClassification, SpecialtyKey } from "@/lib/quote-requests/specialty/types";

const SPECIALTY_MAP: Record<SpecialtyKey, LibraryQuestion[]> = {
  foundation_waterproofing: FOUNDATION_WATERPROOFING_QUESTIONS,
  exterior_drainage: EXTERIOR_DRAINAGE_QUESTIONS,
};

const ALL_SPECIALTY_QUESTIONS = [
  ...FOUNDATION_WATERPROOFING_QUESTIONS,
  ...EXTERIOR_DRAINAGE_QUESTIONS,
];

const SPECIALTY_BY_ID = new Map(ALL_SPECIALTY_QUESTIONS.map((q) => [q.id, q]));

/** Generic low-value questions to suppress when a specialty is active */
export const BLOCKED_GENERIC_QUESTION_IDS = new Set([
  "shared_site_access",
  "landscaping_project_type",
  "landscaping_current_condition",
  "landscaping_property_size",
  "landscaping_areas",
  "landscaping_lawn_area",
]);

/** Timeline / readiness — defer until after urgent specialty questions */
export const DEFERRED_UNTIL_LATER_IDS = new Set([
  "shared_timeline_completion",
  "shared_move_forward",
  "shared_specific_date",
]);

export function getSpecialtyQuestions(
  specialty: SpecialtyClassification
): LibraryQuestion[] {
  const base = [...(SPECIALTY_MAP[specialty.key] ?? [])];
  if (specialty.key === "foundation_waterproofing" && specialty.urgent) {
    const active = base.find((q) => q.id === "specialty_fw_active_leak");
    const rest = base.filter((q) => q.id !== "specialty_fw_active_leak");
    return active ? [active, ...rest] : base;
  }
  return sortLibraryQuestions(base);
}

export function getSpecialtyQuestionById(id: string): LibraryQuestion | undefined {
  return SPECIALTY_BY_ID.get(id);
}

export function isSpecialtyQuestionId(id: string): boolean {
  return id.startsWith("specialty_");
}

export function shouldBlockQuestionId(
  questionId: string,
  specialty: SpecialtyClassification | null,
  questionNumber: number
): boolean {
  if (!specialty) return false;

  if (BLOCKED_GENERIC_QUESTION_IDS.has(questionId)) {
    return true;
  }

  if (
    specialty.urgent &&
    questionNumber <= 4 &&
    DEFERRED_UNTIL_LATER_IDS.has(questionId)
  ) {
    return true;
  }

  if (
    specialty.key === "foundation_waterproofing" &&
    questionId.startsWith("landscaping_") &&
    questionId !== "landscaping_site_access"
  ) {
    return true;
  }

  return false;
}

export function filterCatalogForSpecialty(
  catalog: LibraryQuestion[],
  specialty: SpecialtyClassification | null,
  questionNumber: number
): LibraryQuestion[] {
  if (!specialty) return catalog;
  return catalog.filter((q) => !shouldBlockQuestionId(q.id, specialty, questionNumber));
}
