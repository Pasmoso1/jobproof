import { Resend } from "resend";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolvePublicAppOrigin } from "@/lib/app-origin";
import { resolveContractorContactEmail } from "@/lib/contractor-contact-email";
import { formatDateTimeEastern } from "@/lib/datetime-eastern";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export type QuoteRequestNotificationPayload = {
  contractorId: string;
  requestId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  propertyAddress: string;
  projectType: string;
  description: string;
  isUrgent: boolean;
  photoCount: number;
  submittedAt: string;
};

export type QuoteRequestNotificationResult =
  | { sent: true; toEmail: string; resendMessageId?: string }
  | { sent: false; reason: "no_recipient" | "not_configured" | "send_failed"; error?: string };

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

function buildResendFromHeader(): string {
  const envRaw = process.env.RESEND_FROM?.trim() || "Job Proof <hello@jobproof.ca>";
  const email = extractResendMailbox(envRaw);
  return `JobProof <${email}>`;
}

function buildResendFromHeaderForBusiness(businessDisplayName: string | null | undefined): string {
  const envRaw = process.env.RESEND_FROM?.trim() || "Job Proof <hello@jobproof.ca>";
  const email = extractResendMailbox(envRaw);
  const biz = businessDisplayName?.replace(/[\r\n<>"]/g, "").trim().slice(0, 100);
  if (biz) {
    return `${biz} via JobProof <${email}>`;
  }
  return `JobProof <${email}>`;
}

function buildQuoteRequestEmailSubject(customerName: string, isUrgent: boolean): string {
  const name = customerName.trim() || "a customer";
  if (isUrgent) {
    return `URGENT: New quote request from ${name}`;
  }
  return `New quote request from ${name}`;
}

function formatOptionalPhone(phone: string | null): string {
  const trimmed = phone?.trim();
  return trimmed || "—";
}

function buildQuoteRequestDetailUrl(requestId: string): string {
  return `${resolvePublicAppOrigin()}/quote-requests/${requestId}`;
}

function buildQuoteRequestEmailHtml(payload: QuoteRequestNotificationPayload): string {
  const detailUrl = buildQuoteRequestDetailUrl(payload.requestId);
  const href = detailUrl.replace(/"/g, "%22");
  const submittedLabel = formatDateTimeEastern(payload.submittedAt);
  const urgentBlock = payload.isUrgent
    ? `<p style="margin:16px 0;padding:12px 14px;background:#FEF3C7;border:1px solid #FCD34D;border-radius:8px;font-size:14px;color:#92400E;">
        <strong>This request was marked urgent.</strong> The customer was advised to submit details first and then call you directly if immediate help is needed.
      </p>`
    : "";

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5;max-width:560px;color:#18181B;">
      <p>You received a new quote request through your JobProof quote page.</p>
      ${urgentBlock}
      <table style="border-collapse:collapse;width:100%;font-size:14px;margin:16px 0;">
        <tr><td style="padding:6px 12px 6px 0;color:#52525B;vertical-align:top;">Customer</td><td style="padding:6px 0;font-weight:600;">${escapeHtml(payload.customerName)}</td></tr>
        <tr><td style="padding:6px 12px 6px 0;color:#52525B;vertical-align:top;">Phone</td><td style="padding:6px 0;">${escapeHtml(formatOptionalPhone(payload.customerPhone))}</td></tr>
        <tr><td style="padding:6px 12px 6px 0;color:#52525B;vertical-align:top;">Email</td><td style="padding:6px 0;"><a href="mailto:${escapeHtml(payload.customerEmail)}" style="color:#2436BB;">${escapeHtml(payload.customerEmail)}</a></td></tr>
        <tr><td style="padding:6px 12px 6px 0;color:#52525B;vertical-align:top;">Property address</td><td style="padding:6px 0;">${escapeHtml(payload.propertyAddress)}</td></tr>
        <tr><td style="padding:6px 12px 6px 0;color:#52525B;vertical-align:top;">Project type</td><td style="padding:6px 0;">${escapeHtml(payload.projectType)}</td></tr>
        <tr><td style="padding:6px 12px 6px 0;color:#52525B;vertical-align:top;">Urgent</td><td style="padding:6px 0;">${payload.isUrgent ? "Yes" : "No"}</td></tr>
        <tr><td style="padding:6px 12px 6px 0;color:#52525B;vertical-align:top;">Photos uploaded</td><td style="padding:6px 0;">${payload.photoCount}</td></tr>
        <tr><td style="padding:6px 12px 6px 0;color:#52525B;vertical-align:top;">Submitted</td><td style="padding:6px 0;">${escapeHtml(submittedLabel)}</td></tr>
      </table>
      <p style="font-size:14px;color:#3F3F46;white-space:pre-wrap;">${escapeHtml(payload.description)}</p>
      <p style="margin:24px 0 8px;">
        <a href="${href}" style="display:inline-block;background:#2436BB;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">
          View quote request
        </a>
      </p>
      <p style="font-size:13px;color:#71717A;word-break:break-all;">${escapeHtml(detailUrl)}</p>
      <p style="font-size:13px;color:#A1A1AA;margin-top:24px;">Photos are available after you sign in to JobProof.</p>
      <p style="font-size:13px;color:#A1A1AA;">— Job Proof</p>
    </div>
  `;
}

function buildQuoteRequestEmailText(payload: QuoteRequestNotificationPayload): string {
  const detailUrl = buildQuoteRequestDetailUrl(payload.requestId);
  const submittedLabel = formatDateTimeEastern(payload.submittedAt);
  const lines = [
    "You received a new quote request through your JobProof quote page.",
    "",
  ];

  if (payload.isUrgent) {
    lines.push(
      "This request was marked urgent. The customer was advised to submit details first and then call you directly if immediate help is needed.",
      ""
    );
  }

  lines.push(
    `Customer: ${payload.customerName}`,
    `Phone: ${formatOptionalPhone(payload.customerPhone)}`,
    `Email: ${payload.customerEmail}`,
    `Property address: ${payload.propertyAddress}`,
    `Project type: ${payload.projectType}`,
    `Urgent: ${payload.isUrgent ? "Yes" : "No"}`,
    `Photos uploaded: ${payload.photoCount}`,
    `Submitted: ${submittedLabel}`,
    "",
    "Description:",
    payload.description,
    "",
    "View quote request:",
    detailUrl,
    "",
    "Photos are available after you sign in to JobProof.",
    "",
    "— Job Proof"
  );

  return lines.join("\n");
}

/**
 * Resolve contractor notification email: business_contact_email first, then auth user email.
 */
export async function resolveContractorNotificationEmail(
  admin: SupabaseClient,
  contractorId: string
): Promise<{ email: string | null; businessName: string }> {
  const { data: profile } = await admin
    .from("profiles")
    .select("id, business_name, business_contact_email, user_id")
    .eq("id", contractorId)
    .maybeSingle();

  if (!profile?.id) {
    return { email: null, businessName: "Contractor" };
  }

  let authEmail: string | null = null;
  if (profile.user_id) {
    const { data: authUser } = await admin.auth.admin.getUserById(String(profile.user_id));
    authEmail = authUser?.user?.email?.trim() ?? null;
  }

  const email = resolveContractorContactEmail(
    { business_contact_email: profile.business_contact_email },
    authEmail
  );

  return {
    email,
    businessName: String(profile.business_name ?? "Contractor"),
  };
}

/**
 * Notify contractor of a new quote request. Never throws.
 */
export async function sendQuoteRequestReceivedEmail(
  admin: SupabaseClient,
  payload: QuoteRequestNotificationPayload
): Promise<QuoteRequestNotificationResult> {
  try {
    const { email: toEmail } = await resolveContractorNotificationEmail(admin, payload.contractorId);

    if (!toEmail) {
      console.warn("[quote-request-notification] no contractor email", {
        contractorId: payload.contractorId,
        requestId: payload.requestId,
      });
      return { sent: false, reason: "no_recipient" };
    }

    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (!apiKey) {
      console.warn("[quote-request-notification] RESEND_API_KEY not configured", {
        contractorId: payload.contractorId,
        requestId: payload.requestId,
      });
      return { sent: false, reason: "not_configured" };
    }

    const subject = buildQuoteRequestEmailSubject(payload.customerName, payload.isUrgent);
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from: buildResendFromHeader(),
      to: [toEmail],
      subject,
      html: buildQuoteRequestEmailHtml(payload),
      text: buildQuoteRequestEmailText(payload),
    });

    if (error) {
      console.error("[quote-request-notification] Resend error", {
        contractorId: payload.contractorId,
        requestId: payload.requestId,
        message: error.message,
      });
      return { sent: false, reason: "send_failed", error: error.message };
    }

    return { sent: true, toEmail, resendMessageId: data?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[quote-request-notification] unexpected error", {
      contractorId: payload.contractorId,
      requestId: payload.requestId,
      message,
    });
    return { sent: false, reason: "send_failed", error: message };
  }
}

export type QuoteRequestSiteVisitCustomerEmailPayload = {
  requestId: string;
  contractorId: string;
  customerName: string;
  customerEmail: string;
  propertyAddress: string;
  projectType: string;
};

export type QuoteRequestSiteVisitCustomerEmailResult =
  | { sent: true; toEmail: string; resendMessageId?: string }
  | {
      sent: false;
      reason: "no_customer_email" | "not_configured" | "send_failed";
      error?: string;
    };

function buildSiteVisitEmailSubject(businessName: string): string {
  const biz = businessName.trim();
  if (biz) {
    return `${biz} would like to schedule a site visit`;
  }
  return "Your contractor would like to schedule a site visit";
}

function buildSiteVisitNextStepCopy(
  contractorPhone: string | null,
  replyToEmail: string | null
): string {
  const phone = contractorPhone?.trim();
  if (phone && replyToEmail) {
    return `Please reply to this email or call ${phone} to arrange a time.`;
  }
  if (phone) {
    return `Please call ${phone} to arrange a time.`;
  }
  if (replyToEmail) {
    return "Please reply to this email to arrange a time.";
  }
  return "Please contact the contractor to arrange a time.";
}

function buildSiteVisitCustomerEmailHtml(input: {
  customerName: string;
  businessName: string;
  contractorPhone: string | null;
  projectType: string;
  propertyAddress: string;
  replyToEmail: string | null;
}): string {
  const greeting = input.customerName.trim() || "there";
  const businessName = input.businessName.trim() || "Your contractor";
  const nextStep = buildSiteVisitNextStepCopy(input.contractorPhone, input.replyToEmail);

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5;max-width:560px;color:#18181B;">
      <p>Hi ${escapeHtml(greeting)},</p>
      <p>
        Thanks for submitting your quote request. <strong>${escapeHtml(businessName)}</strong> has reviewed your project details and would like to arrange a site visit before providing the quote.
      </p>
      <table style="border-collapse:collapse;width:100%;font-size:14px;margin:16px 0;">
        <tr><td style="padding:6px 12px 6px 0;color:#52525B;vertical-align:top;">Project type</td><td style="padding:6px 0;">${escapeHtml(input.projectType)}</td></tr>
        <tr><td style="padding:6px 12px 6px 0;color:#52525B;vertical-align:top;">Property address</td><td style="padding:6px 0;">${escapeHtml(input.propertyAddress)}</td></tr>
        ${
          input.contractorPhone?.trim()
            ? `<tr><td style="padding:6px 12px 6px 0;color:#52525B;vertical-align:top;">Contractor phone</td><td style="padding:6px 0;">${escapeHtml(input.contractorPhone.trim())}</td></tr>`
            : ""
        }
      </table>
      <p style="font-size:14px;color:#3F3F46;"><strong>Suggested next step:</strong> ${escapeHtml(nextStep)}</p>
      <p style="font-size:13px;color:#A1A1AA;margin-top:24px;">— Job Proof</p>
    </div>
  `;
}

function buildSiteVisitCustomerEmailText(input: {
  customerName: string;
  businessName: string;
  contractorPhone: string | null;
  projectType: string;
  propertyAddress: string;
  replyToEmail: string | null;
}): string {
  const greeting = input.customerName.trim() || "there";
  const businessName = input.businessName.trim() || "Your contractor";
  const nextStep = buildSiteVisitNextStepCopy(input.contractorPhone, input.replyToEmail);

  return [
    `Hi ${greeting},`,
    "",
    `Thanks for submitting your quote request. ${businessName} has reviewed your project details and would like to arrange a site visit before providing the quote.`,
    "",
    `Project type: ${input.projectType}`,
    `Property address: ${input.propertyAddress}`,
    input.contractorPhone?.trim() ? `Contractor phone: ${input.contractorPhone.trim()}` : null,
    "",
    `Suggested next step: ${nextStep}`,
    "",
    "— Job Proof",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

/**
 * Email the customer when a contractor requests a site visit. Never throws.
 */
export async function sendQuoteRequestSiteVisitCustomerEmail(
  payload: QuoteRequestSiteVisitCustomerEmailPayload
): Promise<QuoteRequestSiteVisitCustomerEmailResult> {
  const customerEmail = payload.customerEmail?.trim();
  if (!customerEmail) {
    console.warn("[quote-request-site-visit-email] no customer email", {
      contractorId: payload.contractorId,
      requestId: payload.requestId,
    });
    return { sent: false, reason: "no_customer_email" };
  }

  try {
    const admin = createServiceRoleClient();
    if (!admin) {
      console.warn("[quote-request-site-visit-email] service role unavailable", {
        contractorId: payload.contractorId,
        requestId: payload.requestId,
      });
      return { sent: false, reason: "not_configured" };
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("business_name, phone, business_contact_email, user_id")
      .eq("id", payload.contractorId)
      .maybeSingle();

    const businessName = String(profile?.business_name ?? "Your contractor");
    const contractorPhone = profile?.phone ? String(profile.phone) : null;

    const { email: replyToEmail } = await resolveContractorNotificationEmail(admin, payload.contractorId);

    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (!apiKey) {
      console.warn("[quote-request-site-visit-email] RESEND_API_KEY not configured", {
        contractorId: payload.contractorId,
        requestId: payload.requestId,
      });
      return { sent: false, reason: "not_configured" };
    }

    const emailContent = {
      customerName: payload.customerName,
      businessName,
      contractorPhone,
      projectType: payload.projectType,
      propertyAddress: payload.propertyAddress,
      replyToEmail,
    };

    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from: buildResendFromHeaderForBusiness(businessName),
      to: [customerEmail],
      subject: buildSiteVisitEmailSubject(businessName),
      html: buildSiteVisitCustomerEmailHtml(emailContent),
      text: buildSiteVisitCustomerEmailText(emailContent),
      ...(replyToEmail ? { replyTo: replyToEmail } : {}),
    });

    if (error) {
      console.error("[quote-request-site-visit-email] Resend error", {
        contractorId: payload.contractorId,
        requestId: payload.requestId,
        message: error.message,
      });
      return { sent: false, reason: "send_failed", error: error.message };
    }

    return { sent: true, toEmail: customerEmail, resendMessageId: data?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[quote-request-site-visit-email] unexpected error", {
      contractorId: payload.contractorId,
      requestId: payload.requestId,
      message,
    });
    return { sent: false, reason: "send_failed", error: message };
  }
}
