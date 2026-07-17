import { Resend } from "resend";
import { resolveAppUrl } from "@/lib/stripe";
import {
  FOUNDING_REWARD_CAD,
  partnerLevelLabel,
  STANDARD_REWARD_CAD,
  type PartnerLevel,
} from "@/lib/partners/constants";

function fromAddress(): string {
  return process.env.RESEND_FROM?.trim() || "Job Proof <hello@jobproof.ca>";
}

async function sendSimpleEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.error("[partner-emails] RESEND_API_KEY missing");
    return { ok: false, error: "Email service not configured" };
  }
  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: fromAddress(),
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
    if (error) {
      console.error("[partner-emails] Resend error:", error);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Email send failed";
    console.error("[partner-emails]", msg);
    return { ok: false, error: msg };
  }
}

function wrap(bodyHtml: string): string {
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#18181b;line-height:1.5;font-size:15px;">${bodyHtml}<p style="margin-top:28px;font-size:12px;color:#a1a1aa;">JobProof Partner Program · <a href="${resolveAppUrl()}/partners" style="color:#2436BB;">jobproof.ca/partners</a></p></div>`;
}

export async function sendPartnerApplicationReceivedEmail(input: {
  to: string;
  contactName: string;
}) {
  const subject = "We received your JobProof Partner application";
  const html = wrap(`
    <p>Hi ${escape(input.contactName)},</p>
    <p>Thanks for applying to the JobProof Partner Program. Our team will review your application and follow up by email.</p>
    <p>We look forward to learning more about how you work with contractors.</p>
    <p>— The JobProof Team</p>
  `);
  const text = `Hi ${input.contactName},\n\nThanks for applying to the JobProof Partner Program. Our team will review your application and follow up by email.\n\n— The JobProof Team\n`;
  return sendSimpleEmail({ to: input.to, subject, html, text });
}

export async function sendPartnerApprovedEmail(input: {
  to: string;
  contactName: string;
  organizationName: string;
  level: PartnerLevel;
  referralCode: string;
  referralUrl: string;
}) {
  const reward = input.level === "founding" ? FOUNDING_REWARD_CAD : STANDARD_REWARD_CAD;
  const portalUrl = `${resolveAppUrl()}/partner`;
  const agreementUrl = `${resolveAppUrl()}/partners/agreement`;
  const subject = "Welcome to the JobProof Partner Program";
  const foundingBadge =
    input.level === "founding"
      ? '<p><span style="display:inline-block;border:1px solid #b8c0f2;background:#f4f5ff;color:#2436BB;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:600;">Founding Partner</span></p>'
      : "";
  const html = wrap(`
    <p>Hi ${escape(input.contactName)},</p>
    <p>Your application for <strong>${escape(input.organizationName)}</strong> has been approved.</p>
    ${foundingBadge}
    <p>You are a <strong>${escape(partnerLevelLabel(input.level))}</strong> and earn <strong>$${reward} CAD</strong> for each qualified referral. A referral qualifies after the contractor remains a paying JobProof subscriber for 90 consecutive days. Rewards are reviewed and paid manually, and there are no recurring commissions.</p>
    <p><strong>Your referral link:</strong><br/><a href="${escape(input.referralUrl)}" style="color:#2436BB;">${escape(input.referralUrl)}</a></p>
    <p><strong>Referral code:</strong> ${escape(input.referralCode)}</p>
    <p><a href="${portalUrl}" style="display:inline-block;margin-top:12px;background:#2436BB;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600;">Open Partner Portal</a></p>
    <p><a href="${agreementUrl}" style="color:#2436BB;">View the Partner Program Agreement</a></p>
    <p style="font-size:13px;color:#52525b;">Sign in (or create an account) with <strong>${escape(input.to)}</strong> to access the portal.</p>
    <p>— The JobProof Team</p>
  `);
  const text = `Hi ${input.contactName},\n\nYour JobProof Partner application is approved (${partnerLevelLabel(input.level)}, $${reward} CAD per qualified referral). A referral qualifies after 90 consecutive days as a paying JobProof subscriber. Rewards are reviewed and paid manually; there are no recurring commissions.\n\nReferral link: ${input.referralUrl}\nCode: ${input.referralCode}\nPortal: ${portalUrl}\nAgreement: ${agreementUrl}\n\n— The JobProof Team\n`;
  return sendSimpleEmail({ to: input.to, subject, html, text });
}

