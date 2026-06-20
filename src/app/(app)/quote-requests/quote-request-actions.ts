"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  QUOTE_REQUEST_STORAGE_BUCKET,
  type QuoteRequestStatus,
} from "@/lib/quote-requests/constants";
import type { QuoteRequest, QuoteRequestAttachment } from "@/types/database";

export type QuoteRequestListRow = QuoteRequest;

export type QuoteRequestDetail = QuoteRequest & {
  attachments: Array<QuoteRequestAttachment & { signedUrl: string | null }>;
};

async function requireProfileId(): Promise<string> {
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

  if (!profile?.id) throw new Error("Profile not found.");
  return String(profile.id);
}

export async function getQuoteRequestsList(): Promise<QuoteRequestListRow[]> {
  const profileId = await requireProfileId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("quote_requests")
    .select("*")
    .eq("contractor_id", profileId)
    .order("submitted_at", { ascending: false });

  if (error) {
    console.error("[getQuoteRequestsList]", error);
    return [];
  }
  return (data ?? []) as QuoteRequestListRow[];
}

export async function getQuoteRequestDetail(
  requestId: string
): Promise<QuoteRequestDetail | null> {
  const profileId = await requireProfileId();
  const supabase = await createClient();

  const { data: request, error } = await supabase
    .from("quote_requests")
    .select("*")
    .eq("id", requestId)
    .eq("contractor_id", profileId)
    .maybeSingle();

  if (error || !request) return null;

  const { data: attachments } = await supabase
    .from("quote_request_attachments")
    .select("*")
    .eq("quote_request_id", requestId)
    .order("created_at", { ascending: true });

  const withUrls = await Promise.all(
    (attachments ?? []).map(async (att) => {
      const { data: signed } = await supabase.storage
        .from(QUOTE_REQUEST_STORAGE_BUCKET)
        .createSignedUrl(att.file_path, 3600);
      return {
        ...(att as QuoteRequestAttachment),
        signedUrl: signed?.signedUrl ?? null,
      };
    })
  );

  return {
    ...(request as QuoteRequest),
    attachments: withUrls,
  };
}

export type UpdateQuoteRequestStatusResult =
  | { success: true }
  | { success: false; error: string };

async function updateQuoteRequestStatus(
  requestId: string,
  status: QuoteRequestStatus
): Promise<UpdateQuoteRequestStatusResult> {
  const profileId = await requireProfileId();
  const supabase = await createClient();

  const { error } = await supabase
    .from("quote_requests")
    .update({ status })
    .eq("id", requestId)
    .eq("contractor_id", profileId);

  if (error) {
    console.error("[updateQuoteRequestStatus]", error);
    return { success: false, error: "Could not update this request." };
  }

  revalidatePath("/quote-requests");
  revalidatePath(`/quote-requests/${requestId}`);
  return { success: true };
}

export async function markQuoteRequestReviewed(requestId: string) {
  return updateQuoteRequestStatus(requestId, "reviewed");
}

export async function markQuoteRequestResponded(requestId: string) {
  return updateQuoteRequestStatus(requestId, "responded");
}

export async function markQuoteRequestSiteVisit(requestId: string) {
  return updateQuoteRequestStatus(requestId, "site_visit_requested");
}

export async function closeQuoteRequest(requestId: string) {
  return updateQuoteRequestStatus(requestId, "closed");
}

export async function convertQuoteRequestPlaceholder(
  requestId: string
): Promise<UpdateQuoteRequestStatusResult> {
  const profileId = await requireProfileId();
  void profileId;
  void requestId;
  return {
    success: false,
    error: "Convert to customer is coming soon. This will create a customer and job from the quote request.",
  };
}
