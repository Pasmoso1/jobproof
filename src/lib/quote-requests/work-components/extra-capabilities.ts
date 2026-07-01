import type {
  ComponentCapability,
  WorkComponentKey,
} from "@/lib/quote-requests/work-components/types";

type CapabilityMap = Partial<Record<WorkComponentKey, ComponentCapability>>;

type ExtraCapabilityRule = {
  pattern: RegExp;
  keys: WorkComponentKey[];
  /** Upgrade strength when matched — default may_perform */
  strength?: ComponentCapability;
};

const CAPABILITY_RANK: Record<ComponentCapability, number> = {
  unlikely_to_perform: 0,
  may_perform: 1,
  clearly_performs: 2,
};

function upgradeCapability(
  current: ComponentCapability | undefined,
  target: ComponentCapability
): ComponentCapability {
  const cur = current ?? "unlikely_to_perform";
  return CAPABILITY_RANK[target] > CAPABILITY_RANK[cur] ? target : cur;
}

/**
 * Maps contractor free-text extra capabilities to work component upgrades.
 * Only upgrades capability — never downgrades or blanket within-scope.
 */
const EXTRA_CAPABILITY_RULES: ExtraCapabilityRule[] = [
  { pattern: /\bfenc(e|ing)\b/i, keys: ["fencing"], strength: "clearly_performs" },
  { pattern: /\bpergola\b/i, keys: ["decking"], strength: "clearly_performs" },
  { pattern: /\bconcrete pad(s)?\b|\bconcrete flatwork\b/i, keys: ["concrete"], strength: "clearly_performs" },
  { pattern: /\bdrainage\b|\bfrench drain\b|\bdrain tile\b/i, keys: ["drainage"], strength: "clearly_performs" },
  {
    pattern: /\bretaining wall(s)?\b/i,
    keys: ["masonry", "landscaping"],
    strength: "clearly_performs",
  },
  { pattern: /\bdeck(s|ing)?\b/i, keys: ["decking"], strength: "clearly_performs" },
  { pattern: /\blandscap/i, keys: ["landscaping"], strength: "clearly_performs" },
  { pattern: /\bgrad(e|ing)\b/i, keys: ["grading"], strength: "clearly_performs" },
  { pattern: /\bwaterproof/i, keys: ["waterproofing"], strength: "clearly_performs" },
  { pattern: /\bfoundation repair\b|\bfoundation crack\b/i, keys: ["waterproofing", "concrete"], strength: "may_perform" },
  { pattern: /\bpool install/i, keys: ["pool_installation"], strength: "clearly_performs" },
  { pattern: /\btile\b/i, keys: ["tile", "flooring"], strength: "may_perform" },
  { pattern: /\bdrywall\b/i, keys: ["drywall"], strength: "clearly_performs" },
  { pattern: /\bpaint(ing|er)?\b/i, keys: ["painting"], strength: "clearly_performs" },
  { pattern: /\bplumb/i, keys: ["plumbing"], strength: "clearly_performs" },
  { pattern: /\belectric/i, keys: ["electrical"], strength: "clearly_performs" },
  { pattern: /\broof/i, keys: ["roofing"], strength: "clearly_performs" },
  { pattern: /\bhvac\b|\bfurnace\b|\bair condition/i, keys: ["hvac"], strength: "clearly_performs" },
  { pattern: /\bfloor(ing)?\b/i, keys: ["flooring"], strength: "clearly_performs" },
  { pattern: /\bkitchen\b/i, keys: ["kitchen_renovation"], strength: "may_perform" },
  { pattern: /\bbath(room)?\b/i, keys: ["bathroom_renovation"], strength: "may_perform" },
  { pattern: /\bwindow(s)?\b|\bdoor(s)?\b/i, keys: ["windows_doors"], strength: "may_perform" },
  { pattern: /\bdemolition\b|\bdemo work\b/i, keys: ["demolition"], strength: "clearly_performs" },
  { pattern: /\bexcavat/i, keys: ["excavation"], strength: "may_perform" },
  { pattern: /\bframing\b|\bframe work\b/i, keys: ["framing"], strength: "clearly_performs" },
  { pattern: /\bcabinet/i, keys: ["cabinetry"], strength: "may_perform" },
  { pattern: /\binsulat/i, keys: ["insulation"], strength: "may_perform" },
  { pattern: /\brenovat/i, keys: ["general_renovation"], strength: "may_perform" },
];

/** Apply contractor-provided extra capabilities as conservative capability upgrades. */
export function applyExtraCapabilitiesToMap(
  map: CapabilityMap,
  extraCapabilitiesText: string | null | undefined,
  options?: { supportingOnly?: boolean }
): CapabilityMap {
  const text = extraCapabilitiesText?.trim();
  if (!text) return map;

  const result: CapabilityMap = { ...map };

  for (const rule of EXTRA_CAPABILITY_RULES) {
    if (!rule.pattern.test(text)) continue;
    let strength = rule.strength ?? "may_perform";
    if (options?.supportingOnly && strength === "clearly_performs") {
      strength = "may_perform";
    }
    for (const key of rule.keys) {
      result[key] = upgradeCapability(result[key], strength);
    }
  }

  return result;
}

/** Whether any work component received an upgrade from extra capabilities text. */
export function extraCapabilitiesMatchText(
  extraCapabilitiesText: string | null | undefined,
  componentKey: WorkComponentKey
): boolean {
  const text = extraCapabilitiesText?.trim();
  if (!text) return false;
  return EXTRA_CAPABILITY_RULES.some(
    (rule) => rule.keys.includes(componentKey) && rule.pattern.test(text)
  );
}
