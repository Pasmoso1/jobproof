import { generateUUID } from "@/lib/utils/uuid";
import type { FollowUpQuestion } from "@/lib/quote-requests/follow-up-types";

function withIds(questions: Omit<FollowUpQuestion, "id">[]): FollowUpQuestion[] {
  return questions.map((q) => ({ ...q, id: generateUUID() }));
}

/**
 * Generic follow-up questions when AI is unavailable.
 */
export function getGenericFollowUpQuestions(
  projectType: string,
  tradeLabel: string | null
): FollowUpQuestion[] {
  const project = projectType.trim() || "your project";
  const trade = tradeLabel?.trim();

  const questions: Omit<FollowUpQuestion, "id">[] = [
    {
      question: `When would you ideally like ${project} to start?`,
      question_type: "date",
      display_order: 1,
    },
    {
      question: "Do you have a target budget range in mind?",
      question_type: "multiple_choice",
      options: ["Under $5,000", "$5,000–$15,000", "$15,000–$30,000", "$30,000+", "Not sure yet"],
      display_order: 2,
    },
    {
      question: "Will someone be on site to provide access for a site visit?",
      question_type: "yes_no",
      display_order: 3,
    },
    {
      question: "Is there anything else the contractor should know before contacting you?",
      question_type: "short_text",
      display_order: 4,
    },
  ];

  if (trade) {
    questions.splice(1, 0, {
      question: `For this ${trade.toLowerCase()} project, are materials already on site?`,
      question_type: "yes_no",
      display_order: 2,
    });
    questions.forEach((q, i) => {
      q.display_order = i + 1;
    });
  }

  return withIds(questions.slice(0, 6));
}
