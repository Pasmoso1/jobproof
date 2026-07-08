import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeNorthAmericanPhone } from "@/lib/sms/phone";

function phoneDigitsForMatch(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits;
}

export type MatchedCustomer = {
  id: string;
  matchedBy: "email" | "phone";
};

/**
 * Find an existing customer for this contractor by email (primary) or phone (secondary).
 */
export async function findExistingCustomerForQuoteRequest(
  supabase: SupabaseClient,
  profileId: string,
  email: string,
  phone: string | null
): Promise<MatchedCustomer | null> {
  const normalizedEmail = email.trim().toLowerCase();
  if (normalizedEmail) {
    const { data: byEmail } = await supabase
      .from("customers")
      .select("id, email")
      .eq("profile_id", profileId)
      .ilike("email", normalizedEmail)
      .limit(5);

    const exact = (byEmail ?? []).find(
      (row) => String(row.email ?? "").trim().toLowerCase() === normalizedEmail
    );
    if (exact?.id) {
      return { id: String(exact.id), matchedBy: "email" };
    }
  }

  const phoneRaw = phone?.trim();
  if (!phoneRaw) return null;

  const targetDigits = phoneDigitsForMatch(phoneRaw);
  if (targetDigits.length < 10) return null;

  const { data: withPhone } = await supabase
    .from("customers")
    .select("id, phone")
    .eq("profile_id", profileId)
    .not("phone", "is", null)
    .limit(200);

  for (const row of withPhone ?? []) {
    const rowPhone = String(row.phone ?? "").trim();
    if (!rowPhone) continue;
    const rowDigits = phoneDigitsForMatch(rowPhone);
    if (rowDigits === targetDigits) {
      return { id: String(row.id), matchedBy: "phone" };
    }
    const rowE164 = normalizeNorthAmericanPhone(rowPhone);
    const targetE164 = normalizeNorthAmericanPhone(phoneRaw);
    if (rowE164 && targetE164 && rowE164 === targetE164) {
      return { id: String(row.id), matchedBy: "phone" };
    }
  }

  return null;
}
