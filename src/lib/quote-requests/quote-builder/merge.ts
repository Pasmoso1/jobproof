import type { SupabaseClient } from "@supabase/supabase-js";
import {
  mapBuilderSectionRow,
  type QuoteBuilderSection,
  type QuoteBuilderSectionDraft,
} from "@/lib/quote-requests/quote-builder/types";

/**
 * Merge generated drafts with existing sections.
 * - Preserves contractor_edited sections entirely
 * - Preserves pricing if contractor has edited it
 * - Updates generated sections from new drafts
 */
export async function mergeQuoteBuilderSections(
  admin: SupabaseClient,
  input: {
    quoteRequestId: string;
    contractorId: string;
    drafts: QuoteBuilderSectionDraft[];
    generatedAt: string;
  }
): Promise<QuoteBuilderSection[]> {
  const { data: existingRows } = await admin
    .from("quote_request_builder_sections")
    .select("*")
    .eq("quote_request_id", input.quoteRequestId);

  const existing = (existingRows ?? [])
    .map(mapBuilderSectionRow)
    .filter((s): s is QuoteBuilderSection => s !== null);
  const existingByKey = new Map(existing.map((s) => [s.sectionKey, s]));
  const now = input.generatedAt;

  for (const draft of input.drafts) {
    const prev = existingByKey.get(draft.sectionKey);
    if (prev?.contractorEdited) continue;

    if (prev) {
      await admin
        .from("quote_request_builder_sections")
        .update({
          title: draft.title,
          content: draft.content,
          display_order: draft.displayOrder,
          source: "generated",
          generated_at: now,
          updated_at: now,
        })
        .eq("id", prev.id);
    } else {
      await admin.from("quote_request_builder_sections").insert({
        quote_request_id: input.quoteRequestId,
        contractor_id: input.contractorId,
        section_key: draft.sectionKey,
        title: draft.title,
        content: draft.content,
        display_order: draft.displayOrder,
        source: "generated",
        generated_at: now,
      });
    }
  }

  const { data: finalRows } = await admin
    .from("quote_request_builder_sections")
    .select("*")
    .eq("quote_request_id", input.quoteRequestId)
    .order("display_order", { ascending: true });

  return (finalRows ?? [])
    .map(mapBuilderSectionRow)
    .filter((s): s is QuoteBuilderSection => s !== null);
}