export async function sendPartnerDeclinedEmail(input: {
  to: string;
  contactName: string;
}) {
  const subject = "Update on your JobProof Partner application";
  const html = wrap(`
    <p>Hi ${escape(input.contactName)},</p>
    <p>Thank you for your interest in the JobProof Partner Program. After review, we are not able to approve your application at this time.</p>
    <p>If you have questions, reply to this email or contact us through the website.</p>
    <p>— The JobProof Team</p>
  `);
  const text = `Hi ${input.contactName},\n\nThank you for your interest. We are not able to approve your JobProof Partner application at this time.\n\n— The JobProof Team\n`;
  return sendSimpleEmail({ to: input.to, subject, html, text });
}

export async function sendPartnerReferralLifecycleEmail(input: {
  to: string;
  contactName: string;
  kind:
    | "signup"
    | "trial_started"
    | "subscription_started"
    | "qualified"
    | "reward_approved"
    | "reward_paid";
  businessName?: string | null;
  amountCad?: number | null;
  paymentDate?: string | null;
  paymentReference?: string | null;
}) {
  const biz = input.businessName?.trim() || "A contractor";
  const paidDate = input.paymentDate
    ? new Intl.DateTimeFormat("en-CA", { dateStyle: "long", timeZone: "UTC" }).format(
        new Date(input.paymentDate)
      )
    : "the recorded payment date";
  const paidReference = input.paymentReference?.trim()
    ? ` Payment reference: ${input.paymentReference.trim()}.`
    : "";
  const copy: Record<typeof input.kind, { subject: string; body: string }> = {
    signup: {
      subject: "New JobProof referral signup",
      body: `${biz} signed up using your referral link. We'll notify you as they progress through trial and subscription.`,
    },
    trial_started: {
      subject: "Your referral started a JobProof trial",
      body: `${biz} started a free JobProof trial.`,
    },
    subscription_started: {
      subject: "Your referral subscribed to JobProof",
      body: `${biz} became a paying JobProof subscriber. Your reward qualifies after 90 consecutive days as a paying subscriber, followed by manual review and approval.`,
    },
    qualified: {
      subject: "Referral reward qualified",
      body: `${biz} has met the 90 consecutive-day paying-subscriber requirement. Your $${input.amountCad ?? ""} CAD reward is qualified and awaiting manual review and approval. It has not been paid yet.`,
    },
    reward_approved: {
      subject: "Referral reward approved",
      body: `Your $${input.amountCad ?? ""} CAD referral reward for ${biz} has been approved and will be paid according to your payment details on file.`,
    },
    reward_paid: {
      subject: "Referral reward paid",
      body: `Your $${input.amountCad ?? ""} CAD referral reward for ${biz} was paid on ${paidDate}.${paidReference}`,
    },
  };
  const c = copy[input.kind];
  const html = wrap(`
    <p>Hi ${escape(input.contactName)},</p>
    <p>${escape(c.body)}</p>
    <p><a href="${resolveAppUrl()}/partner" style="color:#2436BB;">View Partner Portal</a></p>
    <p>— The JobProof Team</p>
  `);
  const text = `Hi ${input.contactName},\n\n${c.body}\n\nPortal: ${resolveAppUrl()}/partner\n\n— The JobProof Team\n`;
  return sendSimpleEmail({ to: input.to, subject: c.subject, html, text });
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
