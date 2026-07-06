"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  PRODUCT_ANALYTICS_EVENTS,
  trackProductEventSafe,
} from "@/lib/product-analytics";
import { checklistCompletionPercentage } from "@/lib/quote-requests/quote-checklist/merge";
import type { QuoteChecklistItem } from "@/lib/quote-requests/quote-checklist/types";
import { mapChecklistRow } from "@/lib/quote-requests/quote-checklist/types";

export type ToggleChecklistItemResult =
  | { success: true; item: QuoteChecklistItem; completionPercentage: number }
  | { success: false; error: string };

export async function toggleQuoteChecklistItem(
  requestId: string,
  itemId: string,
  completed: boolean
): Promise<ToggleChecklistItemResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!profile?.id) {
    return { success: false, error: "Profile not found." };
  }

  const { data: item } = await supabase
    .from("quote_request_checklist_items")
    .select("*")
    .eq("id", itemId)
    .eq("quote_request_id", requestId)
    .eq("contractor_id", profile.id)
    .maybeSingle();

  if (!item) {
    return { success: false, error: "Checklist item not found." };
  }

  const now = completed ? new Date().toISOString() : null;
  const { data: updated, error } = await supabase
    .from("quote_request_checklist_items")
    .update({
      completed,
      completed_at: now,
      completed_by: completed ? profile.id : null,
    })
    .eq("id", itemId)
    .eq("contractor_id", profile.id)
    .select("*")
    .single();

  if (error || !updated) {
    console.error("[toggleQuoteChecklistItem]", error);
    return { success: false, error: "Could not update checklist item." };
  }

  const { data: allItems } = await supabase
    .from("quote_request_checklist_items")
    .select("*")
    .eq("quote_request_id", requestId)
    .eq("is_active", true);

  const mapped = (allItems ?? []).map(mapChecklistRow);
  const completionPercentage = checklistCompletionPercentage(mapped);

  if (completed) {
    trackProductEventSafe({
      profileId: profile.id,
      eventName: PRODUCT_ANALYTICS_EVENTS.checklist_item_completed,
      route: `/quote-requests/${requestId}`,
      source: "quote_checklist",
      metadata: {
        request_id: requestId,
        contractor_id: profile.id,
        category: updated.category,
        priority: updated.priority,
        completion_percentage: completionPercentage,
      },
    });
  }

  if (
    completionPercentage === 100 ||
    completionPercentage === 25 ||
    completionPercentage === 50 ||
    completionPercentage === 75
  ) {
    trackProductEventSafe({
      profileId: profile.id,
      eventName: PRODUCT_ANALYTICS_EVENTS.checklist_completion_percentage,
      route: `/quote-requests/${requestId}`,
      source: "quote_checklist",
      metadata: {
        request_id: requestId,
        contractor_id: profile.id,
        completion_percentage: completionPercentage,
      },
    });
  }

  revalidatePath(`/quote-requests/${requestId}`);

  return {
    success: true,
    item: mapChecklistRow(updated),
    completionPercentage,
  };
}
