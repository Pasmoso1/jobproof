/**
 * Transactional email delivery for JobProof.
 * Signing links: Resend when RESEND_API_KEY is set. SMS is not implemented.
 */

import { Resend } from "resend";
import { insertEmailLog, type EmailLogEntityType } from "@/lib/email-log";
import { formatDateTimeEastern } from "@/lib/datetime-eastern";

/** When set, every send attempt is recorded in `email_logs` (success or failure). */
export interface EmailDeliveryAuditLog {
  profileId: string;
  type: EmailLogEntityType;
  relatedEntityId: string | null;
}

export interface SendSigningLinkOptions {
  toEmail: string;
  toName: string;
  signingUrl: string;
  /** Used in subject: "Signature required: {jobTitle}" and email body. */
  jobTitle: string;
  expiresAt: Date;
  /** Contractor business name for From: "{name} via JobProof <email>". Omit to use "JobProof <email>". */
  businessDisplayName?: string | null;
  deliveryLog?: EmailDeliveryAuditLog;
  /** When set, email lists subtotal, tax, total, deposit, and balance (matches contract + invoice logic). */
  contractPricing?: {
    subtotalPreTax: number;
    taxShortLabel: string;
    taxAmount: number;
    totalIncludingTax: number;
    deposit: number;
    balanceDueOnCompletion: number;
  } | null;
}

export interface DeliveryResult {
  success: boolean;
  error?: string;
  /** Resend message id when send succeeded (server-side only; not exposed to client unless you pass it). */
  resendMessageId?: string;
}

