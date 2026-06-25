import { normalizeNorthAmericanPhone } from "@/lib/sms/phone";
import { sendTwilioSms } from "@/lib/sms/twilio";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export type QuoteRequestSiteVisitCustomerSmsPayload = {
  requestId: string;
  contractorId: string;
  customerName: string;
  customerPhone: string;
  projectType: string;
};

export type QuoteRequestSiteVisitCustomerSmsResult =
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
  const first = trimmed.split(/\s+/)[0];
  return first.slice(0, 40);
}

function smsProjectType(raw: string): string {
  const trimmed = raw.trim() || "your project";
  return trimmed.length > 50 ? `${trimmed.slice(0, 47)}...` : trimmed;
}

function buildSiteVisitSmsBody(input: {
  customerName: string;
  businessName: string;
  businessPhone: string | null;
  projectType: string;
}): string {
  const name = smsDisplayName(input.customerName);
  const business = input.businessName.trim() || "Your contractor";
  const projectType = smsProjectType(input.projectType);
  const phone = input.businessPhone?.trim();

  if (phone) {
    return `Hi ${name}, ${business} reviewed your quote request for ${projectType} and would like to schedule a site visit. They'll contact you soon. If you prefer, call ${phone}. — JobProof`;
  }

  return `Hi ${name}, ${business} reviewed your quote request for ${projectType} and would like to schedule a site visit. They'll contact you soon. — JobProof`;
}

/**
 * SMS the customer when a contractor requests a site visit. Never throws.
 */
export async function sendQuoteRequestSiteVisitCustomerSms(
  payload: QuoteRequestSiteVisitCustomerSmsPayload
): Promise<QuoteRequestSiteVisitCustomerSmsResult> {
  const customerPhoneRaw = payload.customerPhone?.trim();
  if (!customerPhoneRaw) {
    console.warn("[quote-request-site-visit-sms] no customer phone", {
      contractorId: payload.contractorId,
      requestId: payload.requestId,
    });
    return { sent: false, reason: "no_customer_phone" };
  }

  const toE164 = normalizeNorthAmericanPhone(customerPhoneRaw);
  if (!toE164) {
    console.warn("[quote-request-site-visit-sms] invalid customer phone", {
      contractorId: payload.contractorId,
      requestId: payload.requestId,
    });
    return { sent: false, reason: "invalid_customer_phone" };
  }

  try {
    const admin = createServiceRoleClient();
    if (!admin) {
      console.warn("[quote-request-site-visit-sms] service role unavailable", {
        contractorId: payload.contractorId,
        requestId: payload.requestId,
      });
      return { sent: false, reason: "not_configured" };
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("business_name, phone")
      .eq("id", payload.contractorId)
      .maybeSingle();

    const businessName = String(profile?.business_name ?? "Your contractor");
    const businessPhone = profile?.phone ? String(profile.phone) : null;

    const body = buildSiteVisitSmsBody({
      customerName: payload.customerName,
      businessName,
      businessPhone,
      projectType: payload.projectType,
    });

    const result = await sendTwilioSms(toE164, body);
    if (!result.sent) {
      console.error("[quote-request-site-visit-sms] Twilio send failed", {
        contractorId: payload.contractorId,
        requestId: payload.requestId,
        reason: result.reason,
        error: result.error,
      });
      return {
        sent: false,
        reason: result.reason === "not_configured" ? "not_configured" : "send_failed",
        error: result.error,
      };
    }

    return { sent: true, toPhone: toE164, messageSid: result.messageSid };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[quote-request-site-visit-sms] unexpected error", {
      contractorId: payload.contractorId,
      requestId: payload.requestId,
      message,
    });
    return { sent: false, reason: "send_failed", error: message };
  }
}
