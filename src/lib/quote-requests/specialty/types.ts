export const SPECIALTY_KEYS = ["foundation_waterproofing", "exterior_drainage"] as const;

export type SpecialtyKey = (typeof SPECIALTY_KEYS)[number];

export type SpecialtyClassification = {
  key: SpecialtyKey;
  /** Human-readable label for AI prompt context */
  label: string;
  /** Active leak / urgent water intrusion — timeline questions should come later */
  urgent: boolean;
  confidence: "high" | "medium";
};
