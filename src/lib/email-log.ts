import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export type EmailLogEntityType = "contract" | "change_order" | "invoice";

export type EmailLogInsert = {
  profileId: string;
  type: EmailLogEntityType;
  recipientEmail: string;
  status: "success" | "failed";
  errorMessage?: string | null;
  relatedEntityId?: string | null;
};

const MAX_ERROR_LEN = 4000;

/**
 * Persists one send attempt. Never throws — failures only go to server console.
 * Requires authenticated user whose profile matches profileId (RLS).
 */
export async function insertEmailLog(input: EmailLogInsert): Promise<void> {
  try {
    const supabase = await createClient();
    const trimmedErr =
      input.errorMessage != null && String(input.errorMessage).trim() !== ""
        ? String(input.errorMessage).trim().slice(0, MAX_ERROR_LEN)
        : null;

    const { error } = await supabase.from("email_logs").insert({
      profile_id: input.profileId,
      type: input.type,
      recipient_email: input.recipientEmail.trim(),
      status: input.status,
      error_message: trimmedErr,
      related_entity_id: input.relatedEntityId ?? null,
    });

    if (error) {
      console.error("[insertEmailLog] Supabase insert failed:", error.message);
    }
  } catch (e) {
    console.error("[insertEmailLog] Unexpected error:", e);
  }
}

/**
 * Same as `insertEmailLog` but uses the service role (cron / automation; no user session).
 */
export async function insertEmailLogWithServiceRole(
  input: EmailLogInsert
): Promise<void> {
  try {
    const admin = createServiceRoleClient();
    if (!admin) {
      console.error("[insertEmailLogWithServiceRole] Missing service role client");
      return;
    }
    const trimmedErr =
      input.errorMessage != null && String(input.errorMessage).trim() !== ""
        ? String(input.errorMessage).trim().slice(0, MAX_ERROR_LEN)
        : null;

    const { error } = await admin.from("email_logs").insert({
      profile_id: input.profileId,
      type: input.type,
      recipient_email: input.recipientEmail.trim(),
      status: input.status,
      error_message: trimmedErr,
      related_entity_id: input.relatedEntityId ?? null,
    });

    if (error) {
      console.error(
        "[insertEmailLogWithServiceRole] Supabase insert failed:",
        error.message
      );
    }
  } catch (e) {
    console.error("[insertEmailLogWithServiceRole] Unexpected error:", e);
  }
}
