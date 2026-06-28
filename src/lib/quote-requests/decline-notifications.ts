import { Resend } from "resend";
import { resolveContractorNotificationEmail } from "@/lib/quote-requests/notifications";
import { normalizeNorthAmericanPhone } from "@/lib/sms/phone";
import { sendTwilioSms } from "@/lib/sms/twilio";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export type QuoteRequestDeclineReason =
  | "service_not_offered"
  | "capacity"
  | "not_good_fit";

export type QuoteRequestDeclineNotificationPayload = {
  requestId: string;
  contractorId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  projectType: string;
  reason: QuoteRequestDeclineReason;
};

export type QuoteRequestDeclineEmailResult =
  | { sent: true; toEmail: string; resendMessageId?: string }
  | {
      sent: false;
      reason: "no_customer_email" | "not_configured" | "send_failed";
      error?: string;
    };

export type QuoteRequestDeclineSmsResult =
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function extractResendMailbox(raw: string): string {
  const m = raw.match(/<([^>]+)>/);
  if (m) return m[1].trim();
  return raw.trim();
}

function buildResendFromHeaderForBusiness(businessDisplayName: string): string {
  const envRaw = process.env.RESEND_FROM?.trim() || "Job Proof <hello@jobproof.ca>";
  const email = extractResendMailbox(envRaw);
  const biz = businessDisplayName.replace(/[\r\n<>"]/g, "").trim().slice(0, 100);
  return biz ? `${biz} via JobProof <${email}>` : `JobProof <${email}>`;
}

function displayFirstName(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "there";
  return trimmed.split(/\s+/)[0].slice(0, 40);
}

type DeclineCopy = {
  subject: string;
  bodyParagraphs: string[];
};

function buildDeclineCopy(
  reason: QuoteRequestDeclineReason,
  businessName: string
): DeclineCopy {
  const biz = businessName.trim() || "Our team";

  switch (reason) {
    case "service_not_offered":
      return {
        subject: `Update on your quote request — ${biz}`,
        bodyParagraphs: [
          `Thank you for contacting ${biz} and for taking the time to share your project details.`,
          `After reviewing your request, ${biz} does not currently offer this type of work. We want to be upfront so you can move forward without delay.`,
          `We recommend reaching out to another contractor who specializes in this kind of project. We appreciate you thinking of ${biz} and wish you the best with your project.`,
        ],
      };
    case "capacity":
      return {
        subject: `Update on your quote request — ${biz}`,
        bodyParagraphs: [
          `Thank you for contacting ${biz} and for sharing the details of your project.`,
          `At this time, we are not taking on additional projects. This is a temporary scheduling decision — not a permanent change to our services.`,
          `We appreciate your interest and encourage you to contact us again in the future, or to reach out to another trusted contractor who may be available sooner.`,
        ],
      };
    case "not_good_fit":
      return {
        subject: `Update on your quote request — ${biz}`,
        bodyParagraphs: [
          `Thank you for reaching out to ${biz} about your project.`,
          `After reviewing the details, we do not believe this project is the right fit for our team at this time. We want to be respectful of your time and help you find the right professional for the job.`,
          `We recommend contacting another contractor who may be better suited to your specific needs. We appreciate your understanding and wish you success with your project.`,
        ],
      };
  }
}

function buildDeclineEmailHtml(input: {
  customerName: string;
  businessName: string;
  projectType: string;
  copy: DeclineCopy;
}): string {
  const greeting = displayFirstName(input.customerName);
  const paragraphs = input.copy.bodyParagraphs
    .map((p) => `<p style="font-size:14px;color:#3F3F46;margin:0 0 14px;">${escapeHtml(p)}</p>`)
    .join("");

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5;max-width:560px;color:#18181B;">
      <p>Hi ${escapeHtml(greeting)},</p>
      ${paragraphs}
      <p style="font-size:13px;color:#71717A;margin-top:20px;">Project type: ${escapeHtml(input.projectType.trim() || "—")}</p>
      <p style="font-size:13px;color:#A1A1AA;margin-top:24px;">— ${escapeHtml(input.businessName.trim() || "Your contractor")}</p>
    </div>
  `;
}

function buildDeclineEmailText(input: {
  customerName: string;
  businessName: string;
  projectType: string;
  copy: DeclineCopy;
}): string {
  const greeting = displayFirstName(input.customerName);
  return [
    `Hi ${greeting},`,
    "",
    ...input.copy.bodyParagraphs.flatMap((p) => [p, ""]),
    `Project type: ${input.projectType.trim() || "—"}`,
    "",
    `— ${input.businessName.trim() || "Your contractor"}`,
  ].join("\n");
}

function buildDeclineSmsBody(input: {
  customerName: string;
  businessName: string;
  reason: QuoteRequestDeclineReason;
}): string {
  const name = displayFirstName(input.customerName);
  const biz = input.businessName.trim() || "Our team";

  switch (input.reason) {
    case "service_not_offered":
      return `Hi ${name}, thank you for contacting ${biz}. After reviewing your request, we don't offer this type of work. We recommend reaching out to another contractor who specializes in your project. We appreciate you thinking of us.`;
    case "capacity":
      return `Hi ${name}, thank you for contacting ${biz}. We're not taking on additional projects at this time. We hope to work with you in the future, or you may wish to contact another contractor who is available now.`;
    case "not_good_fit":
      return `Hi ${name}, thank you for reaching out to ${biz}. After reviewing your project, we don't believe it's the right fit for our team. We recommend contacting another contractor who may be better suited. Thank you for your understanding.`;
  }
}

export async function sendQuoteRequestDeclineCustomerEmail(
  payload: QuoteRequestDeclineNotificationPayload
): Promise<QuoteRequestDeclineEmailResult> {
  const customerEmail = payload.customerEmail?.trim();
  if (!customerEmail) {
    return { sent: false, reason: "no_customer_email" };
  }

  try {
    const admin = createServiceRoleClient();
    if (!admin) {
      return { sent: false, reason: "not_configured" };
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("business_name, business_contact_email, user_id")
      .eq("id", payload.contractorId)
      .maybeSingle();

    const businessName = String(profile?.business_name ?? "Your contractor");
    const copy = buildDeclineCopy(payload.reason, businessName);
    const { email: replyToEmail } = await resolveContractorNotificationEmail(
      admin,
      payload.contractorId
    );

    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (!apiKey) {
      return { sent: false, reason: "not_configured" };
    }

    const emailContent = {
      customerName: payload.customerName,
      businessName,
      projectType: payload.projectType,
      copy,
    };

    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from: buildResendFromHeaderForBusiness(businessName),
      to: [customerEmail],
      subject: copy.subject,
      html: buildDeclineEmailHtml(emailContent),
      text: buildDeclineEmailText(emailContent),
      ...(replyToEmail ? { replyTo: replyToEmail } : {}),
    });

    if (error) {
      return { sent: false, reason: "send_failed", error: error.message };
    }

    return { sent: true, toEmail: customerEmail, resendMessageId: data?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { sent: false, reason: "send_failed", error: message };
  }
}

export async function sendQuoteRequestDeclineCustomerSms(
  payload: QuoteRequestDeclineNotificationPayload
): Promise<QuoteRequestDeclineSmsResult> {
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
    const body = buildDeclineSmsBody({
      customerName: payload.customerName,
      businessName,
      reason: payload.reason,
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
    const message = err instanceof Error ? err.message : String(err);
    return { sent: false, reason: "send_failed", error: message };
  }
}

export const DECLINE_REASON_LABELS: Record<QuoteRequestDeclineReason, string> = {
  service_not_offered: "Declined — service not offered",
  capacity: "Declined — not taking new projects",
  not_good_fit: "Declined — not the right fit",
};

export const DECLINE_EVENT_TYPES: Record<QuoteRequestDeclineReason, string> = {
  service_not_offered: "declined_service_not_offered",
  capacity: "declined_capacity",
  not_good_fit: "declined_not_good_fit",
};
