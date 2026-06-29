import type {
  ComponentCapability,
  ContractorCapabilityProfile,
  WorkComponentKey,
} from "@/lib/quote-requests/work-components/types";
import { applyExtraCapabilitiesToMap } from "@/lib/quote-requests/work-components/extra-capabilities";

type CapabilityMap = Partial<Record<WorkComponentKey, ComponentCapability>>;

const DEFAULT_UNLISTED: ComponentCapability = "unlikely_to_perform";

const TRADE_CAPABILITY_MAP: Record<string, CapabilityMap> = {
  Landscaper: {
    landscaping: "clearly_performs",
    grading: "clearly_performs",
    drainage: "clearly_performs",
    fencing: "may_perform",
    decking: "may_perform",
    concrete: "may_perform",
    removal: "may_perform",
    excavation: "may_perform",
    pool_installation: "unlikely_to_perform",
    waterproofing: "unlikely_to_perform",
    plumbing: "unlikely_to_perform",
    electrical: "unlikely_to_perform",
    hvac: "unlikely_to_perform",
    roofing: "unlikely_to_perform",
    painting: "unlikely_to_perform",
  },
  Painter: {
    painting: "clearly_performs",
    drywall: "may_perform",
    general_renovation: "may_perform",
    landscaping: "unlikely_to_perform",
    plumbing: "unlikely_to_perform",
    electrical: "unlikely_to_perform",
    roofing: "unlikely_to_perform",
    waterproofing: "unlikely_to_perform",
  },
  Renovator: {
    general_renovation: "clearly_performs",
    kitchen_renovation: "clearly_performs",
    bathroom_renovation: "clearly_performs",
    framing: "clearly_performs",
    drywall: "clearly_performs",
    flooring: "clearly_performs",
    finish_carpentry: "clearly_performs",
    tile: "may_perform",
    cabinetry: "may_perform",
    plumbing: "may_perform",
    electrical: "may_perform",
    concrete: "may_perform",
    waterproofing: "may_perform",
    landscaping: "unlikely_to_perform",
    pool_installation: "unlikely_to_perform",
    roofing: "unlikely_to_perform",
    hvac: "unlikely_to_perform",
  },
  Handyman: {
    general_renovation: "clearly_performs",
    drywall: "may_perform",
    painting: "may_perform",
    flooring: "may_perform",
    fencing: "may_perform",
    decking: "may_perform",
    concrete: "may_perform",
    plumbing: "may_perform",
    electrical: "may_perform",
    waterproofing: "may_perform",
    landscaping: "may_perform",
    roofing: "unlikely_to_perform",
    hvac: "unlikely_to_perform",
    pool_installation: "unlikely_to_perform",
  },
  Roofer: {
    roofing: "clearly_performs",
    general_renovation: "may_perform",
    landscaping: "unlikely_to_perform",
    plumbing: "unlikely_to_perform",
    pool_installation: "unlikely_to_perform",
  },
  HVAC: {
    hvac: "clearly_performs",
    electrical: "may_perform",
    general_renovation: "unlikely_to_perform",
    landscaping: "unlikely_to_perform",
  },
  Plumber: {
    plumbing: "clearly_performs",
    bathroom_renovation: "may_perform",
    general_renovation: "may_perform",
    landscaping: "unlikely_to_perform",
    roofing: "unlikely_to_perform",
    pool_installation: "unlikely_to_perform",
  },
  Electrician: {
    electrical: "clearly_performs",
    general_renovation: "may_perform",
    landscaping: "unlikely_to_perform",
    plumbing: "unlikely_to_perform",
    pool_installation: "unlikely_to_perform",
  },
  Flooring: {
    flooring: "clearly_performs",
    tile: "may_perform",
    general_renovation: "may_perform",
    landscaping: "unlikely_to_perform",
  },
  "Deck/Fence": {
    decking: "clearly_performs",
    fencing: "clearly_performs",
    framing: "clearly_performs",
    concrete: "may_perform",
    landscaping: "may_perform",
    pool_installation: "unlikely_to_perform",
  },
  Other: {},
};