function moneyEmail(n: number): string {
  return `$${Number(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function signingLinkEmailHtml(opts: SendSigningLinkOptions): string {
  const exp = formatDateTimeEastern(opts.expiresAt);
  const href = opts.signingUrl.replace(/"/g, "%22");
  const p = opts.contractPricing;
  const pricingBlock =
    p != null
      ? `
      <table style="border-collapse:collapse;margin:16px 0;font-size:14px;color:#333;max-width:100%;">
        <tr><td style="padding:4px 12px 4px 0;color:#555;">Contract subtotal (before tax)</td><td style="padding:4px 0;font-weight:600;">${escapeHtml(moneyEmail(p.subtotalPreTax))}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#555;">Tax (${escapeHtml(p.taxShortLabel)})</td><td style="padding:4px 0;font-weight:600;">${escapeHtml(moneyEmail(p.taxAmount))}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#555;">Total contract price (including tax)</td><td style="padding:4px 0;font-weight:600;">${escapeHtml(moneyEmail(p.totalIncludingTax))}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#555;">Deposit</td><td style="padding:4px 0;font-weight:600;">${escapeHtml(moneyEmail(p.deposit))}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#555;">Balance due on completion</td><td style="padding:4px 0;font-weight:600;">${escapeHtml(moneyEmail(p.balanceDueOnCompletion))}</td></tr>
      </table>
      <p style="font-size:13px;color:#555;">
        The <strong>balance due on completion</strong> is your remaining amount after the deposit, based on the
        <strong>total contract price including tax</strong> (not the pre-tax subtotal alone).
      </p>
    `
      : "";
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; max-width: 560px;">
      <p>Hi ${escapeHtml(opts.toName || "there")},</p>
      <p>
        Please review and sign the document for <strong>${escapeHtml(opts.jobTitle)}</strong>.
      </p>
      ${pricingBlock}
      <p>
        <a href="${href}" style="display:inline-block;background:#2436BB;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">
          Open signing page
        </a>
      </p>
      <p style="font-size:14px;color:#555;">
        Or copy this link:<br />
        <span style="word-break:break-all;">${escapeHtml(opts.signingUrl)}</span>
      </p>
      <p style="font-size:13px;color:#666;">
        This link expires around <strong>${escapeHtml(exp)}</strong>.
      </p>
      <p style="font-size:13px;color:#888;">— Job Proof</p>
    </div>
  `;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Pull mailbox from `Name <addr>` or plain `addr`. */
function extractResendMailbox(raw: string): string {
  const m = raw.match(/<([^>]+)>/);
  if (m) return m[1].trim();
  return raw.trim();
}

/**
 * Resend From header: "{business_name} via JobProof <verified-email>".
 * Email address always comes from RESEND_FROM (or default) so it stays verified in Resend.
 */
function buildResendFromHeader(businessDisplayName: string | null | undefined): string {
  const envRaw =
    process.env.RESEND_FROM?.trim() || "Job Proof <hello@jobproof.ca>";
  const email = extractResendMailbox(envRaw);
  const biz = businessDisplayName?.replace(/[\r\n<>"]/g, "").trim().slice(0, 100);
  if (biz) {
    return `${biz} via JobProof <${email}>`;
  }
  return `JobProof <${email}>`;
}

function signingEmailSubject(jobTitle: string): string {
  const t = jobTitle.trim() || "your document";
  const max = 180;
  const suffix = t.length > max ? `${t.slice(0, max - 1)}…` : t;
  return `Signature required: ${suffix}`;
}

/** Opt-in diagnostics: set JOBPROOF_EMAIL_DEBUG=1 (never logs full API key). */
function isEmailDebugEnabled(): boolean {
  const v = process.env.JOBPROOF_EMAIL_DEBUG?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/** Safe debug lines only when JOBPROOF_EMAIL_DEBUG is set — no secret values. */
function logJobProofEmailDebug(lines: string[]) {
  if (!isEmailDebugEnabled()) return;
  for (const line of lines) {
    console.log(`[JobProof:Email] ${line}`);
  }
}

/**
 * Sends the remote signing URL to the customer via Resend when configured.
 * - Production without RESEND_API_KEY: returns { success: false, error: "Email service not configured" }.
 * - Development without key: logs warning and returns success as a dev fallback (no Resend call).
 */
export async function sendSigningLinkEmail(
  options: SendSigningLinkOptions
): Promise<DeliveryResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const fromEnv = process.env.RESEND_FROM?.trim();
  const from = buildResendFromHeader(options.businessDisplayName ?? null);
  const subject = signingEmailSubject(options.jobTitle);
  const isProd = process.env.NODE_ENV === "production";

  logJobProofEmailDebug([
    `resendApiKeyPresent: ${Boolean(apiKey)}`,
    `resendApiKeyLength: ${apiKey ? apiKey.length : 0}`,
    `resendFrom: ${from}`,
    `resendFromSource: ${fromEnv ? "RESEND_FROM env (mailbox)" : "fallback default mailbox"}`,
    `emailSubject: ${subject.slice(0, 120)}${subject.length > 120 ? "…" : ""}`,
    `recipient: ${options.toEmail.trim()}`,
    `nodeEnv: ${process.env.NODE_ENV ?? "(unset)"}`,
  ]);

  let result: DeliveryResult;

  if (!apiKey) {
    logJobProofEmailDebug([
      "resend_response: skipped (no API key)",
      `devFallbackActive: ${!isProd}`,
    ]);
    console.warn(
      "[DeliveryService] RESEND_API_KEY not set — signing link not emailed. URL:",
      options.signingUrl
    );
    if (isProd) {
      result = {
        success: false,
        error: "Email service not configured",
      };
    } else {
      result = { success: true };
    }
  } else {
    try {
      const resend = new Resend(apiKey);
      const { data, error } = await resend.emails.send({
        from,
        to: options.toEmail.trim(),
        subject,
        html: signingLinkEmailHtml(options),
      });

      if (error) {
        logJobProofEmailDebug([
          "resend_response: failed",
          `resendError: ${
            typeof error === "object" && error && "message" in error
              ? String((error as { message: string }).message)
              : String(error)
          }`,
        ]);
        console.error("[DeliveryService] Resend error:", error);
        result = {
          success: false,
          error:
            typeof error === "object" && error && "message" in error
              ? String((error as { message: string }).message)
              : "Failed to send email",
        };
      } else {
        const messageId = data?.id;
        logJobProofEmailDebug([
          "resend_response: success",
          ...(messageId ? [`resendMessageId: ${messageId}`] : []),
        ]);
        result = { success: true, resendMessageId: messageId };
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to send email";
      logJobProofEmailDebug(["resend_response: failed", `resendError: ${msg}`]);
      console.error("[DeliveryService] sendSigningLinkEmail:", e);
      result = { success: false, error: msg };
    }
  }

  if (options.deliveryLog) {
    await insertEmailLog({
      profileId: options.deliveryLog.profileId,
      type: options.deliveryLog.type,
      recipientEmail: options.toEmail,
      status: result.success ? "success" : "failed",
      errorMessage: result.success ? null : result.error ?? null,
      relatedEntityId: options.deliveryLog.relatedEntityId,
    });
  }

  return result;
}

export async function sendSigningLinkSms(
  phoneNumber: string,
  signingUrl: string,
  jobTitle: string
): Promise<DeliveryResult> {
  console.log("[DeliveryService] Would send signing link SMS:", {
    to: phoneNumber,
    jobTitle,
  });
  return { success: true };
}

export interface SignedContractSummaryRow {
  label: string;
  value: string;
}

export interface SendSignedContractOptions {
  toEmail: string;
  toName: string;
  jobTitle: string;
  businessDisplayName?: string | null;
  recipient: "customer" | "contractor";
  /** Written summary of the signed agreement (always included). */
  summaryRows: SignedContractSummaryRow[];
  /** When a PDF exists in storage and was loaded for this send. */
  pdfAttachment?: { filename: string; contentBase64: string };
  /** Logged-in contractor: full contract screen in the app. */
  contractorDashboardLink?: string | null;
  /**
   * When the customer and contractor share the same email, add a line to the customer
   * email pointing at the in-app contract view.
   */
  alsoContractorOnAccount?: boolean;
  deliveryLog?: EmailDeliveryAuditLog;
}

function signedContractEmailHtml(opts: SendSignedContractOptions): string {
  const rowsHtml = opts.summaryRows
    .map(
      (r) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#555;vertical-align:top;white-space:nowrap;">${escapeHtml(r.label)}</td><td style="padding:6px 0;vertical-align:top;">${escapeHtml(r.value)}</td></tr>`
    )
    .join("");

  const pdfNote = opts.pdfAttachment
    ? `<p><strong>Attached:</strong> signed contract (PDF).</p>`
    : `<p style="color:#666;font-size:14px;"><strong>Note:</strong> A PDF is not attached yet (PDF generation is not enabled). The table below is a written summary of the agreement as recorded in JobProof—please keep this email for your records.</p>`;

  const dashboardHref = opts.contractorDashboardLink
    ? opts.contractorDashboardLink.replace(/"/g, "%22")
    : "";

  const contractorBlock =
    opts.recipient === "contractor" && dashboardHref
      ? `<p><a href="${dashboardHref}" style="display:inline-block;background:#2436BB;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;">Open contract in JobProof</a></p><p style="font-size:13px;color:#666;">Sign in with your contractor account to view the full signed record.</p>`
      : "";

  const dualNote =
    opts.recipient === "customer" &&
    opts.alsoContractorOnAccount &&
    dashboardHref
      ? `<p style="font-size:14px;color:#555;">You also manage this job in JobProof — <a href="${dashboardHref}" style="color:#2436BB;font-weight:600;">open the contract in the app</a> for the full record.</p>`
      : "";

  const intro =
    opts.recipient === "customer"
      ? `<p>Thank you for signing. Here is a copy of your agreement for your records.</p>`
      : `<p>A customer has signed this contract. Below is a summary copy for your files.</p>`;

  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; max-width: 560px;">
      <p>Hi ${escapeHtml(opts.toName || "there")},</p>
      ${intro}
      ${pdfNote}
      <table style="border-collapse:collapse;margin:16px 0;width:100%;">${rowsHtml}</table>
      ${contractorBlock}
      ${dualNote}
      <p style="font-size:13px;color:#888;">— JobProof</p>
    </div>
  `;
}

/**
 * After signing: email a summary to the customer (and optionally the contractor via Resend).
 * PDF is attached only when `generateSignedContractPdf` returns a path and the file can be read with the service role.
 */
export async function sendSignedContractEmail(
  options: SendSignedContractOptions
): Promise<DeliveryResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = buildResendFromHeader(options.businessDisplayName ?? null);
  const title = options.jobTitle.trim() || "Contract";
  const subject =
    options.recipient === "customer"
      ? `Signed copy: ${title}`
      : `Contract signed: ${title}`;
  const isProd = process.env.NODE_ENV === "production";
  const html = signedContractEmailHtml(options);

  let result: DeliveryResult;

  if (!apiKey) {
    console.warn(
      "[DeliveryService] RESEND_API_KEY not set — signed contract email not sent.",
      { to: options.toEmail, recipient: options.recipient }
    );
    result = isProd
      ? { success: false, error: "Email service not configured" }
      : { success: true };
  } else {
    try {
      const resend = new Resend(apiKey);
      const attachments = options.pdfAttachment
        ? [
            {
              filename: options.pdfAttachment.filename,
              content: options.pdfAttachment.contentBase64,
            },
          ]
        : undefined;

      const { data, error } = await resend.emails.send({
        from,
        to: options.toEmail.trim(),
        subject,
        html,
        ...(attachments ? { attachments } : {}),
      });

      if (error) {
        console.error("[DeliveryService] Resend error (signed contract):", error);
        result = {
          success: false,
          error:
            typeof error === "object" && error && "message" in error
              ? String((error as { message: string }).message)
              : "Failed to send email",
        };
      } else {
        result = { success: true, resendMessageId: data?.id };
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to send email";
      console.error("[DeliveryService] sendSignedContractEmail:", e);
      result = { success: false, error: msg };
    }
  }

  if (options.deliveryLog) {
    await insertEmailLog({
      profileId: options.deliveryLog.profileId,
      type: options.deliveryLog.type,
      recipientEmail: options.toEmail,
      status: result.success ? "success" : "failed",
      errorMessage: result.success ? null : result.error ?? null,
      relatedEntityId: options.deliveryLog.relatedEntityId,
    });
  }

  return result;
}

export interface InvoiceEmailPartyBlock {
  businessName: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  addressLines: string[];
}

export interface InvoiceEmailCustomerBlock {
  name: string;
  email: string | null;
  phone: string | null;
  serviceAddressLines: string[];
}

export interface SendInvoiceEmailOptions {
  toEmail: string;
  toName: string;
  jobTitle: string;
  /** Used for Resend From: "{name} via JobProof <…>". */
  businessDisplayName?: string | null;
  replyToEmail?: string | null;
  contractor: InvoiceEmailPartyBlock;
  customer: InvoiceEmailCustomerBlock;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string | null;
  subtotal: number;
  taxAmount: number;
  taxRateLabel: string;
  total: number;
  depositReceived: number;
  balanceDue: number;
  paymentInstructions: string;
  paymentContactLines: string[];
  notes: string | null;
  pdfAttachment?: { filename: string; contentBase64: string };
  /** Customer-facing page (no login), e.g. https://…/invoice/{public_token} */
  publicInvoiceUrl?: string | null;
  deliveryLog?: EmailDeliveryAuditLog;
}

function moneyHtml(n: number): string {
  return escapeHtml(
    n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
}

function linesToHtml(lines: string[]): string {
  return lines
    .filter((l) => l.trim())
    .map((l) => `<div>${escapeHtml(l)}</div>`)
    .join("");
}

function invoiceEmailHtml(opts: SendInvoiceEmailOptions): string {
  const c = opts.contractor;
  const cu = opts.customer;
  const contractorBody = [
    c.businessName,
    c.contactName ? `Contact: ${c.contactName}` : null,
    c.phone ? `Phone: ${c.phone}` : null,
    c.email ? `Email: ${c.email}` : null,
    ...c.addressLines,
  ]
    .filter(Boolean)
    .map((s) => String(s));

  const customerBody = [
    cu.name,
    cu.email ? `Email: ${cu.email}` : null,
    cu.phone ? `Phone: ${cu.phone}` : null,
    ...(cu.serviceAddressLines.some((l) => l.trim())
      ? ["Service address:", ...cu.serviceAddressLines.filter((l) => l.trim())]
      : []),
  ]
    .filter(Boolean)
    .map((s) => String(s));

  const paymentContactBlock =
    opts.paymentContactLines.filter((l) => l.trim()).length > 0
      ? `<p style="margin:12px 0 4px;font-weight:600;">Payment contact</p>${linesToHtml(opts.paymentContactLines)}`
      : "";

  const notesBlock =
    opts.notes && opts.notes.trim()
      ? `<div style="margin-top:16px;padding-top:16px;border-top:1px solid #e5e7eb;">
          <p style="margin:0 0 6px;font-weight:600;">Notes</p>
          <div style="font-size:14px;color:#374151;">${escapeHtml(opts.notes).replace(/\n/g, "<br/>")}</div>
        </div>`
      : "";

  const pdfNote = opts.pdfAttachment
    ? `<p style="margin-top:14px;font-size:14px;color:#374151;">A detailed PDF copy is attached to this email.</p>`
    : "";

  const viewOnlineBlock =
    opts.publicInvoiceUrl?.trim() &&
    /^https?:\/\//i.test(opts.publicInvoiceUrl.trim())
      ? `<div style="margin-top:20px;padding:16px 18px;background:#eef2ff;border-radius:10px;border:1px solid #c7d2fe;">
          <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#2436BB;">View your invoice online</p>
          <p style="margin:0 0 12px;font-size:14px;color:#1e293b;">Open your invoice in the browser to view details, download a PDF, or print — no sign-in required.</p>
          <a href="${escapeHtml(opts.publicInvoiceUrl.trim())}" style="display:inline-block;padding:10px 18px;background:#2436BB;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">View invoice</a>
        </div>`
      : "";

  return `
    <div style="font-family: Arial, Helvetica, sans-serif; line-height: 1.55; max-width: 600px; color: #111827;">
      <p style="font-size:16px;">Hi ${escapeHtml(opts.toName || "there")},</p>
      <p style="font-size:15px;">
        Please find your invoice from <strong>${escapeHtml(c.businessName)}</strong> for
        <strong>${escapeHtml(opts.jobTitle)}</strong>.
      </p>
      ${pdfNote}
      ${viewOnlineBlock}

      <div style="margin-top:22px;padding:14px 16px;background:#f9fafb;border-radius:10px;border:1px solid #e5e7eb;">
        <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#2436BB;text-transform:uppercase;letter-spacing:0.04em;">Contractor</p>
        ${linesToHtml(contractorBody)}
      </div>

      <div style="margin-top:16px;padding:14px 16px;background:#f9fafb;border-radius:10px;border:1px solid #e5e7eb;">
        <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#2436BB;text-transform:uppercase;letter-spacing:0.04em;">Customer &amp; job address</p>
        ${linesToHtml(customerBody)}
      </div>

      <div style="margin-top:20px;">
        <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#2436BB;text-transform:uppercase;letter-spacing:0.04em;">Invoice</p>
        <table style="border-collapse:collapse;width:100%;max-width:440px;font-size:14px;">
          <tr><td style="padding:4px 12px 4px 0;color:#6b7280;">Invoice number</td><td style="padding:4px 0;text-align:right;font-weight:600;">${escapeHtml(opts.invoiceNumber)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#6b7280;">Issue date</td><td style="padding:4px 0;text-align:right;">${escapeHtml(opts.issueDate)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#6b7280;">Due date</td><td style="padding:4px 0;text-align:right;">${opts.dueDate ? escapeHtml(opts.dueDate) : "—"}</td></tr>
        </table>
        <table style="border-collapse:collapse;margin-top:14px;width:100%;max-width:440px;font-size:14px;">
          <tr><td style="padding:6px 12px 6px 0;color:#6b7280;">Subtotal</td><td style="padding:6px 0;text-align:right;">$${moneyHtml(opts.subtotal)}</td></tr>
          <tr><td style="padding:6px 12px 6px 0;color:#6b7280;">Tax (${escapeHtml(opts.taxRateLabel)})</td><td style="padding:6px 0;text-align:right;">$${moneyHtml(opts.taxAmount)}</td></tr>
          <tr><td style="padding:6px 12px 6px 0;font-weight:600;">Total</td><td style="padding:6px 0;text-align:right;font-weight:600;">$${moneyHtml(opts.total)}</td></tr>
          <tr><td style="padding:6px 12px 6px 0;color:#6b7280;">Deposit received</td><td style="padding:6px 0;text-align:right;">$${moneyHtml(opts.depositReceived)}</td></tr>
          <tr><td style="padding:8px 12px 6px 0;font-weight:700;color:#2436BB;">Balance due</td><td style="padding:8px 0;text-align:right;font-weight:700;color:#2436BB;">$${moneyHtml(opts.balanceDue)}</td></tr>
        </table>
      </div>

      <div style="margin-top:22px;padding:14px 16px;background:#fffbeb;border-radius:10px;border:1px solid #fcd34d;">
        <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:0.04em;">How to pay</p>
        <div style="font-size:14px;color:#78350f;">${escapeHtml(opts.paymentInstructions).replace(/\n/g, "<br/>")}</div>
        ${paymentContactBlock}
      </div>

      ${notesBlock}

      <p style="margin-top:22px;font-size:13px;color:#6b7280;">Thank you for your business.</p>
      <p style="font-size:12px;color:#9ca3af;">— JobProof</p>
    </div>
  `;
}

/**
 * Sends invoice notification to the customer via Resend (same pattern as signing / signed contract emails).
 */
export async function sendInvoiceEmail(
  options: SendInvoiceEmailOptions
): Promise<DeliveryResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = buildResendFromHeader(
    options.businessDisplayName ?? options.contractor.businessName ?? null
  );
  const title = options.jobTitle.trim() || "Job";
  const subject = `Invoice: ${options.invoiceNumber} — ${title}`;
  const isProd = process.env.NODE_ENV === "production";
  const html = invoiceEmailHtml(options);

  let result: DeliveryResult;

  if (!apiKey) {
    console.warn("[sendInvoiceEmail] RESEND_API_KEY missing", {
      to: options.toEmail,
      production: isProd,
    });
    result = isProd
      ? { success: false, error: "Email service not configured" }
      : { success: true };
    if (!isProd) {
      console.warn(
        "[sendInvoiceEmail] Development: no API key — treating send as success so you can test the rest of the flow. No real email is sent; check Resend in production."
      );
    }
  } else {
    try {
      const resend = new Resend(apiKey);
      const attachments = options.pdfAttachment
        ? [
            {
              filename: options.pdfAttachment.filename,
              content: options.pdfAttachment.contentBase64,
            },
          ]
        : undefined;

      const { data, error } = await resend.emails.send({
        from,
        to: options.toEmail.trim(),
        subject,
        html,
        ...(attachments ? { attachments } : {}),
        ...(options.replyToEmail?.trim()
          ? { replyTo: options.replyToEmail.trim() }
          : {}),
      });

      if (error) {
        console.error("[DeliveryService] Resend error (invoice):", error);
        result = {
          success: false,
          error:
            typeof error === "object" && error && "message" in error
              ? String((error as { message: string }).message)
              : "Failed to send email",
        };
      } else {
        result = { success: true, resendMessageId: data?.id };
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to send email";
      console.error("[DeliveryService] sendInvoiceEmail:", e);
      result = { success: false, error: msg };
    }
  }

  if (options.deliveryLog) {
    await insertEmailLog({
      profileId: options.deliveryLog.profileId,
      type: options.deliveryLog.type,
      recipientEmail: options.toEmail,
      status: result.success ? "success" : "failed",
      errorMessage: result.success ? null : result.error ?? null,
      relatedEntityId: options.deliveryLog.relatedEntityId,
    });
  }

  if (result.success) {
    console.log("[sendInvoiceEmail] completed", {
      to: options.toEmail,
      resendMessageId: result.resendMessageId ?? null,
      hasPdf: Boolean(options.pdfAttachment),
      emailLogWritten: Boolean(options.deliveryLog),
    });
  } else {
    console.error("[sendInvoiceEmail] failed", {
      to: options.toEmail,
      error: result.error ?? "unknown",
      emailLogWritten: Boolean(options.deliveryLog),
    });
  }

  return result;
}

export interface SendSignedChangeOrderOptions {
  toEmail: string;
  toName: string;
  changeOrderTitle: string;
  jobTitle: string;
  pdfUrl?: string;
  recipient: "customer" | "contractor";
  deliveryLog?: EmailDeliveryAuditLog;
}

export async function sendSignedChangeOrderEmail(
  options: SendSignedChangeOrderOptions
): Promise<DeliveryResult> {
  console.log("[DeliveryService] Would send signed change order:", {
    to: options.toEmail,
    changeOrderTitle: options.changeOrderTitle,
    jobTitle: options.jobTitle,
    recipient: options.recipient,
  });
  const result: DeliveryResult = { success: true };

  if (options.deliveryLog) {
    await insertEmailLog({
      profileId: options.deliveryLog.profileId,
      type: options.deliveryLog.type,
      recipientEmail: options.toEmail,
      status: result.success ? "success" : "failed",
      errorMessage: result.success ? null : result.error ?? null,
      relatedEntityId: options.deliveryLog.relatedEntityId,
    });
  }

  return result;
}
