import { detectSpecialty } from "@/lib/quote-requests/specialty/detection";

export type ProblemConfidence = "high" | "medium" | "low";

export type CustomerProblem = {
  label: string;
  confidence: ProblemConfidence;
  reasoning: string;
  /** Internal routing key for scope and question selection */
  key: string;
};

type ProblemPattern = {
  key: string;
  label: string;
  patterns: RegExp[];
  reasoning: string;
  confidence: ProblemConfidence;
};

function combinedText(projectType: string, description: string): string {
  return `${projectType} ${description}`.toLowerCase();
}

const PROBLEM_PATTERNS: ProblemPattern[] = [
  {
    key: "pool_installation",
    label: "Pool installation or pool area work",
    patterns: [/\bpool\b|\bswimming pool\b|\binground pool\b|\babove[- ]ground pool\b/i],
    reasoning: "Customer mentioned a pool installation or pool-related project.",
    confidence: "high",
  },
  {
    key: "landscaping",
    label: "Landscaping / yard / lawn work",
    patterns: [
      /\blandscap/i,
      /\blawn\b|\bsod\b|\bturf\b|\bgarden\b|\bmulch\b|\bshrub/i,
      /\bbackyard\b.*\b(landscap|garden|lawn|yard work)/i,
    ],
    reasoning: "Customer described landscaping, lawn, or yard work.",
    confidence: "high",
  },
  {
    key: "roofing",
    label: "Roofing / shingles / gutters",
    patterns: [/\broof(ing)?\b|\bshingle\b|\bgutter\b|\bsoffit\b|\bfascia\b/i],
    reasoning: "Customer described roofing, shingles, or gutter work.",
    confidence: "high",
  },
  {
    key: "painting",
    label: "Interior or exterior painting",
    patterns: [/\bpaint(ing|ed|s)?\b|\bwall(s)? (paint|color)\b/i],
    reasoning: "Customer described painting work.",
    confidence: "high",
  },
  {
    key: "plumbing",
    label: "Plumbing / drains / water heater",
    patterns: [
      /\bplumb|\bdrain\b|\bwater heater\b|\bfaucet\b|\btoilet\b|\bsewer\b|\bpipe leak/i,
    ],
    reasoning: "Customer described plumbing-related work.",
    confidence: "high",
  },
  {
    key: "electrical",
    label: "Electrical work",
    patterns: [
      /\belectric|\bpanel\b|\bwiring\b|\boutlet\b|\bbreaker\b|\blight(ing)?\b|\bev charger/i,
    ],
    reasoning: "Customer described electrical work.",
    confidence: "high",
  },
  {
    key: "hvac",
    label: "HVAC / heating / cooling",
    patterns: [/\bhvac\b|\bfurnace\b|\bair condition|\bheat pump\b|\bac unit\b|\bboiler\b/i],
    reasoning: "Customer described HVAC or climate control work.",
    confidence: "high",
  },
  {
    key: "kitchen_renovation",
    label: "Kitchen renovation",
    patterns: [/\bkitchen\b.*\b(renovat|remodel|upgrade)\b|\bkitchen cabinet/i],
    reasoning: "Customer described kitchen renovation work.",
    confidence: "high",
  },
  {
    key: "bathroom_renovation",
    label: "Bathroom renovation",
    patterns: [/\bbath(room)?\b.*\b(renovat|remodel|upgrade)\b/i],
    reasoning: "Customer described bathroom renovation work.",
    confidence: "high",
  },
  {
    key: "deck_fence",
    label: "Deck / fence / patio structure",
    patterns: [/\bdeck\b|\bfence\b|\brailing\b|\bpergola\b/i],
    reasoning: "Customer described deck, fence, or outdoor structure work.",
    confidence: "high",
  },
  {
    key: "flooring",
    label: "Flooring installation or repair",
    patterns: [/\bfloor(ing)?\b|\btile\b|\bhardwood\b|\blaminate floor/i],
    reasoning: "Customer described flooring work.",
    confidence: "high",
  },
  {
    key: "concrete",
    label: "Concrete / driveway / sidewalk",
    patterns: [/\bconcrete\b|\bdriveway\b|\bsidewalk\b|\bpatio slab\b/i],
    reasoning: "Customer described concrete or flatwork.",
    confidence: "medium",
  },
  {
    key: "tree_removal",
    label: "Tree removal / stump grinding",
    patterns: [/\btree removal\b|\btree remov|\bstump grind/i],
    reasoning: "Customer described tree removal or stump work.",
    confidence: "high",
  },
  {
    key: "general_renovation",
    label: "General renovation / remodeling",
    patterns: [/\brenovat|\bremodel\b|\bdrywall\b|\bbasement finish/i],
    reasoning: "Customer described general renovation or remodeling.",
    confidence: "medium",
  },
];

/**
 * Problem-first classification: what the customer actually needs,
 * independent of the contractor's listed trade.
 */
export function classifyCustomerProblem(
  projectType: string,
  description: string
): CustomerProblem {
  const text = combinedText(projectType, description);
  const projectTypeTrimmed = projectType.trim();

  const specialty = detectSpecialty(projectType, description);
  if (specialty) {
    return {
      key: specialty.key,
      label: specialty.label,
      confidence: specialty.confidence === "high" ? "high" : "medium",
      reasoning: `Customer description indicates ${specialty.label.toLowerCase()}.`,
    };
  }

  for (const pattern of PROBLEM_PATTERNS) {
    if (pattern.patterns.some((p) => p.test(text))) {
      return {
        key: pattern.key,
        label: pattern.label,
        confidence: pattern.confidence,
        reasoning: pattern.reasoning,
      };
    }
  }

  if (projectTypeTrimmed && projectTypeTrimmed.toLowerCase() !== "other") {
    return {
      key: "project_type",
      label: projectTypeTrimmed,
      confidence: "medium",
      reasoning: `Customer selected project type "${projectTypeTrimmed}" with no more specific signals in the description.`,
    };
  }

  const descSnippet = description.trim().slice(0, 120);
  return {
    key: "general",
    label: descSnippet ? "General home improvement request" : "Unspecified project",
    confidence: "low",
    reasoning: descSnippet
      ? `Could not classify a specific trade from the description. Summary: "${descSnippet}${description.length > 120 ? "…" : ""}"`
      : "Customer did not provide enough detail to classify the problem.",
  };
}
