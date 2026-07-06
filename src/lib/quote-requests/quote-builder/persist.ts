import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computeQuoteBuilderInputHash,
  loadQuoteBuilderContext,
} from "@/lib/quote-requests/quote-builder/load-context";
import { generateQuoteBuilderDraftWithAi } from "@/lib/quote-requests/quote-builder/generate";
import { mergeQuoteBuilderSections } from "@/lib/quote-requests/quote-builder/merge";
import {
  mapBuilderSectionRow,
  type QuoteBuilderDraft,
  type QuoteBuilderSection,
} from "@/lib/quote-requests/quote-builder/types";
import {
  PRODUCT_ANALYTICS_EVENTS,
  trackProductEventSafe,
} from "@/lib/product-analytics";

export async function loadQuoteBuilderDraft(
  admin: SupabaseClient,
  requestId: string
): Promise<QuoteBuilderDraft | null> {
  const { data: request } = await admin
    .from("quote_requests")
    .select(
      "id, quote_builder_status, quote_builder_generated_at, quote_builder_version, quote_builder_site_visit_banner"
    )
    .eq("id", requestId)
    .maybeSingle();

  if (!request) return null;

  const { data: rows } = await admin
    .from("quote_request_builder_sections")
    .select("*")
    .eq("quote_request_id", requestId)
    .order("display_order", { ascending: true });

  const sections = (rows ?? [])
    .map(mapBuilderSectionRow)
    .filter((s): s is QuoteBuilderSection => s !== null);

  return {
    quoteRequestId: requestId,
    status: (request.quote_builder_status ?? "empty") as QuoteBuilderDraft["status"],
    version: Number(request.quote_builder_version ?? 1),
    generatedAt: request.quote_builder_generated_at,
    siteVisitBanner: Boolean(request.quote_builder_site_visit_banner),
    sections,
  };
}

export async function generateQuoteBuilderDraft(
  admin: SupabaseClient,
  requestId: string,
  options: { regenerate?: boolean } = {}
): Promise<QuoteBuilderDraft | null> {
  const context = await loadQuoteBuilderContext(admin, requestId);
  if (!context) return null;

  const inputHash = computeQuoteBuilderInputHash(context);
  const existing = await loadQuoteBuilderDraft(admin, requestId);

  if (
    !options.regenerate &&
    existing &&
    existing.sections.length > 0 &&
    existing.generatedAt
  ) {
    return existing;
  }

  const drafts = await generateQuoteBuilderDraftWithAi(context);
  const generatedAt = new Date().toISOString();

  const sections = await mergeQuoteBuilderSections(admin, {
    quoteRequestId: requestId,
    contractorId: context.contractorId,
    drafts,
    generatedAt,
  });

  const { data: currentRequest } = await admin
    .from("quote_requests")
    .select("quote_builder_version")
    .eq("id", requestId)
    .maybeSingle();

  const nextVersion = Number(currentRequest?.quote_builder_version ?? 0) + 1;

  await admin
    .from("quote_requests")
    .update({
      quote_builder_status: "draft",
      quote_builder_generated_at: generatedAt,
      quote_builder_input_hash: inputHash,
      quote_builder_version: nextVersion,
      quote_builder_site_visit_banner: context.siteVisitHasCustomerChanges,
    })
    .eq("id", requestId);

  const isRegenerate = options.regenerate && (existing?.sections.length ?? 0) > 0;

  trackProductEventSafe({
    profileId: context.contractorId,
    eventName: isRegenerate
      ? PRODUCT_ANALYTICS_EVENTS.quote_draft_regenerated
      : PRODUCT_ANALYTICS_EVENTS.quote_draft_generated,
    route: `/quote-requests/${requestId}`,
    source: "quote_builder",
    metadata: {
      request_id: requestId,
      section_count: sections.length,
      version: nextVersion,
      site_visit_banner: context.siteVisitHasCustomerChanges,
    },
  });

  return {
    quoteRequestId: requestId,
    status: "draft",
    version: nextVersion,
    generatedAt,
    siteVisitBanner: context.siteVisitHasCustomerChanges,
    sections,
  };
}
