import { normalizeNorthAmericanPhone } from "@/lib/sms/phone";
import { sendTwilioSms } from "@/lib/sms/twilio";
import { resolvePublicAppOrigin } from "@/lib/app-origin";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export type QuoteSentCustomerSmsPayload = {
  requestId: string;
  contractorId: string;
  customerName: string;
  customerPhone: string;
  estimateTitle: string;
  publicEstimateUrl: string;
};

export type QuoteSentCustomerSmsResult =
  | { sent: true; toPhone: string; messageSid?: string }
  | {
      sent: false;
      reason:
        | "no_customer_phone"
        | "invalid_customer_phone"
        | "not_configured"
        | "send_failed";
      error?: string;
    };

function smsDisplayName(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "there";
  return trimmed.split(/\s+/)[0].slice(0, 40);
}

function buildQuoteSentSmsBody(input: {
  customerName: string;
  businessName: string;
  estimateTitle: string;
  publicUrl: string;
}): string {
  const name = smsDisplayName(input.customerName);
  const business = input.businessName.trim() || "Your contractor";
  const title = input.estimateTitle.trim() || "your project";
  return `Hi ${name}, ${business} has sent you a quote for ${title}. View and respond here: ${input.publicUrl}`;
}

/**
 * SMS the customer when a quote is sent from Quote Builder. Never throws.
 */
export async function sendQuoteSentCustomerSms(
  payload: QuoteSentCustomerSmsPayload
): Promise<QuoteSentCustomerSmsResult> {
  const customerPhoneRaw = payload.customerPhone?.trim();
  if (!customerPhoneRaw) {
    return { sent: false, reason: "no_customer_phone" };
  }

  const toE164 = normalizeNorthAmericanPhone(customerPhoneRaw);
  if (!toE164) {
    return { sent: false, reason: "invalid_customer_phone" };
  }

  try {
    const admin = createServiceRoleClient();
    if (!admin) {
      return { sent: false, reason: "not_configured" };
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("business_name")
      .eq("id", payload.contractorId)
      .maybeSingle();

    const businessName = String(profile?.business_name ?? "Your contractor");
    const publicUrl = payload.publicEstimateUrl.trim() || resolvePublicAppOrigin();

    const body = buildQuoteSentSmsBody({
      customerName: payload.customerName,
      businessName,
      estimateTitle: payload.estimateTitle,
      publicUrl,
    });

    const result = await sendTwilioSms(toE164, body);
    if (!result.sent) {
      return {
        sent: false,
        reason: result.reason === "not_configured" ? "not_configured" : "send_failed",
        error: result.error,
      };
    }

    return { sent: true, toPhone: toE164, messageSid: result.messageSid };
  } catch (err) {
    console.error("[quote-sent-sms]", err);
    return {
      sent: false,
      reason: "send_failed",
      error: err instanceof Error ? err.message : "SMS send failed",
    };
  }
}
