import type { PreviousInterviewAnswer } from "@/lib/quote-requests/follow-up-types";
import type { CustomerProblem } from "@/lib/quote-requests/problem-classification";
import {
  COMPONENT_TYPICAL_SPECIALIST,
  workComponentLabel,
} from "@/lib/quote-requests/work-components/labels";
import type { WorkComponentKey } from "@/lib/quote-requests/work-components/types";

type DecomposeInput = {
  projectType: string;
  description: string;
  customerProblem: CustomerProblem;
  previousAnswers?: PreviousInterviewAnswer[];
};

function combinedContext(input: DecomposeInput): string {
  const answers = (input.previousAnswers ?? [])
    .map((a) => `${a.question} ${a.answer ?? ""}`)
    .join(" ");
  return `${input.description} ${answers}`.toLowerCase();
}

function addUnique(set: Set<WorkComponentKey>, ...keys: WorkComponentKey[]): void {
  for (const key of keys) {
    set.add(key);
  }
}

/** Infer contextual work signals beyond single keywords */
function inferFromDescription(text: string, components: Set<WorkComponentKey>): void {
  if (/\b(demo(lish)?|tear out|tear-down|gut)\b/i.test(text)) {
    addUnique(components, "demolition", "removal");
  }
  if (/\b(haul|dispose|junk|remove old|take out)\b/i.test(text)) {
    addUnique(components, "removal");
  }
  if (/\b(dig|excavat|trench)\b/i.test(text)) {
    addUnique(components, "excavation");
  }
  if (/\b(re-?grad|slope|level (the )?yard|negative grade)\b/i.test(text)) {
    addUnique(components, "grading");
  }
  if (/\b(french drain|swale|downspout|drainage|weeping tile|sump)\b/i.test(text)) {
    addUnique(components, "drainage");
  }
  if (/\b(fram(e|ing)|stud wall|load-?bearing)\b/i.test(text)) {
    addUnique(components, "framing");
  }
  if (/\b(concrete|driveway|sidewalk|slab|patio slab|footing)\b/i.test(text)) {
    addUnique(components, "concrete");
  }
  if (/\b(brick|stone|block|mason)\b/i.test(text)) {
    addUnique(components, "masonry");
  }
  if (/\b(paint|stain|coat(ing)?)\b/i.test(text)) {
    addUnique(components, "painting");
  }
  if (/\b(drywall|sheetrock|mud and tape)\b/i.test(text)) {
    addUnique(components, "drywall");
  }
  if (/\b(plumb|pipe|drain|faucet|toilet|water heater|sewer)\b/i.test(text)) {
    addUnique(components, "plumbing");
  }
  if (/\b(electric|wiring|panel|outlet|breaker|light(ing)?)\b/i.test(text)) {
    addUnique(components, "electrical");
  }
  if (/\b(hvac|furnace|air condition|heat pump|boiler|ac unit)\b/i.test(text)) {
    addUnique(components, "hvac");
  }
  if (/\b(roof|shingle|soffit|fascia|gutter)\b/i.test(text)) {
    addUnique(components, "roofing");
  }
  if (/\b(floor(ing)?|hardwood|laminate|tile floor)\b/i.test(text)) {
    addUnique(components, "flooring");
  }
  if (/\b(waterproof|foundation crack|basement leak|seepage|water intrusion)\b/i.test(text)) {
    addUnique(components, "waterproofing", "concrete");
  }
  if (/\b(landscap|lawn|garden|sod|mulch|shrub|plant)\b/i.test(text)) {
    addUnique(components, "landscaping");
  }
  if (/\b(fence|railing|gate)\b/i.test(text)) {
    addUnique(components, "fencing");
  }
  if (/\b(deck|patio|pergola)\b/i.test(text)) {
    addUnique(components, "decking");
  }
  if (/\b(trim|millwork|cabinet install|finish carpentry)\b/i.test(text)) {
    addUnique(components, "finish_carpentry");
  }
  if (/\b(inground pool|above[- ]ground pool|swimming pool|pool install)\b/i.test(text)) {
    addUnique(components, "pool_installation", "excavation");
  }
  if (/\b(kitchen|cabinets|countertop|backsplash)\b/i.test(text)) {
    addUnique(components, "kitchen_renovation", "cabinetry", "plumbing", "electrical");
  }
  if (/\b(bathroom|shower|tub|vanity)\b/i.test(text)) {
    addUnique(components, "bathroom_renovation", "plumbing", "tile");
  }
  if (/\b(window|door|entry door|patio door)\b/i.test(text)) {
    addUnique(components, "windows_doors");
  }
  if (/\b(tile\b|backsplash|ceramic|porcelain)\b/i.test(text)) {
    addUnique(components, "tile");
  }
  if (/\b(insulat|vapor barrier|spray foam)\b/i.test(text)) {
    addUnique(components, "insulation");
  }
  if (/\b(renovat|remodel|finish(ed)? basement)\b/i.test(text)) {
    addUnique(components, "general_renovation", "drywall", "finish_carpentry");
  }
}

