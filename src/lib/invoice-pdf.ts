import { PDFDocument, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";

/** Narrow to WinAnsi-safe subset for StandardFonts.Helvetica. */
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

export type InvoicePdfLineItem = {
  description: string;
  quantity: number;
  amount: number;
};

export type InvoicePdfInput = {
  invoiceNumberLabel: string;
  issueDateLabel: string;
  dueDateLabel: string | null;
  jobTitle: string;
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
    serviceAddressLines: string[];
  };
  lineItems: InvoicePdfLineItem[];
  subtotal: number;
  taxLabel: string;
  taxAmount: number;
  total: number;
  depositReceived: number;
  balanceDue: number;
  paymentInstructions: string;
  paymentContactLines: string[];
  notes: string | null;
};

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 50;
const MAX_CHARS = 82;

function money(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export async function buildInvoicePdf(input: InvoicePdfInput): Promise<Uint8Array> {
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

  drawTitle("INVOICE");
  drawLines([
    `Invoice #: ${input.invoiceNumberLabel}`,
    `Issue date: ${input.issueDateLabel}`,
    input.dueDateLabel ? `Due date: ${input.dueDateLabel}` : "Due date: —",
    `Job: ${input.jobTitle}`,
  ]);

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

  drawHeading("Bill to / Service location");
  const addrBlock =
    input.customer.serviceAddressLines.filter((l) => l.trim()).length > 0
      ? ["Service address:", ...input.customer.serviceAddressLines.filter((l) => l.trim())]
      : [];
  drawLines(
    [
      input.customer.name,
      input.customer.email ? `Email: ${input.customer.email}` : null,
      input.customer.phone ? `Phone: ${input.customer.phone}` : null,
      ...addrBlock,
    ].filter(Boolean) as string[]
  );

  drawHeading("Line items");
  for (const item of input.lineItems) {
    const descLines = wrapParagraph(item.description, MAX_CHARS - 10);
    const amt = money(item.amount);
    needSpace(Math.max(1, descLines.length) + 1);
    page.drawText(`${item.quantity} x`, { x: MARGIN, y, size: 9, font });
    let rowY = y;
    for (const dl of descLines) {
      page.drawText(dl, { x: MARGIN + 48, y: rowY, size: 9, font });
      rowY -= 11;
    }
    page.drawText(amt, {
      x: PAGE_W - MARGIN - font.widthOfTextAtSize(amt, 9),
      y,
      size: 9,
      font: fontBold,
    });
    y = rowY - 6;
  }

  drawHeading("Totals");
  const rows: [string, string][] = [
    ["Subtotal", money(input.subtotal)],
    [`Tax (${input.taxLabel})`, money(input.taxAmount)],
    ["Total", money(input.total)],
    ["Deposit received", money(input.depositReceived)],
    ["Balance due", money(input.balanceDue)],
  ];
  for (const [label, value] of rows) {
    needSpace(1);
    const isBold = label === "Balance due";
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

  drawHeading("Payment");
  drawLines(wrapParagraph(input.paymentInstructions, MAX_CHARS));
  if (input.paymentContactLines.length) {
    drawLines(["Payment contact:"], 10, fontBold);
    drawLines(input.paymentContactLines);
  }

  if (input.notes?.trim()) {
    drawHeading("Notes");
    drawLines(wrapParagraph(input.notes.trim(), MAX_CHARS));
  }

  const pages = doc.getPages();
  for (const p of pages) {
    footer(p, font, input.invoiceNumberLabel);
  }

  return doc.save();
}

function footer(p: PDFPage, font: PDFFont, inv: string) {
  const text = pdfSafe(`JobProof • ${inv}`);
  p.drawText(text, {
    x: MARGIN,
    y: 36,
    size: 8,
    font,
  });
}
