/**
 * Signed contract PDF generation (server-only). Uploads to Supabase `contract-pdfs` bucket.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { balanceDueOnCompletion } from "@/lib/contract-pricing-display";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 54;
const LINE = 13;
const MAX_CONTENT_W = PAGE_W - MARGIN * 2;

export type SignedContractPdfInput = {
  contractId: string;
  profileId: string;
  jobId: string;
  contractData: Record<string, unknown>;
  jobTitle: string;
  customerName: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  propertyAddress?: string | null;
  companyName?: string | null;
  contractorName?: string | null;
  contractorEmail?: string | null;
  contractorPhone?: string | null;
  contractorAddress?: string | null;
  scopeOfWork?: string | null;
  price?: number | null;
  depositAmount?: number | null;
  paymentTerms?: string | null;
  taxIncluded?: boolean;
  taxRate?: number | null;
  warrantyNote?: string | null;
  cancellationChangeNote?: string | null;
  signedAt?: string | null;
  signerName?: string | null;
  signerEmail?: string | null;
  signerPhone?: string | null;
  signingMethod?: string | null;
  signedIp?: string | null;
  signedUserAgent?: string | null;
  consentCheckbox?: boolean | null;
};

function money(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return `$${Number(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function str(v: unknown): string {
  if (v == null) return "";
  const s = String(v).trim();
  return s;
}

function wrapParagraph(
  text: string,
  font: PDFFont,
  size: number,
  maxW: number
): string[] {
  const t = text.replace(/\r\n/g, "\n").trim();
  if (!t) return [];
  const out: string[] = [];
  for (const rawLine of t.split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      out.push("");
      continue;
    }
    const words = line.split(/\s+/);
    let cur = "";
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (font.widthOfTextAtSize(next, size) <= maxW) cur = next;
      else {
        if (cur) out.push(cur);
        cur = w;
      }
    }
    if (cur) out.push(cur);
  }
  return out;
}

type Layout = {
  doc: PDFDocument;
  page: PDFPage;
  font: PDFFont;
  fontBold: PDFFont;
  y: number;
};

function ensureSpace(layout: Layout, need: number) {
  if (layout.y - need >= MARGIN) return;
  layout.page = layout.doc.addPage([PAGE_W, PAGE_H]);
  layout.y = PAGE_H - MARGIN;
}

function drawLines(
  layout: Layout,
  lines: string[],
  size: number,
  opts?: { bold?: boolean; gapAfter?: number }
) {
  const font = opts?.bold ? layout.fontBold : layout.font;
  const gap = opts?.gapAfter ?? 8;
  for (const line of lines) {
    ensureSpace(layout, LINE + 4);
    layout.page.drawText(line || " ", {
      x: MARGIN,
      y: layout.y,
      size,
      font,
      color: rgb(0.1, 0.1, 0.12),
      maxWidth: MAX_CONTENT_W,
    });
    layout.y -= line ? LINE : LINE * 0.5;
  }
  layout.y -= gap;
}

function heading(layout: Layout, title: string) {
  drawLines(layout, [title], 12, { bold: true, gapAfter: 6 });
}

function labeledParagraph(layout: Layout, label: string, body: string, bodySize = 10) {
  ensureSpace(layout, LINE + 4);
  layout.page.drawText(`${label}:`, {
    x: MARGIN,
    y: layout.y,
    size: bodySize,
    font: layout.fontBold,
    color: rgb(0.15, 0.15, 0.18),
  });
  layout.y -= LINE + 2;
  const wrapped = wrapParagraph(body || "—", layout.font, bodySize, MAX_CONTENT_W);
  drawLines(layout, wrapped, bodySize, { gapAfter: 10 });
}

export async function buildSignedContractPdfBytes(
  input: SignedContractPdfInput
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page = doc.addPage([PAGE_W, PAGE_H]);
  const layout: Layout = { doc, page, font, fontBold, y: PAGE_H - MARGIN };

  const cd = input.contractData ?? {};
  const startDate = str(cd.startDate);
  const completionDate = str(cd.completionDate);
  const terms = str(cd.terms);

  drawLines(
    layout,
    [input.companyName?.trim() || "Contractor", "SIGNED CONTRACT"],
    14,
    { bold: true, gapAfter: 4 }
  );
  drawLines(
    layout,
    [input.jobTitle || "Job"],
    11,
    { bold: false, gapAfter: 14 }
  );

  heading(layout, "Contractor");
  labeledParagraph(
    layout,
    "Business",
    input.companyName || input.contractorName || "—"
  );
  labeledParagraph(layout, "Contact name", input.contractorName || "—");
  labeledParagraph(layout, "Email", input.contractorEmail || "—");
  labeledParagraph(layout, "Phone", input.contractorPhone || "—");
  labeledParagraph(layout, "Address", input.contractorAddress || "—");

  heading(layout, "Customer");
  labeledParagraph(layout, "Name", input.customerName || "—");
  labeledParagraph(layout, "Email", input.customerEmail || "—");
  labeledParagraph(layout, "Phone", input.customerPhone || "—");

  heading(layout, "Job / property");
  labeledParagraph(layout, "Job title", input.jobTitle || "—");
  labeledParagraph(layout, "Property / job address", input.propertyAddress || "—");

  heading(layout, "Schedule (contract)");
  labeledParagraph(layout, "Estimated start", startDate || "—");
  labeledParagraph(layout, "Estimated completion", completionDate || "—");

  heading(layout, "Pricing");
  labeledParagraph(layout, "Contract total", money(input.price));
  labeledParagraph(layout, "Deposit", money(input.depositAmount));
  const pdfBalance = balanceDueOnCompletion(input.price ?? null, input.depositAmount ?? null);
  labeledParagraph(
    layout,
    "Balance due on completion",
    pdfBalance != null ? money(pdfBalance) : "—"
  );
  labeledParagraph(
    layout,
    "Tax",
    input.taxIncluded
      ? `Included${input.taxRate != null && input.taxRate > 0 ? ` (${input.taxRate}% noted)` : ""}`
      : input.taxRate != null && input.taxRate > 0
        ? `${input.taxRate}%`
        : "—"
  );
  labeledParagraph(layout, "Payment terms", input.paymentTerms || "—");

  heading(layout, "Scope of work");
  const scopeLines = wrapParagraph(
    input.scopeOfWork || "—",
    font,
    10,
    MAX_CONTENT_W
  );
  drawLines(layout, scopeLines, 10, { gapAfter: 10 });

  if (input.warrantyNote?.trim()) {
    heading(layout, "Warranty");
    const w = wrapParagraph(input.warrantyNote, font, 10, MAX_CONTENT_W);
    drawLines(layout, w, 10, { gapAfter: 10 });
  }
  if (input.cancellationChangeNote?.trim()) {
    heading(layout, "Cancellation / changes");
    const c = wrapParagraph(input.cancellationChangeNote, font, 10, MAX_CONTENT_W);
    drawLines(layout, c, 10, { gapAfter: 10 });
  }

  if (terms) {
    heading(layout, "Terms and conditions");
    const tLines = wrapParagraph(terms, font, 9, MAX_CONTENT_W);
    for (const line of tLines) {
      ensureSpace(layout, LINE);
      layout.page.drawText(line || " ", {
        x: MARGIN,
        y: layout.y,
        size: 9,
        font,
        color: rgb(0.12, 0.12, 0.14),
      });
      layout.y -= LINE * 0.95;
    }
    layout.y -= 10;
  }

  heading(layout, "Electronic signature");
  labeledParagraph(
    layout,
    "Signed by",
    [input.signerName, input.signerEmail].filter(Boolean).join(" • ") || "—"
  );
  labeledParagraph(layout, "Signer phone", input.signerPhone || "—");
  labeledParagraph(
    layout,
    "Signed at",
    input.signedAt
      ? new Date(input.signedAt).toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "—"
  );
  labeledParagraph(
    layout,
    "Signing method",
    input.signingMethod === "remote"
      ? "Remote (email link)"
      : input.signingMethod === "device"
        ? "On contractor device"
        : input.signingMethod || "—"
  );
  labeledParagraph(
    layout,
    "Consent confirmed",
    input.consentCheckbox ? "Yes — customer confirmed agreement before signing." : "—"
  );
  if (input.signedIp?.trim()) {
    labeledParagraph(layout, "IP address (signing)", input.signedIp);
  }
  if (input.signedUserAgent?.trim()) {
    const ua = input.signedUserAgent.slice(0, 500);
    labeledParagraph(layout, "Browser / device (user agent)", ua);
  }

  drawLines(
    layout,
    [
      "— End of signed contract record —",
      `Contract ID: ${input.contractId} • Job ID: ${input.jobId}`,
    ],
    8,
    { gapAfter: 0 }
  );

  return doc.save();
}

export function contractDbRowToPdfInput(row: {
  id: string;
  profile_id: string;
  job_id: string;
  contract_data: unknown;
  job_title: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  job_address: string | null;
  company_name: string | null;
  contractor_name: string | null;
  contractor_email: string | null;
  contractor_phone: string | null;
  contractor_address: string | null;
  scope_of_work: string | null;
  price: number | null;
  deposit_amount: number | null;
  payment_terms: string | null;
  tax_included: boolean | null;
  tax_rate: number | null;
  warranty_note: string | null;
  cancellation_change_note: string | null;
  signed_at: string | null;
  signer_name: string | null;
  signer_email: string | null;
  signer_phone: string | null;
  signing_method: string | null;
  signed_ip_address: string | null;
  signed_user_agent: string | null;
  consent_checkbox_boolean: boolean | null;
}): SignedContractPdfInput {
  return {
    contractId: row.id,
    profileId: row.profile_id,
    jobId: row.job_id,
    contractData: (row.contract_data as Record<string, unknown>) ?? {},
    jobTitle: row.job_title ?? "",
    customerName: row.customer_name ?? "",
    customerEmail: row.customer_email,
    customerPhone: row.customer_phone,
    propertyAddress: row.job_address,
    companyName: row.company_name,
    contractorName: row.contractor_name,
    contractorEmail: row.contractor_email,
    contractorPhone: row.contractor_phone,
    contractorAddress: row.contractor_address,
    scopeOfWork: row.scope_of_work,
    price: row.price,
    depositAmount: row.deposit_amount,
    paymentTerms: row.payment_terms,
    taxIncluded: row.tax_included ?? false,
    taxRate: row.tax_rate,
    warrantyNote: row.warranty_note,
    cancellationChangeNote: row.cancellation_change_note,
    signedAt: row.signed_at,
    signerName: row.signer_name,
    signerEmail: row.signer_email,
    signerPhone: row.signer_phone,
    signingMethod: row.signing_method,
    signedIp: row.signed_ip_address,
    signedUserAgent: row.signed_user_agent,
    consentCheckbox: row.consent_checkbox_boolean,
  };
}

/**
 * Build PDF bytes, upload to storage, return object path (e.g. `{profileId}/{contractId}/signed.pdf`).
 */
