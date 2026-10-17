import { requireAdminUser } from "@/lib/admin-auth";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

/**
 * Authorization gate for every admin server action: the caller must hold a session whose
 * email is on the ADMIN_EMAILS allowlist (checked server-side on every call, never trusting
 * the client or middleware). Only then is the service-role client created, so the
 * SUPABASE_SERVICE_ROLE_KEY never reaches the browser and is never used for unauthorized callers.
 */
export async function requireAdminService() {
  const auth = await requireAdminUser();
  if (!auth.ok) return { ok: false as const, error: "Unauthorized" };
  const admin = createServiceRoleClient();
  if (!admin) return { ok: false as const, error: "Service role unavailable" };
  return { ok: true as const, admin, email: auth.userEmail };
}
