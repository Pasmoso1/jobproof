import { Resend } from "resend";
import { insertEmailLogWithServiceRole } from "@/lib/email-log";
import { resolvePublicAppOrigin } from "@/lib/app-origin";
import { normalizeNorthAmericanPhone } from "@/lib/sms/phone";
import { sendTwilioSms } from "@/lib/sms/twilio";

export type EstimateCustomerFeedbackType =
  | "question"
  | "change_request"
  | "decline"
  | "accepted";

export type NotifyEstimateFeedbackInput = {
  profileId: string;
  estimateId: string;
  quoteToken: string;
  contractorBusinessName: string;
  contractorEmail: string | null;
  contractorPhone: string | null;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  estimateTitle: string;
  type: EstimateCustomerFeedbackType;
  message: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function extractResendMailbox(raw: string): string {
  const match = raw.match(/<([^>]+)>/);
  return match ? match[1].trim() : raw.trim();
}

function buildResendFromHeader(businessDisplayName: string | null | undefined): string {
  const envRaw = process.env.RESEND_FROM?.trim() || "Job Proof <hello@jobproof.ca>";
  const email = extractResendMailbox(envRaw);
  const biz = businessDisplayName?.replace(/[\r\n<>"]/g, "").trim().slice(0, 100);
  return biz ? `${biz} via JobProof <${email}>` : `JobProof <${email}>`;
}

function feedbackLabel(type: EstimateCustomerFeedbackType): string {
  switch (type) {
    case "accepted":
      return "Quote accepted";
    case "change_request":
      return "Request changes";
    case "decline":
      return "Decline quote";
    default:
      return "Ask a question";
  }
}

function feedbackSubject(type: EstimateCustomerFeedbackType, estimateTitle: string): string {
  const title = estimateTitle.trim() || "Project quote";
  switch (type) {
    case "accepted":
      return `Customer accepted quote: ${title}`;
    case "change_request":
      return `Customer requested changes: ${title}`;
    case "decline":
      return `Customer declined quote: ${title}`;
    default:
      return `Customer question about quote: ${title}`;
  }
}

function feedbackHtml(input: NotifyEstimateFeedbackInput): string {
  const quoteUrl = `${resolvePublicAppOrigin()}/estimate/${input.quoteToken}`;
  const customerLines = [
    input.customerName.trim() || "Customer",
    input.customerEmail?.trim() ? `Email: ${input.customerEmail.trim()}` : null,
    input.customerPhone?.trim() ? `Phone: ${input.customerPhone.trim()}` : null,
  ]
    .filter(Boolean)
    .map((line) => String(line));

  return `
    <div style="font-family: Arial, Helvetica, sans-serif; line-height: 1.55; max-width: 600px; color: #111827;">
      <p style="font-size:16px;">There is an update on a customer quote.</p>
      <div style="margin-top:18px;padding:14px 16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;">
        <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#2436BB;text-transform:uppercase;letter-spacing:0.04em;">Quote</p>
        <div style="font-size:14px;font-weight:600;">${escapeHtml(input.estimateTitle)}</div>
        <div style="margin-top:4px;font-size:14px;color:#4b5563;">Action: ${escapeHtml(feedbackLabel(input.type))}</div>
      </div>
      <div style="margin-top:16px;padding:14px 16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;">
        <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#2436BB;text-transform:uppercase;letter-spacing:0.04em;">Customer</p>
        ${customerLines.map((line) => `<div style="font-size:14px;">${escapeHtml(line)}</div>`).join("")}
      </div>
      <div style="margin-top:16px;padding:14px 16px;background:#eef2ff;border:1px solid #c7d2fe;border-radius:10px;">
        <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#2436BB;text-transform:uppercase;letter-spacing:0.04em;">Message</p>
        <div style="font-size:14px;color:#1e293b;white-space:pre-wrap;">${escapeHtml(input.message)}</div>
      </div>
      <p style="margin-top:18px;">
        <a href="${escapeHtml(quoteUrl)}" style="display:inline-block;padding:10px 18px;background:#2436BB;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">Open customer quote</a>
      </p>
      <p style="font-size:12px;color:#9ca3af;">— JobProof</p>
    </div>
  `;
}

function feedbackSmsBody(input: NotifyEstimateFeedbackInput): string {
  const action = feedbackLabel(input.type);
  const name = input.customerName.trim() || "A customer";
  return `${name} sent a quote update (${action.toLowerCase()}) for ${input.estimateTitle.trim() || "your project"}. Open JobProof to review it.`;
}

export async function notifyContractorOfEstimateFeedback(
  input: NotifyEstimateFeedbackInput
): Promise<{
  emailSent: boolean;
  smsSent: boolean;
  emailError?: string;
  smsError?: string;
}> {
  let emailSent = false;
  let emailError: string | undefined;

  const email = input.contractorEmail?.trim() || null;
  if (email) {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    const isProd = process.env.NODE_ENV === "production";
    if (!apiKey) {
      emailSent = !isProd;
      if (isProd) emailError = "Email service not configured";
    } else {
      try {
        const resend = new Resend(apiKey);
        const { error } = await resend.emails.send({
          from: buildResendFromHeader(input.contractorBusinessName),
          to: email,
          subject: feedbackSubject(input.type, input.estimateTitle),
          html: feedbackHtml(input),
          ...(input.customerEmail?.trim() ? { replyTo: input.customerEmail.trim() } : {}),
        });
        if (error) {
          emailError =
            typeof error === "object" && error && "message" in error
              ? String((error as { message: string }).message)
              : "Failed to send email";
        } else {
          emailSent = true;
        }
      } catch (error) {
        emailError = error instanceof Error ? error.message : "Failed to send email";
      }
    }

    await insertEmailLogWithServiceRole({
      profileId: input.profileId,
      type: "estimate",
      recipientEmail: email,
      status: emailSent ? "success" : "failed",
      errorMessage: emailSent ? null : emailError ?? null,
      relatedEntityId: input.estimateId,
    });
  }

  let smsSent = false;
  let smsError: string | undefined;
  const contractorPhone = normalizeNorthAmericanPhone(input.contractorPhone);
  if (contractorPhone) {
    const sms = await sendTwilioSms(contractorPhone, feedbackSmsBody(input));
    if (sms.sent) {
      smsSent = true;
    } else {
      smsError = sms.error ?? sms.reason;
    }
  }

  return { emailSent, smsSent, emailError, smsError };
}
