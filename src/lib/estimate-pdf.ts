import { PDFDocument, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";

function pdfSafe(s: string): string {
  return s
    .replace(/[\r\n\t]+/g, " ")
    .split("")
    .map((ch) => {
      const n = ch.charCodeAt(0);
      if (n >= 32 && n < 127) return ch;
      return "?";
    })
    .join("");
}

function wrapLine(line: string, maxChars: number): string[] {
  const words = line.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const out: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= maxChars) {
      cur = next;
    } else {
      if (cur) out.push(cur);
      cur = w.length > maxChars ? w.slice(0, maxChars - 1) + "…" : w;
    }
  }
  if (cur) out.push(cur);
  return out;
}

function wrapParagraph(text: string, maxChars: number): string[] {
  return text.split(/\n/).flatMap((para) => wrapLine(pdfSafe(para), maxChars));
}

export type EstimatePdfInput = {
  estimateNumberLabel: string;
  issueDateLabel: string;
  expiryDateLabel: string | null;
  title: string;
  contractor: {
    businessName: string;
    contactName: string | null;
    phone: string | null;
    email: string | null;
    addressLines: string[];
  };
  customer: {
    name: string;
    email: string | null;
    phone: string | null;
  };
  propertyAddressLines: string[];
  scopeOfWork: string;
  subtotal: number;
  taxLabel: string;
  taxAmount: number;
  total: number;
  depositAmount: number | null;
  notes: string | null;
};

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 50;
const MAX_CHARS = 82;

function money(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export async function buildEstimatePdf(input: EstimatePdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  let page = doc.addPage([PAGE_W, PAGE_H]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const bottom = MARGIN + 24;

  let y = PAGE_H - MARGIN;

  function needSpace(lines: number, lineH = 13) {
    if (y - lines * lineH < bottom) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
  }

  function drawTitle(text: string) {
    needSpace(2, 18);
    page.drawText(pdfSafe(text), {
      x: MARGIN,
      y,
      size: 18,
      font: fontBold,
    });
    y -= 26;
  }

  function drawHeading(text: string) {
    needSpace(2, 14);
    page.drawText(pdfSafe(text), {
      x: MARGIN,
      y,
      size: 11,
      font: fontBold,
    });
    y -= 16;
  }

  function drawLines(lines: string[], size = 10, f: PDFFont = font) {
    for (const raw of lines) {
      const wrapped = wrapLine(pdfSafe(raw), MAX_CHARS);
      for (const ln of wrapped) {
        needSpace(1);
        page.drawText(ln, { x: MARGIN, y, size, font: f });
        y -= size + 2;
      }
    }
    y -= 4;
  }

  drawTitle("ESTIMATE (QUOTE)");
  drawLines([
    `Estimate #: ${input.estimateNumberLabel}`,
    `Date: ${input.issueDateLabel}`,
    input.expiryDateLabel ? `Valid until: ${input.expiryDateLabel}` : "Valid until: —",
    `Project: ${input.title}`,
  ]);

  drawHeading("Important");
  drawLines(
    wrapParagraph(
      "This document is an estimate or quote only. It is not a signed contract and does not obligate either party until you agree in writing or through the JobProof estimate acceptance flow.",
      MAX_CHARS
    ),
    9
  );

  drawHeading("Contractor");
  drawLines(
    [
      input.contractor.businessName,
      input.contractor.contactName ? `Contact: ${input.contractor.contactName}` : null,
      input.contractor.phone ? `Phone: ${input.contractor.phone}` : null,
      input.contractor.email ? `Email: ${input.contractor.email}` : null,
      ...input.contractor.addressLines,
    ].filter(Boolean) as string[]
  );

  drawHeading("Customer");
  drawLines(
    [
      input.customer.name,
      input.customer.email ? `Email: ${input.customer.email}` : null,
      input.customer.phone ? `Phone: ${input.customer.phone}` : null,
    ].filter(Boolean) as string[]
  );

  if (input.propertyAddressLines.some((l) => l.trim())) {
    drawHeading("Property / work location");
    drawLines(input.propertyAddressLines.filter((l) => l.trim()));
  }

  drawHeading("Scope of work");
  drawLines(wrapParagraph(input.scopeOfWork.trim() || "—", MAX_CHARS), 10);

  drawHeading("Pricing");
  const rows: [string, string][] = [
    ["Subtotal (before tax)", money(input.subtotal)],
    [`Tax (${input.taxLabel})`, money(input.taxAmount)],
    ["Total (including tax)", money(input.total)],
  ];
  if (input.depositAmount != null && input.depositAmount > 0) {
    rows.push(["Suggested deposit", money(input.depositAmount)]);
  }
  for (const [label, value] of rows) {
    needSpace(1);
    const isBold = label.startsWith("Total");
    const f = isBold ? fontBold : font;
    page.drawText(pdfSafe(label), { x: MARGIN, y, size: 10, font: f });
    page.drawText(pdfSafe(value), {
      x: PAGE_W - MARGIN - f.widthOfTextAtSize(value, 10),
      y,
      size: 10,
      font: f,
    });
    y -= 14;
  }
  y -= 6;

  if (input.notes?.trim()) {
    drawHeading("Notes");
    drawLines(wrapParagraph(input.notes.trim(), MAX_CHARS));
  }

  const pages = doc.getPages();
  for (const p of pages) {
    const text = pdfSafe(`JobProof • ${input.estimateNumberLabel}`);
    p.drawText(text, { x: MARGIN, y: 36, size: 8, font });
  }

  return doc.save();
}
