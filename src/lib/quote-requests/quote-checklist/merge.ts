import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ChecklistItemDraft,
  QuoteChecklistItem,
} from "@/lib/quote-requests/quote-checklist/types";
import { mapChecklistRow } from "@/lib/quote-requests/quote-checklist/types";

/**
 * Merge AI-generated drafts with existing items.
 * - Preserves completed state for matching stable_key
 * - Updates title/description/priority for active matches
 * - Deactivates incomplete items no longer in the new set
 * - Keeps completed items even if removed from AI output
 */
export async function mergeChecklistItems(
  admin: SupabaseClient,
  input: {
    quoteRequestId: string;
    contractorId: string;
    drafts: ChecklistItemDraft[];
  }
): Promise<QuoteChecklistItem[]> {
  const { data: existingRows } = await admin
    .from("quote_request_checklist_items")
    .select("*")
    .eq("quote_request_id", input.quoteRequestId);

  const existing = (existingRows ?? []).map(mapChecklistRow);
  const existingByKey = new Map(existing.map((item) => [item.stableKey, item]));
  const newKeys = new Set(input.drafts.map((d) => d.stableKey));

  const now = new Date().toISOString();

  for (const draft of input.drafts) {
    const prev = existingByKey.get(draft.stableKey);
    if (prev) {
      const update: Record<string, unknown> = {
        category: draft.category,
        title: draft.title,
        description: draft.description,
        priority: draft.priority,
        display_order: draft.displayOrder,
        generated_from: draft.generatedFrom,
        ai_reason: draft.aiReason,
        is_active: true,
        updated_at: now,
      };
      // Never overwrite contractor completion fields
      await admin
        .from("quote_request_checklist_items")
        .update(update)
        .eq("id", prev.id);
    } else {
      await admin.from("quote_request_checklist_items").insert({
        quote_request_id: input.quoteRequestId,
        contractor_id: input.contractorId,
        stable_key: draft.stableKey,
        category: draft.category,
        title: draft.title,
        description: draft.description,
        priority: draft.priority,
        display_order: draft.displayOrder,
        generated_from: draft.generatedFrom,
        ai_reason: draft.aiReason,
        is_active: true,
      });
    }
  }

  for (const item of existing) {
    if (newKeys.has(item.stableKey)) continue;
    if (item.completed) {
      // Keep completed items visible even if AI no longer suggests them
      if (!item.isActive) {
        await admin
          .from("quote_request_checklist_items")
          .update({ is_active: true, updated_at: now })
          .eq("id", item.id);
      }
      continue;
    }
    if (item.isActive) {
      await admin
        .from("quote_request_checklist_items")
        .update({ is_active: false, updated_at: now })
        .eq("id", item.id);
    }
  }

  const { data: finalRows } = await admin
    .from("quote_request_checklist_items")
    .select("*")
    .eq("quote_request_id", input.quoteRequestId)
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  return (finalRows ?? []).map(mapChecklistRow);
}

export function checklistCompletionPercentage(items: QuoteChecklistItem[]): number {
  const active = items.filter((i) => i.isActive);
  if (active.length === 0) return 0;
  const completed = active.filter((i) => i.completed).length;
  return Math.round((completed / active.length) * 100);
}
