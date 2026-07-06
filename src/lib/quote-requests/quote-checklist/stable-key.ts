import { createHash } from "crypto";
import type { ChecklistCategory } from "@/lib/quote-requests/quote-checklist/types";

export function computeChecklistStableKey(category: ChecklistCategory, title: string): string {
  const normalized = `${category}:${title.toLowerCase().replace(/\s+/g, " ").trim()}`;
  return createHash("sha256").update(normalized).digest("hex").slice(0, 32);
}
