"use server";

import { createClient } from "@/lib/supabase/server";
import { SUPPORT_APP_VERSION } from "@/lib/support/types";

export type SupportTicketCategory =
  | "general_question"
  | "need_help"
  | "bug_report"
  | "feature_suggestion"
  | "billing";

export type FeatureRequestCategory =
  | "quoting"
  | "customers"
  | "billing"
  | "mobile"
  | "integrations"
  | "reporting"
  | "other";

export type SupportFormResult =
  | { success: true }
  | { success: false; error: string };

function trimRequired(value: FormDataEntryValue | null, label: string): string | SupportFormResult {
  const s = String(value ?? "").trim();
  if (!s) return { success: false, error: `${label} is required.` };
  return s;
}

export async function submitSupportTicket(formData: FormData): Promise<SupportFormResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Please sign in to contact support." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile) return { success: false, error: "Profile not found." };

  const name = trimRequired(formData.get("name"), "Name");
  if (typeof name !== "string") return name;
  const email = trimRequired(formData.get("email"), "Email");
  if (typeof email !== "string") return email;
  const subject = trimRequired(formData.get("subject"), "Subject");
  if (typeof subject !== "string") return subject;
  const message = trimRequired(formData.get("message"), "Message");
  if (typeof message !== "string") return message;
  const category = String(formData.get("category") ?? "").trim() as SupportTicketCategory;
  const allowed: SupportTicketCategory[] = [
    "general_question",
    "need_help",
    "bug_report",
    "feature_suggestion",
    "billing",
  ];
  if (!allowed.includes(category)) {
    return { success: false, error: "Please choose a category." };
  }

  const metadata = {
    current_page: String(formData.get("current_page") ?? "").trim() || null,
    browser: String(formData.get("browser") ?? "").trim() || null,
    operating_system: String(formData.get("operating_system") ?? "").trim() || null,
    screen_size: String(formData.get("screen_size") ?? "").trim() || null,
    user_agent: String(formData.get("user_agent") ?? "").trim() || null,
    profile_id: String(profile.id),
    user_id: user.id,
    app_version: SUPPORT_APP_VERSION,
    submitted_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("support_tickets").insert({
    profile_id: profile.id,
    name,
    email,
    subject,
    category,
    message,
    metadata,
    status: "open",
  });

  if (error) {
    console.error("[submitSupportTicket]", error.message);
    return { success: false, error: "Could not send your message. Please try again." };
  }
  return { success: true };
}

export async function submitFeatureRequest(formData: FormData): Promise<SupportFormResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Please sign in to submit a feature request." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile) return { success: false, error: "Profile not found." };

  const title = trimRequired(formData.get("title"), "Title");
  if (typeof title !== "string") return title;
  const description = trimRequired(formData.get("description"), "Description");
  if (typeof description !== "string") return description;
  const category = String(formData.get("category") ?? "").trim() as FeatureRequestCategory;
  const allowed: FeatureRequestCategory[] = [
    "quoting",
    "customers",
    "billing",
    "mobile",
    "integrations",
    "reporting",
    "other",
  ];
  if (!allowed.includes(category)) {
    return { success: false, error: "Please choose a category." };
  }

  const { error } = await supabase.from("feature_requests").insert({
    profile_id: profile.id,
    title,
    description,
    category,
    status: "submitted",
    vote_count: 0,
  });

  if (error) {
    console.error("[submitFeatureRequest]", error.message);
    return { success: false, error: "Could not save your request. Please try again." };
  }
  return { success: true };
}
