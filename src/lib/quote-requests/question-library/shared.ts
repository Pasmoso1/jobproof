import { defineSharedQuestions } from "@/lib/quote-requests/question-library/builder";

/** Cross-trade questions used by every follow-up flow. */
export const SHARED_LIBRARY_QUESTIONS = defineSharedQuestions([
  {
    id: "shared_timeline_completion",
    category: "timeline",
    priority: "high",
    question: "When would you ideally like this project to be completed?",
    questionType: "multiple_choice",
    choices: [
      "As soon as possible",
      "Within 1 month",
      "Within 2–3 months",
      "This season",
      "I'm flexible",
      "Specific date",
    ],
    requiredInformation: "Desired project completion timeframe",
    tags: ["timeline", "completion", "schedule"],
  },
  {
    id: "shared_move_forward",
    category: "customer_preferences",
    priority: "very_high",
    question: "How soon are you hoping to move forward?",
    questionType: "multiple_choice",
    choices: [
      "Ready to hire now",
      "Within the next month",
      "Within the next 3 months",
      "Just gathering information",
    ],
    requiredInformation: "Customer readiness to hire and project urgency",
    tags: ["lead_qualification", "timing", "readiness"],
  },
  {
    id: "shared_site_access",
    category: "access_removal",
    priority: "medium",
    question: "Will someone be on site to provide access for a site visit?",
    questionType: "yes_no",
    requiredInformation: "Site visit access availability",
    tags: ["access", "site_visit"],
  },
  {
    id: "shared_specific_date",
    category: "timeline",
    priority: "medium",
    question: "If you have a specific target date in mind, what is it?",
    questionType: "date",
    requiredInformation: "Specific target completion or start date",
    tags: ["timeline", "specific_date"],
  },
  {
    id: "shared_additional_notes",
    category: "customer_preferences",
    priority: "low",
    question: "Is there anything else the contractor should know before contacting you?",
    questionType: "short_text",
    requiredInformation: "Additional customer context not captured elsewhere",
    tags: ["notes", "context"],
  },
]);
