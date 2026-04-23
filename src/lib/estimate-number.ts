import { randomUUID } from "node:crypto";

/** Human-readable unique estimate number per profile (collision extremely unlikely). */
export function generateEstimateNumber(): string {
  const y = new Date().getFullYear();
  return `EST-${y}-${randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`;
}
