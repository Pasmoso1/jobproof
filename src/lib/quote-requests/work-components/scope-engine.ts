import type { PreviousInterviewAnswer } from "@/lib/quote-requests/follow-up-types";
import type { CustomerProblem, ProblemConfidence } from "@/lib/quote-requests/problem-classification";
import type { ScopeAssessment, ScopeFit } from "@/lib/quote-requests/scope-assessment";
import {
  contractorCapabilityForComponent,
  contractorProfileFromTrade,
} from "@/lib/quote-requests/work-components/contractor-capabilities";
import {
  decomposeWorkComponents,
  descriptionConflictsWithProjectType,
  specialistTradesForComponents,
} from "@/lib/quote-requests/work-components/decomposition";
import {
  COMPONENT_TYPICAL_SPECIALIST,
  workComponentLabel,
} from "@/lib/quote-requests/work-components/labels";
import type {
  ComponentCapability,
  ContractorCapabilityProfile,
  StoredWorkComponent,
  WorkComponentKey,
  WorkComponentMatch,
  WorkScopeAnalysis,
} from "@/lib/quote-requests/work-components/types";

export type AssessScopeInput = {
  customerProblem: CustomerProblem;
  tradeLabel: string | null;
  primaryTrade: string | null;
  primaryTradeOther: string | null;
  extraCapabilities?: string | null;
  projectType: string;
  description: string;
  previousAnswers?: PreviousInterviewAnswer[];
};

function matchComponents(
  componentKeys: WorkComponentKey[],
  profile: ContractorCapabilityProfile
): WorkComponentMatch[] {
  return componentKeys.map((key) => {
    const capability = contractorCapabilityForComponent(profile, key);
    const typicalSpecialist = COMPONENT_TYPICAL_SPECIALIST[key];
    return {
      key,
      label: workComponentLabel(key),
      capability,
      typicalSpecialist:
        capability === "unlikely_to_perform" ? typicalSpecialist : undefined,
    };
  });
}

function computeConfidence(input: {
  customerProblem: CustomerProblem;
  components: WorkComponentMatch[];
  specialistTrades: string[];
  projectType: string;
  description: string;
  capabilities: ComponentCapability[];
}): ProblemConfidence {
  let confidence: ProblemConfidence = input.customerProblem.confidence;

  const clearlyCount = input.capabilities.filter((c) => c === "clearly_performs").length;
  const unlikelyCount = input.capabilities.filter((c) => c === "unlikely_to_perform").length;
  const mayCount = input.capabilities.filter((c) => c === "may_perform").length;

  const downgrade = (): void => {
    confidence = confidence === "high" ? "medium" : "low";
  };

  if (input.components.length >= 4) downgrade();
  if (input.specialistTrades.length >= 3) downgrade();
  if (clearlyCount > 0 && unlikelyCount > 0) downgrade();
  if (mayCount >= 2 && clearlyCount === 0) downgrade();
  if (
    descriptionConflictsWithProjectType(
      input.projectType,
      input.description,
      input.customerProblem.key
    )
  ) {
    downgrade();
  }
  if (input.description.trim().length < 30) downgrade();
  if (input.customerProblem.confidence === "low") confidence = "low";

  if (
    confidence === "high" &&
    (unlikelyCount > 0 || mayCount > clearlyCount || input.components.length >= 3)
  ) {
    confidence = "medium";
  }

  return confidence;
}

function deriveScopeFit(
  capabilities: ComponentCapability[],
  confidence: ProblemConfidence
): ScopeFit {
  const clearly = capabilities.filter((c) => c === "clearly_performs").length;
  const may = capabilities.filter((c) => c === "may_perform").length;
  const unlikely = capabilities.filter((c) => c === "unlikely_to_perform").length;
  const total = capabilities.length;

  if (total === 0) return "possibly_out_of_scope";

  if (unlikely === total) return "outside_scope";
  if (unlikely > clearly && unlikely >= may) return "outside_scope";

  if (clearly > 0 && unlikely > 0) return "mixed_scope";
  if (may > 0 && unlikely > 0) return "mixed_scope";
  if (clearly > 0 && may > 0) return "mixed_scope";

  if (clearly === total && total <= 2 && confidence === "high") return "within_scope";

  if (may === total || (clearly > 0 && may > 0)) return "mixed_scope";
  if (unlikely > 0 && clearly === 0) return "possibly_out_of_scope";

  if (confidence !== "high") return "mixed_scope";

  if (clearly === total) return "within_scope";

  return "mixed_scope";
}

function buildMatchSummary(
  components: WorkComponentMatch[],
  tradeLabel: string | null
): string {
  const trade = tradeLabel?.trim() || "This contractor";
  const clearly = components.filter((c) => c.capability === "clearly_performs");
  const may = components.filter((c) => c.capability === "may_perform");
  const unlikely = components.filter((c) => c.capability === "unlikely_to_perform");

  const parts: string[] = [];

  if (clearly.length > 0) {
    parts.push(
      `${trade} likely handles: ${clearly.map((c) => c.label.toLowerCase()).join(", ")}.`
    );
  }
  if (may.length > 0) {
    parts.push(
      `May handle: ${may.map((c) => c.label.toLowerCase()).join(", ")} — confirm before quoting.`
    );
  }
  if (unlikely.length > 0) {
    const withSpecialists = unlikely
      .map((c) =>
        c.typicalSpecialist
          ? `${c.label.toLowerCase()} (typically ${c.typicalSpecialist})`
          : c.label.toLowerCase()
      )
      .join(", ");
    parts.push(`Unlikely to handle: ${withSpecialists}.`);
  }

  return parts.join(" ") || "Review project details to confirm fit.";
}

