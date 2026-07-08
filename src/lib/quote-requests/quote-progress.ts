import type { ProjectBrief } from "@/lib/quote-requests/project-brief/types";
import { parseProjectBrief } from "@/lib/quote-requests/project-brief/types";
import type { QuoteRequestEvent, QuoteRequestStatusType } from "@/types/database";

export const QUOTE_PROGRESS_STEP_KEYS = [
  "request_received",
  "project_understood",
  "customer_contacted",
  "site_visit_completed",
  "quote_prepared",
  "quote_sent",
  "customer_decision",
] as const;

export type QuoteProgressStepKey = (typeof QUOTE_PROGRESS_STEP_KEYS)[number];

export type QuoteProgressStepState = "complete" | "current" | "not_started";

export type QuoteProgressStepVariant = "default" | "success" | "closed";

export type QuoteProgressStep = {
  key: QuoteProgressStepKey;
  label: string;
  state: QuoteProgressStepState;
  description?: string;
  variant?: QuoteProgressStepVariant;
};

export type QuoteProgress = {
  steps: QuoteProgressStep[];
};

const STEP_LABELS: Record<QuoteProgressStepKey, string> = {
  request_received: "Request received",
  project_understood: "Project understood",
  customer_contacted: "Customer contacted",
  site_visit_completed: "Site visit completed",
  quote_prepared: "Quote prepared",
  quote_sent: "Quote sent",
  customer_decision: "Customer decision",
};

const CONTACTED_STATUSES: QuoteRequestStatusType[] = [
  "reviewed",
  "responded",
  "site_visit_requested",
  "converted",
];

/** Event types that indicate outbound email/SMS to the customer. */
const COMMUNICATION_EVENT_PATTERNS = [
  /^declined_/,
  /_email_sent$/,
  /_sms_sent$/,
  /^customer_email_/,
  /^customer_sms_/,
];

export function hasCustomerCommunicationEvent(events: QuoteRequestEvent[]): boolean {
  return events.some((event) => {
    const type = event.event_type.trim().toLowerCase();
    return COMMUNICATION_EVENT_PATTERNS.some((pattern) => pattern.test(type));
  });
}

function hasSiteVisitCompletedEvent(events: QuoteRequestEvent[]): boolean {
  return events.some((event) => {
    const type = event.event_type.trim().toLowerCase();
    return type === "site_visit_completed" || type === "site_visit_done";
  });
}

export type QuoteProgressInput = {
  status: QuoteRequestStatusType;
  projectBrief: ProjectBrief | null;
  projectBriefRaw: unknown;
  events: QuoteRequestEvent[];
  /** Quote builder has a draft ready or estimate linked */
  hasLinkedEstimate?: boolean;
  /** Quote delivered to customer */
  estimateSent?: boolean;
};

function isStepComplete(
  key: QuoteProgressStepKey,
  input: QuoteProgressInput
): boolean {
  switch (key) {
    case "request_received":
      return true;
    case "project_understood":
      return Boolean(
        input.projectBrief ?? parseProjectBrief(input.projectBriefRaw)
      );
    case "customer_contacted":
      return (
        CONTACTED_STATUSES.includes(input.status) ||
        hasCustomerCommunicationEvent(input.events)
      );
    case "site_visit_completed":
      return hasSiteVisitCompletedEvent(input.events);
    case "quote_prepared":
      return Boolean(input.hasLinkedEstimate);
    case "quote_sent":
      return Boolean(input.estimateSent);
    case "customer_decision":
      return input.status === "converted" || input.status === "closed";
  }
}

function stepDescription(
  key: QuoteProgressStepKey,
  input: QuoteProgressInput,
  complete: boolean
): string | undefined {
  if (complete) return undefined;

  switch (key) {
    case "project_understood":
      return "Project Brief will appear once generated.";
    case "customer_contacted":
      return "Mark reviewed or respond when you have reached out.";
    case "site_visit_completed":
      if (input.status === "site_visit_requested") {
        return "Site visit requested — confirm when the visit is done.";
      }
      return "Schedule and complete a site visit when needed.";
    case "quote_prepared":
      return "Prepare your quote when site details are confirmed.";
    case "quote_sent":
      return "Send the quote to the customer when ready.";
    case "customer_decision":
      return "Awaiting customer decision.";
    default:
      return undefined;
  }
}

function decisionVariant(
  status: QuoteRequestStatusType
): QuoteProgressStepVariant | undefined {
  if (status === "converted") return "success";
  if (status === "closed") return "closed";
  return undefined;
}

export function buildQuoteProgress(input: QuoteProgressInput): QuoteProgress {
  const completed = QUOTE_PROGRESS_STEP_KEYS.map((key) => isStepComplete(key, input));
  const terminalDecision =
    input.status === "converted" || input.status === "closed";

  let currentIndex: number;
  if (terminalDecision) {
    currentIndex = -1;
  } else {
    currentIndex = completed.findIndex((c) => !c);
    if (currentIndex === -1) {
      currentIndex = QUOTE_PROGRESS_STEP_KEYS.length - 1;
    }
  }

  const steps: QuoteProgressStep[] = QUOTE_PROGRESS_STEP_KEYS.map((key, index) => {
    const isComplete = completed[index];
    let state: QuoteProgressStepState;
    if (isComplete) {
      state = "complete";
    } else if (index === currentIndex) {
      state = "current";
    } else {
      state = "not_started";
    }

    const variant =
      key === "customer_decision" && isComplete
        ? decisionVariant(input.status)
        : undefined;

    return {
      key,
      label: STEP_LABELS[key],
      state,
      description: stepDescription(key, input, isComplete),
      variant,
    };
  });

  return { steps };
}