function baseComponentsForProblem(problemKey: string): WorkComponentKey[] {
  switch (problemKey) {
    case "foundation_waterproofing":
      return ["waterproofing", "concrete"];
    case "exterior_drainage":
      return ["drainage", "grading", "landscaping"];
    case "pool_installation":
      return ["pool_installation", "excavation", "concrete", "plumbing", "electrical", "landscaping"];
    case "landscaping":
      return ["landscaping"];
    case "roofing":
      return ["roofing"];
    case "painting":
      return ["painting"];
    case "plumbing":
      return ["plumbing"];
    case "electrical":
      return ["electrical"];
    case "hvac":
      return ["hvac"];
    case "kitchen_renovation":
      return ["kitchen_renovation", "cabinetry", "plumbing", "electrical", "flooring", "drywall"];
    case "bathroom_renovation":
      return ["bathroom_renovation", "plumbing", "tile", "electrical"];
    case "deck_fence":
      return ["decking", "fencing", "framing", "concrete"];
    case "flooring":
      return ["flooring"];
    case "concrete":
      return ["concrete"];
    case "tree_removal":
      return ["removal", "landscaping"];
    case "general_renovation":
      return ["general_renovation"];
    default:
      return ["general_renovation"];
  }
}

function projectTypeHintComponents(projectType: string): WorkComponentKey[] {
  const pt = projectType.trim().toLowerCase();
  if (!pt || pt === "other") return [];

  const hints: WorkComponentKey[] = [];
  if (pt.includes("landscap")) hints.push("landscaping");
  if (pt.includes("paint")) hints.push("painting");
  if (pt.includes("roof")) hints.push("roofing");
  if (pt.includes("plumb")) hints.push("plumbing");
  if (pt.includes("electric")) hints.push("electrical");
  if (pt.includes("hvac")) hints.push("hvac");
  if (pt.includes("floor")) hints.push("flooring");
  if (pt.includes("deck") || pt.includes("fence")) hints.push("decking", "fencing");
  if (pt.includes("renovat")) hints.push("general_renovation");
  if (pt.includes("kitchen")) hints.push("kitchen_renovation");
  if (pt.includes("bath")) hints.push("bathroom_renovation");
  return hints;
}

export function descriptionConflictsWithProjectType(
  projectType: string,
  description: string,
  problemKey: string
): boolean {
  const pt = projectType.trim().toLowerCase();
  const desc = description.trim().toLowerCase();
  if (!pt || pt === "other" || !desc) return false;

  const specialistProblems = [
    "foundation_waterproofing",
    "pool_installation",
    "electrical",
    "plumbing",
    "hvac",
    "roofing",
  ];

  if (specialistProblems.includes(problemKey) && pt.includes("landscap") && !desc.includes("landscap")) {
    return true;
  }
  if (problemKey === "landscaping" && (pt.includes("plumb") || pt.includes("electric"))) {
    return true;
  }
  if (problemKey === "pool_installation" && pt.includes("landscap") && desc.includes("full pool")) {
    return true;
  }

  const ptHints = projectTypeHintComponents(projectType);
  const problemBases = baseComponentsForProblem(problemKey);
  if (ptHints.length === 0 || problemBases.length === 0) return false;

  const overlap = ptHints.some((h) => problemBases.includes(h));
  return !overlap && problemKey !== "general" && problemKey !== "project_type";
}

/**
 * Decompose a project into individual work components.
 * Description and interview answers drive inference; project type is a hint only.
 */
export function decomposeWorkComponents(input: DecomposeInput): WorkComponentKey[] {
  const components = new Set<WorkComponentKey>(baseComponentsForProblem(input.customerProblem.key));
  const context = combinedContext(input);

  inferFromDescription(context, components);
  inferFromDescription(input.description, components);

  const descriptionIsVague = input.description.trim().length < 40;
  if (descriptionIsVague) {
    for (const hint of projectTypeHintComponents(input.projectType)) {
      components.add(hint);
    }
  }

  if (input.customerProblem.key === "pool_installation") {
    const aroundPoolOnly =
      /\baround (a |the )?pool\b|\blandscap.*pool\b|\bexisting pool\b/i.test(context) &&
      !/\bfull pool install|\binground pool install|\bnew pool\b/i.test(context);
    if (aroundPoolOnly) {
      components.delete("pool_installation");
      addUnique(components, "landscaping", "decking", "concrete");
    }
  }

  if (input.customerProblem.key === "foundation_waterproofing") {
    if (/\bdrain|grad|exterior|outside\b/i.test(context)) {
      addUnique(components, "drainage", "grading");
    }
    if (/\bfinished basement|drywall|paneling\b/i.test(context)) {
      addUnique(components, "drywall", "finish_carpentry");
    }
  }

  return Array.from(components);
}

export function specialistTradesForComponents(keys: WorkComponentKey[]): string[] {
  const trades = new Set<string>();
  for (const key of keys) {
    const specialist = COMPONENT_TYPICAL_SPECIALIST[key];
    if (specialist) trades.add(specialist);
  }
  return Array.from(trades);
}

export function componentKeysToLabels(keys: WorkComponentKey[]): string[] {
  return keys.map((k) => workComponentLabel(k));
}