const CUSTOM_TRADE_INFERENCE: Array<{ pattern: RegExp; map: CapabilityMap }> = [
  {
    pattern: /\bconcrete\b/i,
    map: { concrete: "clearly_performs", masonry: "may_perform", excavation: "may_perform" },
  },
  {
    pattern: /\bwaterproof|foundation\b/i,
    map: { waterproofing: "clearly_performs", concrete: "may_perform", drainage: "may_perform" },
  },
  {
    pattern: /\blandscap/i,
    map: { landscaping: "clearly_performs", grading: "clearly_performs", drainage: "may_perform" },
  },
  {
    pattern: /\bgeneral contractor\b/i,
    map: { general_renovation: "clearly_performs", framing: "may_perform", demolition: "may_perform" },
  },
];

function resolveCapabilityMap(profile: ContractorCapabilityProfile): CapabilityMap {
  const primary = profile.primaryTrade?.trim() ?? "";
  let map: CapabilityMap = { ...(TRADE_CAPABILITY_MAP[primary] ?? {}) };

  if (primary === "Other") {
    const custom = (profile.primaryTradeOther ?? profile.tradeLabel ?? "").trim();
    for (const rule of CUSTOM_TRADE_INFERENCE) {
      if (rule.pattern.test(custom)) {
        map = { ...map, ...rule.map };
      }
    }
    if (Object.keys(map).length === 0) {
      map = { general_renovation: "may_perform" };
    }
  }

  if (profile.servicesOffered?.length) {
    for (const service of profile.servicesOffered) {
      const lower = service.toLowerCase();
      for (const key of Object.keys(map) as WorkComponentKey[]) {
        if (lower.includes(key.replace(/_/g, " "))) {
          const cap = map[key];
          map[key] = cap === "unlikely_to_perform" ? "may_perform" : "clearly_performs";
        }
      }
    }
  }

  if (profile.servicesNotOffered?.length) {
    for (const service of profile.servicesNotOffered) {
      const lower = service.toLowerCase();
      for (const key of Object.keys(map) as WorkComponentKey[]) {
        if (lower.includes(key.replace(/_/g, " "))) {
          map[key] = "unlikely_to_perform";
        }
      }
    }
  }

  if (profile.secondaryTrades?.length) {
    for (const secondary of profile.secondaryTrades) {
      const secondaryMap = TRADE_CAPABILITY_MAP[secondary];
      if (secondaryMap) {
        for (const [key, cap] of Object.entries(secondaryMap) as [
          WorkComponentKey,
          ComponentCapability,
        ][]) {
          if (cap === "clearly_performs" && map[key as WorkComponentKey] !== "clearly_performs") {
            const existing = map[key as WorkComponentKey];
            map[key as WorkComponentKey] =
              existing === "unlikely_to_perform" ? "may_perform" : existing;
          }
        }
      }
    }
  }

  map = applyExtraCapabilitiesToMap(map, profile.extraCapabilities);

  return map;
}

export function contractorCapabilityForComponent(
  profile: ContractorCapabilityProfile,
  componentKey: WorkComponentKey
): ComponentCapability {
  const map = resolveCapabilityMap(profile);
  return map[componentKey] ?? DEFAULT_UNLISTED;
}

export function contractorProfileFromTrade(input: {
  tradeLabel: string | null;
  primaryTrade: string | null;
  primaryTradeOther: string | null;
  extraCapabilities?: string | null;
}): ContractorCapabilityProfile {
  return {
    primaryTrade: input.primaryTrade,
    primaryTradeOther: input.primaryTradeOther,
    tradeLabel: input.tradeLabel,
    extraCapabilities: input.extraCapabilities?.trim() || null,
  };
}