export async function generateSignedContractPdf(
  input: SignedContractPdfInput
): Promise<string | null> {
  try {
    const bytes = await buildSignedContractPdfBytes(input);
    if (bytes.byteLength > 4.5 * 1024 * 1024) {
      console.warn("[contract-pdf] PDF exceeds ~4.5MB; upload may fail bucket limit");
    }
    const storagePath = `${input.profileId}/${input.contractId}/signed-contract.pdf`;
    const admin = createServiceRoleClient();
    if (!admin) {
      console.warn(
        "[contract-pdf] SUPABASE_SERVICE_ROLE_KEY not set; cannot upload signed PDF"
      );
      return null;
    }
    const { error } = await admin.storage
      .from("contract-pdfs")
      .upload(storagePath, bytes, {
        contentType: "application/pdf",
        upsert: true,
      });
    if (error) {
      console.error("[contract-pdf] Upload failed:", error.message);
      return null;
    }
    return storagePath;
  } catch (e) {
    console.error("[contract-pdf] Generation failed:", e);
    return null;
  }
}

/**
 * @deprecated Use generateSignedContractPdf; change-order PDFs are still TODO.
 */
export async function generateSignedChangeOrderPdf(
  _options: {
    changeOrderId: string;
    changeTitle: string;
    changeDescription?: string;
    originalContractPrice: number;
    changeAmount: number;
    revisedTotalPrice: number;
    jobTitle: string;
    customerName: string;
    signedAt?: string;
    signerName?: string;
  }
): Promise<string | null> {
  return null;
}