function formatContractorNote(input: {
  customerProblem: CustomerProblem;
  components: WorkComponentMatch[];
  confidence: ProblemConfidence;
  matchSummary: string;
}): string {
  const workList = input.components.map((c) => c.label).join(", ");
  return [
    `Detected project: ${input.customerProblem.label}`,
    `Work likely involved: ${workList}`,
    `Why this may or may not match: ${input.matchSummary}`,
    `Confidence: ${input.confidence.charAt(0).toUpperCase()}${input.confidence.slice(1)}`,
  ].join("\n\n");
}

function buildReason(fit: ScopeFit, components: WorkComponentMatch[]): string {
  const clearly = components.filter((c) => c.capability === "clearly_performs").length;
  const unlikely = components.filter((c) => c.capability === "unlikely_to_perform").length;

  switch (fit) {
    case "within_scope":
      return `Required work (${components.length} component${components.length === 1 ? "" : "s"}) aligns with contractor capabilities.`;
    case "mixed_scope":
      return `Project requires ${components.length} work types; ${clearly} match clearly, ${unlikely} may need a specialist.`;
    case "outside_scope":
      return `Most required work (${unlikely} of ${components.length} components) is outside contractor capabilities.`;
    case "possibly_out_of_scope":
      return "Work requirements are unclear or span multiple trades — review before committing.";
  }
}

/** Work-component scope engine: decompose project → compare each component → aggregate fit. */
export function assessScopeFromWork(input: AssessScopeInput): WorkScopeAnalysis {
  const profile = contractorProfileFromTrade({
    tradeLabel: input.tradeLabel,
    primaryTrade: input.primaryTrade,
    primaryTradeOther: input.primaryTradeOther,
    extraCapabilities: input.extraCapabilities,
  });

  const componentKeys = decomposeWorkComponents({
    projectType: input.projectType,
    description: input.description,
    customerProblem: input.customerProblem,
    previousAnswers: input.previousAnswers,
  });

  const components = matchComponents(componentKeys, profile);
  const capabilities = components.map((c) => c.capability);
  const specialistTrades = specialistTradesForComponents(componentKeys);

  const confidence = computeConfidence({
    customerProblem: input.customerProblem,
    components,
    specialistTrades,
    projectType: input.projectType,
    description: input.description,
    capabilities,
  });

  const fit = deriveScopeFit(capabilities, confidence);
  const matchSummary = buildMatchSummary(components, input.tradeLabel);
  const contractorNote = formatContractorNote({
    customerProblem: input.customerProblem,
    components,
    confidence,
    matchSummary,
  });

  return {
    customerProblemLabel: input.customerProblem.label,
    workComponents: components,
    specialistTrades,
    confidence,
    fit,
    reason: buildReason(fit, components),
    contractorNote,
    customerClarificationNeeded: fit !== "within_scope" || confidence !== "high",
    matchSummary,
  };
}

export function workScopeToScopeAssessment(analysis: WorkScopeAnalysis): ScopeAssessment {
  return {
    fit: analysis.fit,
    reason: analysis.reason,
    contractorNote: analysis.contractorNote,
    customerClarificationNeeded: analysis.customerClarificationNeeded,
    confidence: analysis.confidence,
    workComponents: analysis.workComponents.map(
      (c): StoredWorkComponent => ({
        key: c.key,
        label: c.label,
        capability: c.capability,
        typicalSpecialist: c.typicalSpecialist,
      })
    ),
    specialistTrades: analysis.specialistTrades,
  };
}

export function assessScopeFit(input: {
  customerProblem: CustomerProblem;
  tradeLabel: string | null;
  primaryTrade: string | null;
  primaryTradeOther?: string | null;
  extraCapabilities?: string | null;
  projectType?: string;
  description?: string;
  previousAnswers?: PreviousInterviewAnswer[];
}): ScopeAssessment {
  const analysis = assessScopeFromWork({
    customerProblem: input.customerProblem,
    tradeLabel: input.tradeLabel,
    primaryTrade: input.primaryTrade,
    primaryTradeOther: input.primaryTradeOther ?? null,
    extraCapabilities: input.extraCapabilities ?? null,
    projectType: input.projectType ?? "",
    description: input.description ?? "",
    previousAnswers: input.previousAnswers,
  });
  return workScopeToScopeAssessment(analysis);
}

export function storedWorkComponentsToSummary(
  components: StoredWorkComponent[] | null | undefined
): string | null {
  if (!components?.length) return null;
  return components.map((c) => c.label).join(", ");
}
