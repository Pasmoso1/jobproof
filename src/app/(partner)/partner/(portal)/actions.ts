"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getActivePartnerForCurrentUser } from "@/lib/partners/session";
import { reverifyPartnerReferralsAfterPaymentEmailUpdate } from "@/lib/partners/payout-verification-runner";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Update Interac e-Transfer payout email only.
 * Does not change Supabase Auth email, login credentials, or contractor data.
 */
export async function updatePartnerPaymentEmail(
  formData: FormData
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await getActivePartnerForCurrentUser();
  if (!session) return { success: false, error: "Not authorized." };

  const paymentEmail = String(formData.get("payment_email") ?? "").trim().toLowerCase();
  if (!paymentEmail || !EMAIL_RE.test(paymentEmail)) {
    return { success: false, error: "Enter a valid payment email." };
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return { success: false, error: "Payment update service is temporarily unavailable." };
  }

  const { error } = await admin
    .from("partners")
    .update({ payment_email: paymentEmail, updated_at: new Date().toISOString() })
    .eq("id", session.partner.id);

  if (error) return { success: false, error: error.message };

  await reverifyPartnerReferralsAfterPaymentEmailUpdate(admin, session.partner.id);

  revalidatePath("/partner/payments");
  revalidatePath("/partner");
  return { success: true };
}
