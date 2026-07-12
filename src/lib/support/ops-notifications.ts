import { Resend } from "resend";
import { resolveAppUrl } from "@/lib/stripe";

/**
 * Ops / internal notifications for Support Center and future intake forms.
 * Extensible kinds avoid duplicating Resend wiring per form.
 */
export type OpsNotificationKind =
  | "support_ticket"
  | "feature_request"
  | "bug_report"
  | "trial_extension_request"
  | "affiliate_application"
  | "billing_question"
  | "partner_portal_application";

export type OpsNotificationField = {
  label: string;
  value: string;
};

export type SendOpsNotificationInput = {
  kind: OpsNotificationKind;
  subject: string;
  /** Contractor email — used as Reply-To so ops can reply directly. */
  replyTo: string;
  fields: OpsNotificationField[];
  /** Optional longer body section (e.g. message / description). */
  messageLabel?: string;
  messageBody?: string;
};

export type SendOpsNotificationResult =
  | { ok: true }
  | { ok: false; error: string; skipped?: boolean };

function fromAddress(): string {
  return process.env.RESEND_FROM?.trim() || "Job Proof <hello@jobproof.ca>";
}

/** Destination for Support Center ops emails. */
export function getSupportOpsEmail(): string | null {
  const email = process.env.SUPPORT_EMAIL?.trim();
  return email || null;
}

export function adminUserUrl(profileId: string): string {
  return `${resolveAppUrl()}/admin/users/${profileId}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatFieldsHtml(fields: OpsNotificationField[]): string {
  const rows = fields
    .map(
      (f) =>
        `<tr>
          <td style="padding:6px 12px 6px 0;vertical-align:top;color:#71717a;white-space:nowrap;">${escapeHtml(f.label)}</td>
          <td style="padding:6px 0;vertical-align:top;color:#18181b;">${escapeHtml(f.value || "—")}</td>
        </tr>`
    )
    .join("");
  return `<table style="border-collapse:collapse;width:100%;font-size:14px;line-height:1.45;">${rows}</table>`;
}

function formatFieldsText(fields: OpsNotificationField[]): string {
  return fields.map((f) => `${f.label}: ${f.value || "—"}`).join("\n");
}

/**
 * Sends an internal ops email via Resend.
 * Does not throw — callers must keep user submissions successful on failure.
 */
export async function sendOpsNotification(
  input: SendOpsNotificationInput
): Promise<SendOpsNotificationResult> {
  const to = getSupportOpsEmail();
  if (!to) {
    console.error(
      `[ops-notifications] SUPPORT_EMAIL is not configured — skipped ${input.kind} notification`
    );
    return { ok: false, error: "SUPPORT_EMAIL is not configured", skipped: true };
  }

  const replyTo = String(input.replyTo ?? "").trim();
  if (!replyTo) {
    console.error(`[ops-notifications] Missing replyTo for ${input.kind}`);
    return { ok: false, error: "Missing reply-to address" };
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.error(`[ops-notifications] RESEND_API_KEY missing — skipped ${input.kind}`);
    return { ok: false, error: "Email service not configured", skipped: true };
  }

  const messageHtml =
    input.messageBody != null && String(input.messageBody).trim()
      ? `<p style="margin:20px 0 8px;font-size:14px;color:#71717a;">${escapeHtml(input.messageLabel ?? "Message")}</p>
         <div style="padding:12px 14px;background:#f4f4f5;border-radius:8px;font-size:14px;color:#18181b;white-space:pre-wrap;">${escapeHtml(String(input.messageBody).trim())}</div>`
      : "";

  const messageText =
    input.messageBody != null && String(input.messageBody).trim()
      ? `\n${input.messageLabel ?? "Message"}:\n${String(input.messageBody).trim()}\n`
      : "";

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:640px;margin:0 auto;color:#18181b;">
      <p style="font-size:16px;font-weight:600;margin:0 0 16px;">${escapeHtml(input.subject)}</p>
      ${formatFieldsHtml(input.fields)}
      ${messageHtml}
      <p style="margin-top:24px;font-size:12px;color:#a1a1aa;">JobProof ops notification (${escapeHtml(input.kind)}). Reply to this email to reach the contractor.</p>
    </div>
  `;

  const text = `${input.subject}\n\n${formatFieldsText(input.fields)}${messageText}\n\nReply to this email to reach the contractor.\n`;

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: fromAddress(),
      to,
      replyTo,
      subject: input.subject,
      html,
      text,
    });
    if (error) {
      console.error(`[ops-notifications] Resend error (${input.kind}):`, error);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Email send failed";
    console.error(`[ops-notifications] ${input.kind}:`, msg);
    return { ok: false, error: msg };
  }
}

export function supportTicketCategoryLabel(category: string): string {
  const map: Record<string, string> = {
    general_question: "General Question",
    need_help: "Need Help",
    bug_report: "Bug Report",
    feature_suggestion: "Feature Suggestion",
    billing: "Billing",
  };
  return map[category] ?? category;
}

export function featureRequestCategoryLabel(category: string): string {
  const map: Record<string, string> = {
    quoting: "Quoting",
    customers: "Customers",
    billing: "Billing",
    mobile: "Mobile",
    integrations: "Integrations",
    reporting: "Reporting",
    other: "Other",
  };
  return map[category] ?? category;
}

export function formatOpsDateTime(iso: string = new Date().toISOString()): string {
  try {
    return new Date(iso).toLocaleString("en-CA", {
      timeZone: "America/Toronto",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });
  } catch {
    return iso;
  }
}
