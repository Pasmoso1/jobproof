"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActivePartnerForCurrentUser } from "@/lib/partners/session";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function updatePartnerPaymentEmail(
  formData: FormData
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await getActivePartnerForCurrentUser();
  if (!session) return { success: false, error: "Not authorized." };

  const paymentEmail = String(formData.get("payment_email") ?? "").trim().toLowerCase();
  if (!paymentEmail || !EMAIL_RE.test(paymentEmail)) {
    return { success: false, error: "Enter a valid payment email." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("partners")
    .update({ payment_email: paymentEmail, updated_at: new Date().toISOString() })
    .eq("id", session.partner.id);

  if (error) return { success: false, error: error.message };
  revalidatePath("/partner/payments");
  return { success: true };
}
