import type { ProjectBriefContext } from "@/lib/quote-requests/project-brief/persist";
import {
  type ProjectBrief,
  type ProjectBriefConfidence,
  type ProjectBriefStatement,
} from "@/lib/quote-requests/project-brief/types";

function statement(text: string, confidence: ProjectBriefConfidence): ProjectBriefStatement {
  return { text, confidence };
}

function findPreferredCompletionDate(
  answers: ProjectBriefContext["previousAnswers"]
): string | null {
  for (const item of answers) {
    const q = item.question.toLowerCase();
    const answer = item.answer?.trim();
    if (!answer) continue;
    if (
      item.question_type === "date" ||
      /\b(preferred|target|completion|install|start)\s+date\b/i.test(q) ||
      /\bwhen\b.*\b(done|complete|finished|ready)\b/i.test(q)
    ) {
      return answer;
    }
  }
  return null;
}

function inferProjectStage(context: ProjectBriefContext): ProjectBriefStatement {
  const desc = context.description.toLowerCase();
  const answerText = context.previousAnswers
    .map((a) => `${a.question} ${a.answer ?? ""}`)
    .join(" ")
    .toLowerCase();
  const combined = `${desc} ${answerText}`;

  if (/\b(planning|quote|estimate|explor|considering|thinking about)\b/i.test(combined)) {
    return statement("Early planning / quote stage", "likely");
  }
  if (/\b(ready to start|asap|immediately|this week|next week)\b/i.test(combined)) {
    return statement("Ready to proceed", context.interviewCompleted ? "confirmed" : "likely");
  }
  if (context.interviewCompleted && context.previousAnswers.length > 0) {
    return statement("Details gathered — ready for contractor review", "likely");
  }
  return statement("Not yet specified", "needs_verification");
}

function buildOverview(context: ProjectBriefContext, serviceLabel: string): ProjectBriefStatement[] {
  const sentences: ProjectBriefStatement[] = [];
  const desc = context.description.trim();

  if (desc) {
    const summary = desc.length > 220 ? `${desc.slice(0, 217).trimEnd()}…` : desc;
    sentences.push(
      statement(
        `${context.customerName} requested ${serviceLabel.toLowerCase()}: ${summary}`,
        context.previousAnswers.length > 0 ? "confirmed" : "likely"
      )
    );
  }

  if (context.photoCount > 0) {
    sentences.push(
      statement(
        `Customer uploaded ${context.photoCount} photo${context.photoCount === 1 ? "" : "s"} for review.`,
        "confirmed"
      )
    );
  }

  if (context.previousAnswers.length > 0) {
    sentences.push(
      statement(
        context.interviewCompleted
          ? "Follow-up interview completed with additional project details."
          : "Customer provided additional details through the follow-up interview.",
        context.interviewCompleted ? "confirmed" : "likely"
      )
    );
  }

  if (sentences.length === 0) {
    sentences.push(
      statement(
        `${context.customerName} submitted a quote request for ${serviceLabel.toLowerCase()}.`,
        "confirmed"
      )
    );
  }

  return sentences.slice(0, 3);
}

function buildKeyFacts(
  context: ProjectBriefContext,
  serviceLabel: string,
  preferredDate: string | null
): ProjectBriefStatement[] {
  const facts: ProjectBriefStatement[] = [
    statement(`Service requested: ${serviceLabel}`, "confirmed"),
    statement("Property/project description provided by customer", "confirmed"),
  ];

  if (context.isUrgent) {
    facts.push(statement("Customer marked request as urgent", "confirmed"));
  }

  if (context.photoCount > 0) {
    facts.push(
      statement(
        `${context.photoCount} photo${context.photoCount === 1 ? "" : "s"} attached`,
        "confirmed"
      )
    );
  }

  for (const item of context.previousAnswers) {
    const answer = item.answer?.trim();
    if (!answer) continue;
    facts.push(statement(`${item.question}: ${answer}`, "confirmed"));
  }

  if (preferredDate) {
    facts.push(statement(`Preferred timing discussed: ${preferredDate}`, "confirmed"));
  }

  return facts.slice(0, 12);
}

function buildItemsToVerify(context: ProjectBriefContext): ProjectBriefStatement[] {
  const items: ProjectBriefStatement[] = [];

  if (context.photoCount === 0) {
    items.push(
      statement(
        "Site conditions and access — consider requesting photos or a site visit",
        "needs_verification"
      )
    );
  }

  if (!context.interviewCompleted) {
    items.push(
      statement(
        "Project scope details — interview may still be in progress",
        "needs_verification"
      )
    );
  }

  if (!findPreferredCompletionDate(context.previousAnswers)) {
    items.push(
      statement("Customer timeline and preferred completion window", "needs_verification")
    );
  }

  items.push(
    statement("Final scope and pricing assumptions before sending a formal quote", "needs_verification")
  );

  return items.slice(0, 6);
}

function buildRecommendedNextStep(
  context: ProjectBriefContext,
  scopeFitLabel: string | null
): ProjectBriefStatement {
  if (context.scopeFit === "outside_scope" || context.scopeFit === "possibly_out_of_scope") {
    return statement(
      "Review scope fit and decide whether to decline or request clarification before investing more time.",
      "likely"
    );
  }
  if (!context.interviewCompleted && context.previousAnswers.length === 0) {
    return statement(
      "Review the customer description and photos, then wait for follow-up interview answers or reach out with one clarifying question.",
      "likely"
    );
  }
  if (scopeFitLabel?.includes("Mixed") || context.scopeFit === "mixed_scope") {
    return statement(
      "Confirm which portions of the work you will perform before scheduling a site visit or preparing a quote.",
      "likely"
    );
  }
  return statement(
    "Schedule a site visit or send a preliminary quote based on the information gathered so far.",
    "likely"
  );
}

export function buildFallbackProjectBrief(
  context: ProjectBriefContext,
  scopeFitLabel: string | null,
  customerProblemLabel: string
): ProjectBrief {
  const serviceLabel =
    context.customerProblemLabel?.trim() || customerProblemLabel || context.projectType;
  const preferredDate = findPreferredCompletionDate(context.previousAnswers);
  const urgencyText = context.isUrgent ? "Urgent" : "Standard";
  const photosText =
    context.photoCount > 0
      ? `${context.photoCount} photo${context.photoCount === 1 ? "" : "s"}`
      : "None";
  const interviewText = context.interviewCompleted
    ? "Yes"
    : context.previousAnswers.length > 0
      ? "In progress"
      : "Not started";
  const scopeText = scopeFitLabel ?? "Not yet assessed";

  return {
    version: 1,
    overview: buildOverview(context, serviceLabel),
    snapshot: {
      serviceRequested: statement(serviceLabel, "confirmed"),
      urgency: statement(urgencyText, context.isUrgent ? "confirmed" : "likely"),
      projectStage: inferProjectStage(context),
      preferredCompletionDate: preferredDate ? statement(preferredDate, "confirmed") : null,
      photosReceived: statement(photosText, "confirmed"),
      interviewCompleted: statement(
        interviewText,
        context.interviewCompleted ? "confirmed" : "likely"
      ),
      likelyScopeFit: statement(
        scopeText,
        context.scopeFit ? "likely" : "needs_verification"
      ),
    },
    keyFacts: buildKeyFacts(context, serviceLabel, preferredDate),
    itemsToVerify: buildItemsToVerify(context),
    potentialRisks: [],
    risksNoneMessage: "No obvious concerns identified.",
    recommendedNextStep: buildRecommendedNextStep(context, scopeFitLabel),
    generatedAt: new Date().toISOString(),
  };
}
