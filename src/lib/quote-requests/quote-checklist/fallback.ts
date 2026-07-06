import { SCOPE_FIT_BADGE_LABEL, isScopeFit, type ScopeFit } from "@/lib/quote-requests/scope-assessment";
import { computeChecklistStableKey } from "@/lib/quote-requests/quote-checklist/stable-key";
import type {
  ChecklistCategory,
  ChecklistItemDraft,
  ChecklistPriority,
  QuoteChecklistContext,
} from "@/lib/quote-requests/quote-checklist/types";

function draft(
  category: ChecklistCategory,
  title: string,
  description: string,
  priority: ChecklistPriority,
  generatedFrom: ChecklistItemDraft["generatedFrom"],
  aiReason: string,
  order: number
): ChecklistItemDraft {  return {
    stableKey: computeChecklistStableKey(category, title),
    category,
    title,
    description,
    priority,
    generatedFrom,
    aiReason,
    displayOrder: order,
  };
}

export function buildFallbackChecklist(context: QuoteChecklistContext): ChecklistItemDraft[] {
  const items: ChecklistItemDraft[] = [];
  let order = 1;

  items.push(
    draft(
      "before_contacting_customer",
      "Review customer description and photos",
      "Read the full request and any uploaded photos before calling.",
      "Critical",
      "customer_request",
      "Baseline prep before outreach",
      order++
    )
  );

  if (context.photoCount === 0) {
    items.push(
      draft(
        "before_contacting_customer",
        "Request site photos before quoting",
        "Ask the customer for photos of the work area if none were provided.",
        "Important",
        "photos",
        "No photos on file",
        order++
      )
    );
  }

  if (context.isUrgent) {
    items.push(
      draft(
        "before_contacting_customer",
        "Confirm urgency and access timeline",
        "Clarify whether immediate access or safety issues affect scheduling.",
        "Critical",
        "urgency",
        "Customer marked urgent",
        order++
      )
    );
  }

  if (context.previousAnswers.length > 0) {
    items.push(
      draft(
        "before_contacting_customer",
        "Review follow-up interview answers",
        "Use confirmed interview answers so you do not re-ask known facts.",
        "Important",
        "follow_up_answers",
        "Interview data available",
        order++
      )
    );
  }

  items.push(
    draft(
      "during_first_conversation",
      "Confirm scope and customer priorities",
      "Ask what outcome matters most: timeline, budget sensitivity, or specific finishes.",
      "Important",
      "customer_request",
      "First-call scope alignment",
      order++
    )
  );

  items.push(
    draft(
      "site_visit",
      "Inspect existing conditions on site",
      "Walk the work area and note conditions that could affect labour or materials.",
      "Critical",
      "description",
      "Site conditions affect quote accuracy",
      order++
    )
  );

  items.push(
    draft(
      "site_visit",
      "Confirm access and working space",
      "Check parking, gate access, stairs, and where materials can be staged.",
      "Important",
      "description",
      "Access affects mobilization",
      order++
    )
  );

  if (context.workComponents?.some((c) => c.capability === "unlikely_to_perform")) {
    items.push(
      draft(
        "pricing_considerations",
        "Flag specialist work for subcontractor pricing",
        "Identify components outside your core trades before finalizing your quote.",
        "Important",
        "work_components",
        "Mixed capability scope",
        order++
      )
    );
  }

  const scopeLabel =
    context.scopeFit && isScopeFit(context.scopeFit)
      ? SCOPE_FIT_BADGE_LABEL[context.scopeFit as ScopeFit]
      : null;

  if (context.scopeFit === "outside_scope" || context.scopeFit === "possibly_out_of_scope") {
    items.push(
      draft(
        "potential_risks",
        "Scope may not match your services",
        "Review scope fit before investing time in a detailed quote.",
        "Critical",
        "scope_assessment",
        scopeLabel ?? "Out of scope signal",
        order++
      )
    );
  }

  const nextAction =
    context.scopeFit === "outside_scope"
      ? draft(
          "recommended_next_action",
          "Clarify scope or decline",
          "Confirm whether any portion is in scope; otherwise decline professionally.",
          "Critical",
          "scope_assessment",
          "Outside scope",
          order++
        )
      : context.photoCount === 0
        ? draft(
            "recommended_next_action",
            "Request additional photos",
            "Ask for photos of the work area before scheduling a visit or quoting.",
            "Important",
            "photos",
            "Missing visuals",
            order++
          )
        : draft(
            "recommended_next_action",
            "Schedule site visit",
            "Book a site visit to verify measurements and conditions before quoting.",
            "Important",
            "customer_request",
            "Standard next step",
            order++
          );

  items.push(nextAction);

  return items;
}
