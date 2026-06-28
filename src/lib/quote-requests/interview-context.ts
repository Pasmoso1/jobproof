import type { PreviousInterviewAnswer } from "@/lib/quote-requests/follow-up-types";
import type { CustomerProblem } from "@/lib/quote-requests/problem-classification";

/**
 * Builds a unified project understanding block for AI prompts.
 * Sources are listed in priority order — description first, project type last.
 */
export function buildUnifiedUnderstandingBlock(input: {
  description: string;
  projectType: string;
  isUrgent: boolean;
  photoCount: number;
  previousAnswers: PreviousInterviewAnswer[];
  customerProblem: CustomerProblem;
}): string {
  const description = input.description.trim() || "(empty)";
  const projectType = input.projectType.trim() || "(not specified)";

  const interviewLines =
    input.previousAnswers.length === 0
      ? "None yet."
      : input.previousAnswers
          .map(
            (a, i) =>
              `${i + 1}. Q: ${a.question}\n   A: ${a.answer?.trim() || "(skipped)"}`
          )
          .join("\n");

  const urgentNote = input.isUrgent
    ? "Yes — customer needs timely help; do not ask readiness/timing questions."
    : "No";

  const photoNote =
    input.photoCount > 0
      ? `${input.photoCount} photo(s) attached — review before asking about visible conditions, damage, materials, or access shown in images.`
      : "No photos uploaded.";

  return [
    "=== UNIFIED PROJECT UNDERSTANDING (synthesize ALL sources before every question) ===",
    "",
    "SOURCE PRIORITY (highest to lowest):",
    "1. Customer description — PRIMARY source of truth",
    "2. Uploaded photos — confirm or refine what the description states",
    "3. Previous interview answers — treat as confirmed facts",
    "4. Project Type field — may be generic; use only when description is vague",
    "5. Urgent flag — signals timing priority, not project details",
    "",
    "1. CUSTOMER DESCRIPTION (highest priority):",
    description,
    "",
    "2. PHOTOS:",
    photoNote,
    "",
    "3. PREVIOUS INTERVIEW ANSWERS:",
    interviewLines,
    "",
    "4. PROJECT TYPE (lowest text priority — may not match description):",
    projectType,
    input.projectType.trim() &&
    input.customerProblem.key !== "project_type" &&
    !description.toLowerCase().includes(input.projectType.toLowerCase())
      ? "Note: Project Type may conflict with the description — prefer the description."
      : null,
    "",
    "5. URGENT FLAG:",
    urgentNote,
    "",
    "PRE-QUESTION CHECK (required every step):",
    '- Ask yourself: "Do I already know this with reasonable confidence?"',
    "- If YES from description, photos, or prior answers → do NOT ask again; pick the next unknown.",
    "- If inputs conflict → resolve the conflict in known_information before asking another question.",
    "- If uncertainty remains → ask ONE targeted clarification (not a generic library question).",
    "- Never ask about facts clearly stated in the description or visible in photos.",
  ]
    .filter(Boolean)
    .join("\n");
}
