/**
 * Media Kit v2 — Print collateral compositor (Wave 3).
 * Uses transparent JobProof logo on brand layouts with QR placeholder slots.
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";

export const PRINT_COLORS = {
  blue: "#2436BB",
  navy: "#1A2558",
  orange: "#F28C38",
  proofTeal: "#4DBACC",
  white: "#FFFFFF",
  zinc50: "#FAFAFA",
  zinc100: "#F4F4F5",
  zinc600: "#52525B",
  zinc700: "#3F3F46",
  zinc900: "#18181B",
};

export const PRINT_QR_SLOTS = {
  "full-page": { left: 1780, top: 1960, size: 520 },
  "half-page": { left: 1860, top: 420, size: 480 },
  "rack-card-front": { left: 280, top: 1480, size: 640 },
  poster: { left: 1050, top: 1780, size: 1200 },
};

/** Rack back partner-link placeholder area (for personalization overlay). */
export const RACK_BACK_LINK_AREA = {
  left: 90,
  top: 1580,
  width: 1020,
  height: 220,
};

export const PRINT_SPECS = {
  "full-page": {
    id: "full-page",
    widthPx: 2550,
    heightPx: 3300,
    pageW: 612,
    pageH: 792,
    folder: "full-page",
    basePng: "jobproof-full-page-flyer.png",
    basePdf: "jobproof-full-page-flyer.pdf",
    legacyPng: "jobproof-flyer-letter.png",
    legacyPdf: "jobproof-flyer-letter.pdf",
  },
  "half-page": {
    id: "half-page",
    widthPx: 2550,
    heightPx: 1650,
    pageW: 612,
    pageH: 396,
    folder: "half-page",
    basePng: "jobproof-half-page-flyer.png",
    basePdf: "jobproof-half-page-flyer.pdf",
    legacyPng: "jobproof-flyer-halfpage.png",
    legacyPdf: "jobproof-flyer-halfpage.pdf",
  },
  "rack-card-front": {
    id: "rack-card-front",
    widthPx: 1200,
    heightPx: 2700,
    pageW: 288,
    pageH: 648,
    folder: "rack-card",
    basePng: "jobproof-rack-card-front.png",
    basePdf: "jobproof-rack-card-front.pdf",
    legacyPng: "jobproof-rack-card.png",
    legacyPdf: "jobproof-rack-card.pdf",
  },
  "rack-card-back": {
    id: "rack-card-back",
    widthPx: 1200,
    heightPx: 2700,
    pageW: 288,
    pageH: 648,
    folder: "rack-card",
    basePng: "jobproof-rack-card-back.png",
    basePdf: "jobproof-rack-card-back.pdf",
    legacyPng: null,
    legacyPdf: null,
  },
  poster: {
    id: "poster",
    widthPx: 3300,
    heightPx: 5100,
    pageW: 792,
    pageH: 1224,
    folder: "poster",
    basePng: "jobproof-poster.png",
    basePdf: "jobproof-poster.pdf",
    legacyPng: "jobproof-poster.png",
    legacyPdf: "jobproof-poster.pdf",
  },
};

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function qrPlaceholderSvg(slot) {
  const { left, top, size } = slot;
  const inset = Math.round(size * 0.08);
  return `
    <rect x="${left}" y="${top}" width="${size}" height="${size}" rx="16" fill="#FFFFFF" stroke="#E4E4E7" stroke-width="4"/>
    <rect x="${left + inset}" y="${top + inset}" width="${size - inset * 2}" height="${size - inset * 2}" fill="#F4F4F5"/>
    <text x="${left + size / 2}" y="${top + size / 2 + 8}" fill="#A1A1AA" font-size="${Math.round(size * 0.08)}" font-family="Arial, Helvetica, sans-serif" text-anchor="middle" font-weight="600">QR</text>
    <text x="${left + size / 2}" y="${top + size - inset - 12}" fill="#71717A" font-size="${Math.round(size * 0.045)}" font-family="Arial, Helvetica, sans-serif" text-anchor="middle">Your referral link</text>
  `;
}

async function resizeLogo(logoPath, width) {
  return sharp(logoPath)
    .trim({ threshold: 1 })
    .resize({ width, fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();
}

function wrapLines(text, maxChars) {
  const words = String(text).split(" ");
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars) {
      if (line) lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

async function composeFullPage({ width, height, destPath, logoPath }) {
  const logoBuf = await resizeLogo(logoPath, 780);
  const logoMeta = await sharp(logoBuf).metadata();
  const logoH = logoMeta.height ?? 280;
  const logoBandTop = 40;
  const logoBandH = 320;
  const headerEnd = logoBandTop + logoBandH;
  const navyH = 460;
  const outcomes = [
    {
      title: "WIN THE JOB",
      body: "Give customers an easy way to request a quote and respond with a professional process designed to help turn opportunities into paying work.",
    },
    {
      title: "MANAGE THE WORK",
      body: "Keep quotes, contracts, approvals, change orders and job information together as the project moves forward.",
    },
    {
      title: "GET PAID",
      body: "Move completed work into professional invoicing without losing track of what was approved.",
    },
    {
      title: "PROTECT WHAT YOU'VE EARNED",
      body: "Keep clear records of contracts, customer approvals, changes and completed work when money is on the line.",
    },
  ];
  const cardW = 1080;
  const cardH = 360;
  const gap = 36;
  const cardStartY = headerEnd + navyH + 40;
  const cards = outcomes
    .map((o, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 140 + col * (cardW + gap);
      const y = cardStartY + row * (cardH + gap);
      const body = wrapLines(o.body, 42)
        .slice(0, 4)
        .map(
          (l, li) =>
            `<text x="${x + 48}" y="${y + 115 + li * 40}" fill="${PRINT_COLORS.zinc700}" font-size="26" font-family="Arial, Helvetica, sans-serif">${escapeXml(l)}</text>`
        )
        .join("");
      return `
        <rect x="${x}" y="${y}" width="${cardW}" height="${cardH}" rx="22" fill="#FFFFFF" stroke="#E4E4E7" stroke-width="3"/>
        <rect x="${x}" y="${y}" width="14" height="${cardH}" rx="7" fill="${i % 2 === 0 ? PRINT_COLORS.orange : PRINT_COLORS.proofTeal}"/>
        <text x="${x + 48}" y="${y + 60}" fill="${PRINT_COLORS.navy}" font-size="32" font-weight="700" font-family="Arial, Helvetica, sans-serif">${escapeXml(o.title)}</text>
        ${body}
      `;
    })
    .join("");
  const afterCards = cardStartY + 2 * (cardH + gap) + 8;
  const slot = PRINT_QR_SLOTS["full-page"];

  const overlay = Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" fill="${PRINT_COLORS.zinc50}"/>
      <rect width="${width}" height="24" fill="${PRINT_COLORS.blue}"/>
      <rect y="${height - 24}" width="${width}" height="24" fill="${PRINT_COLORS.orange}"/>
      <rect x="0" y="${headerEnd}" width="${width}" height="${navyH}" fill="${PRINT_COLORS.navy}"/>
      <circle cx="2320" cy="${headerEnd + 140}" r="200" fill="rgba(77,186,204,0.16)"/>
      <circle cx="2080" cy="${headerEnd + 340}" r="130" fill="rgba(242,140,56,0.12)"/>
      <text x="160" y="${headerEnd + 130}" fill="#FFFFFF" font-size="76" font-weight="700" font-family="Arial, Helvetica, sans-serif">WIN MORE WORK.</text>
      <text x="160" y="${headerEnd + 225}" fill="#FFFFFF" font-size="76" font-weight="700" font-family="Arial, Helvetica, sans-serif">MAKE MORE MONEY.</text>
      <text x="160" y="${headerEnd + 310}" fill="rgba(255,255,255,0.92)" font-size="30" font-family="Arial, Helvetica, sans-serif">Run your contracting business from quote request to payment.</text>
      ${cards}
      <text x="160" y="${afterCards + 36}" fill="${PRINT_COLORS.navy}" font-size="28" font-weight="600" font-family="Arial, Helvetica, sans-serif">From first quote request to final invoice, JobProof gives contractors</text>
      <text x="160" y="${afterCards + 78}" fill="${PRINT_COLORS.navy}" font-size="28" font-weight="600" font-family="Arial, Helvetica, sans-serif">one place to manage the business behind every job.</text>
      <rect x="140" y="${afterCards + 120}" width="${width - 280}" height="720" rx="28" fill="#FFFFFF" stroke="#E4E4E7" stroke-width="3"/>
      <text x="200" y="${afterCards + 230}" fill="${PRINT_COLORS.navy}" font-size="38" font-weight="700" font-family="Arial, Helvetica, sans-serif">Ready to grow your contracting</text>
      <text x="200" y="${afterCards + 285}" fill="${PRINT_COLORS.navy}" font-size="38" font-weight="700" font-family="Arial, Helvetica, sans-serif">business with better tools?</text>
      <text x="200" y="${afterCards + 365}" fill="${PRINT_COLORS.zinc700}" font-size="26" font-family="Arial, Helvetica, sans-serif">Scan to learn more — your QR links contractors</text>
      <text x="200" y="${afterCards + 410}" fill="${PRINT_COLORS.zinc700}" font-size="26" font-family="Arial, Helvetica, sans-serif">through your JobProof referral link.</text>
      <rect x="200" y="${afterCards + 490}" width="420" height="88" rx="16" fill="${PRINT_COLORS.orange}"/>
      <text x="410" y="${afterCards + 548}" fill="#FFFFFF" font-size="28" font-weight="700" font-family="Arial, Helvetica, sans-serif" text-anchor="middle">Start with JobProof</text>
      ${qrPlaceholderSvg(slot)}
      <text x="${slot.left + slot.size / 2}" y="${slot.top + slot.size + 40}" fill="${PRINT_COLORS.navy}" font-size="24" font-weight="700" font-family="Arial, Helvetica, sans-serif" text-anchor="middle">Scan to learn more</text>
    </svg>
  `);

  await sharp(overlay)
    .composite([
      {
        input: logoBuf,
        top: logoBandTop + Math.round((logoBandH - logoH) / 2),
        left: 160,
      },
    ])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(destPath);
}

async function composeHalfPage({ width, height, destPath, logoPath }) {
  const logoBuf = await resizeLogo(logoPath, 520);
  const slot = PRINT_QR_SLOTS["half-page"];
  const bullets = [
    "Respond to quote opportunities",
    "Create professional quotes & contracts",
    "Track approvals & change orders",
    "Invoice with clear job records",
  ];
  const checks = bullets
    .map((b, i) => {
      const y = 720 + i * 100;
      return `
        <circle cx="200" cy="${y - 12}" r="22" fill="${PRINT_COLORS.proofTeal}"/>
        <text x="200" y="${y - 4}" fill="#FFFFFF" font-size="24" font-weight="700" font-family="Arial, Helvetica, sans-serif" text-anchor="middle">✓</text>
        <text x="250" y="${y}" fill="${PRINT_COLORS.navy}" font-size="34" font-weight="600" font-family="Arial, Helvetica, sans-serif">${escapeXml(b)}</text>
      `;
    })
    .join("");

  const overlay = Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" fill="#FFFFFF"/>
      <rect width="${width}" height="20" fill="${PRINT_COLORS.blue}"/>
      <rect y="${height - 20}" width="${width}" height="20" fill="${PRINT_COLORS.orange}"/>
      <rect x="1680" y="20" width="870" height="${height - 40}" fill="${PRINT_COLORS.navy}"/>
      <circle cx="2360" cy="280" r="180" fill="rgba(77,186,204,0.18)"/>
      <circle cx="1900" cy="1400" r="160" fill="rgba(242,140,56,0.12)"/>
      <rect x="0" y="20" width="14" height="${height - 40}" fill="${PRINT_COLORS.proofTeal}"/>
      <text x="160" y="340" fill="${PRINT_COLORS.navy}" font-size="58" font-weight="700" font-family="Arial, Helvetica, sans-serif">WIN MORE WORK.</text>
      <text x="160" y="420" fill="${PRINT_COLORS.navy}" font-size="58" font-weight="700" font-family="Arial, Helvetica, sans-serif">GET PAID.</text>
      <text x="160" y="500" fill="${PRINT_COLORS.navy}" font-size="46" font-weight="700" font-family="Arial, Helvetica, sans-serif">PROTECT WHAT YOU'VE EARNED.</text>
      <text x="160" y="575" fill="${PRINT_COLORS.zinc700}" font-size="26" font-family="Arial, Helvetica, sans-serif">JobProof helps contractors manage the journey from quote request to payment.</text>
      ${checks}
      <rect x="1760" y="340" width="680" height="760" rx="28" fill="#FFFFFF"/>
      ${qrPlaceholderSvg(slot)}
      <text x="${slot.left + slot.size / 2}" y="${slot.top + slot.size + 56}" fill="${PRINT_COLORS.navy}" font-size="26" font-weight="700" font-family="Arial, Helvetica, sans-serif" text-anchor="middle">Scan to see JobProof</text>
      <rect x="160" y="1420" width="420" height="90" rx="16" fill="${PRINT_COLORS.orange}"/>
      <text x="370" y="1478" fill="#FFFFFF" font-size="28" font-weight="700" font-family="Arial, Helvetica, sans-serif" text-anchor="middle">Start with JobProof</text>
    </svg>
  `);

  await sharp(overlay)
    .composite([{ input: logoBuf, top: 48, left: 160 }])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(destPath);
}

async function composeRackCardFront({ width, height, destPath, logoPath }) {
  const logoBuf = await resizeLogo(logoPath, 780);
  const logoMeta = await sharp(logoBuf).metadata();
  const logoH = logoMeta.height ?? 280;
  const cx = width / 2;
  const slot = PRINT_QR_SLOTS["rack-card-front"];
  const plateH = logoH + 80;
  const outcomes = [
    { t: "WIN THE JOB", d: "Quote requests that are easy to answer" },
    { t: "MANAGE THE WORK", d: "Quotes, contracts & change orders" },
    { t: "GET PAID", d: "Clear invoices with job records" },
  ];
  const blockStart = 60 + plateH + 380;
  const blocks = outcomes
    .map((o, i) => {
      const y = blockStart + i * 170;
      return `
        <rect x="90" y="${y}" width="${width - 180}" height="145" rx="18" fill="rgba(255,255,255,0.12)"/>
        <text x="130" y="${y + 55}" fill="#FFFFFF" font-size="28" font-weight="700" font-family="Arial, Helvetica, sans-serif">${escapeXml(o.t)}</text>
        <text x="130" y="${y + 105}" fill="rgba(255,255,255,0.88)" font-size="24" font-family="Arial, Helvetica, sans-serif">${escapeXml(o.d)}</text>
      `;
    })
    .join("");

  const overlay = Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="rackFront" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${PRINT_COLORS.navy}"/>
          <stop offset="60%" stop-color="${PRINT_COLORS.blue}"/>
          <stop offset="100%" stop-color="#2A45D4"/>
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#rackFront)"/>
      <rect width="${width}" height="16" fill="${PRINT_COLORS.orange}"/>
      <rect y="${height - 16}" width="${width}" height="16" fill="${PRINT_COLORS.proofTeal}"/>
      <circle cx="980" cy="320" r="180" fill="rgba(255,255,255,0.06)"/>
      <rect x="70" y="50" width="${width - 140}" height="${plateH}" rx="22" fill="#FFFFFF"/>
      <text x="${cx}" y="${60 + plateH + 90}" fill="#FFFFFF" font-size="48" font-weight="700" font-family="Arial, Helvetica, sans-serif" text-anchor="middle">WIN MORE WORK.</text>
      <text x="${cx}" y="${60 + plateH + 170}" fill="#FFFFFF" font-size="36" font-weight="700" font-family="Arial, Helvetica, sans-serif" text-anchor="middle">MAKE IT EASIER</text>
      <text x="${cx}" y="${60 + plateH + 220}" fill="#FFFFFF" font-size="36" font-weight="700" font-family="Arial, Helvetica, sans-serif" text-anchor="middle">FOR CUSTOMERS</text>
      <text x="${cx}" y="${60 + plateH + 270}" fill="#FFFFFF" font-size="36" font-weight="700" font-family="Arial, Helvetica, sans-serif" text-anchor="middle">TO HIRE YOU.</text>
      <text x="${cx}" y="${60 + plateH + 340}" fill="rgba(255,255,255,0.9)" font-size="26" font-family="Arial, Helvetica, sans-serif" text-anchor="middle">From quote request to payment.</text>
      ${blocks}
      <rect x="${slot.left - 36}" y="${slot.top - 36}" width="${slot.size + 72}" height="${slot.size + 140}" rx="24" fill="#FFFFFF"/>
      ${qrPlaceholderSvg(slot)}
      <text x="${cx}" y="${slot.top + slot.size + 64}" fill="${PRINT_COLORS.navy}" font-size="28" font-weight="700" font-family="Arial, Helvetica, sans-serif" text-anchor="middle">Scan to learn more</text>
      <text x="${cx}" y="${height - 56}" fill="rgba(255,255,255,0.85)" font-size="24" font-weight="600" font-family="Arial, Helvetica, sans-serif" text-anchor="middle">jobproof.ca</text>
    </svg>
  `);

  await sharp(overlay)
    .composite([
      {
        input: logoBuf,
        top: 50 + Math.round((plateH - logoH) / 2),
        left: Math.round((width - (logoMeta.width ?? 780)) / 2),
      },
    ])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(destPath);
}

async function composeRackCardBack({ width, height, destPath }) {
  const { left, top, width: linkW, height: linkH } = RACK_BACK_LINK_AREA;
  const cx = width / 2;
  const benefits = [
    "Quote requests",
    "Professional quotes",
    "Contracts",
    "Customer approvals",
    "Change orders",
    "Invoices",
    "Job records",
  ];
  const benefitLines = benefits
    .map((b, i) => {
      const y = 560 + i * 92;
      return `
        <rect x="100" y="${y - 48}" width="${width - 200}" height="78" rx="14" fill="#FFFFFF" stroke="#E4E4E7" stroke-width="2"/>
        <circle cx="150" cy="${y - 8}" r="12" fill="${PRINT_COLORS.orange}"/>
        <text x="190" y="${y}" fill="${PRINT_COLORS.navy}" font-size="30" font-weight="600" font-family="Arial, Helvetica, sans-serif">${escapeXml(b)}</text>
      `;
    })
    .join("");

  const overlay = Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" fill="${PRINT_COLORS.zinc50}"/>
      <rect width="${width}" height="16" fill="${PRINT_COLORS.blue}"/>
      <rect y="${height - 16}" width="${width}" height="16" fill="${PRINT_COLORS.orange}"/>
      <rect x="70" y="50" width="${width - 140}" height="280" rx="22" fill="${PRINT_COLORS.navy}"/>
      <text x="${cx}" y="130" fill="#FFFFFF" font-size="36" font-weight="700" font-family="Arial, Helvetica, sans-serif" text-anchor="middle">WIN THE JOB.</text>
      <text x="${cx}" y="190" fill="#FFFFFF" font-size="36" font-weight="700" font-family="Arial, Helvetica, sans-serif" text-anchor="middle">MANAGE THE WORK.</text>
      <text x="${cx}" y="250" fill="#FFFFFF" font-size="36" font-weight="700" font-family="Arial, Helvetica, sans-serif" text-anchor="middle">GET PAID.</text>
      <text x="100" y="400" fill="${PRINT_COLORS.zinc700}" font-size="24" font-family="Arial, Helvetica, sans-serif">Tools designed to help contractors:</text>
      ${benefitLines}
      <text x="${cx}" y="1280" fill="${PRINT_COLORS.navy}" font-size="34" font-weight="700" font-family="Arial, Helvetica, sans-serif" text-anchor="middle">Protect what you've earned.</text>
      <text x="${cx}" y="1380" fill="${PRINT_COLORS.zinc700}" font-size="24" font-family="Arial, Helvetica, sans-serif" text-anchor="middle">Your personalized referral link:</text>
      <rect x="${left}" y="${top}" width="${linkW}" height="${linkH}" rx="16" fill="#FFFFFF" stroke="#D4D4D8" stroke-width="3"/>
      <text x="${cx}" y="${top + linkH / 2 + 10}" fill="${PRINT_COLORS.blue}" font-size="26" font-weight="600" font-family="Arial, Helvetica, sans-serif" text-anchor="middle">[PARTNER LINK]</text>
      <text x="${cx}" y="${height - 120}" fill="${PRINT_COLORS.blue}" font-size="30" font-weight="700" font-family="Arial, Helvetica, sans-serif" text-anchor="middle">JobProof</text>
      <text x="${cx}" y="${height - 70}" fill="${PRINT_COLORS.zinc600}" font-size="22" font-family="Arial, Helvetica, sans-serif" text-anchor="middle">jobproof.ca</text>
    </svg>
  `);

  await sharp(overlay)
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(destPath);
}

async function composePoster({ width, height, destPath, logoPath }) {
  const logoBuf = await resizeLogo(logoPath, 1400);
  const logoMeta = await sharp(logoBuf).metadata();
  const logoH = logoMeta.height ?? 500;
  const cx = width / 2;
  const slot = PRINT_QR_SLOTS.poster;
  const plateH = logoH + 100;

  const overlay = Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="posterBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${PRINT_COLORS.navy}"/>
          <stop offset="55%" stop-color="${PRINT_COLORS.blue}"/>
          <stop offset="100%" stop-color="#2A45D4"/>
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#posterBg)"/>
      <rect width="${width}" height="28" fill="${PRINT_COLORS.orange}"/>
      <rect y="${height - 28}" width="${width}" height="28" fill="${PRINT_COLORS.proofTeal}"/>
      <circle cx="2900" cy="900" r="420" fill="rgba(255,255,255,0.06)"/>
      <circle cx="400" cy="4300" r="360" fill="rgba(77,186,204,0.14)"/>
      <rect x="180" y="120" width="${width - 360}" height="${plateH}" rx="32" fill="#FFFFFF"/>
      <text x="${cx}" y="${140 + plateH + 160}" fill="#FFFFFF" font-size="130" font-weight="700" font-family="Arial, Helvetica, sans-serif" text-anchor="middle">WIN MORE WORK.</text>
      <text x="${cx}" y="${140 + plateH + 340}" fill="#FFFFFF" font-size="130" font-weight="700" font-family="Arial, Helvetica, sans-serif" text-anchor="middle">MAKE MORE MONEY.</text>
      <text x="${cx}" y="${140 + plateH + 520}" fill="#FFFFFF" font-size="130" font-weight="700" font-family="Arial, Helvetica, sans-serif" text-anchor="middle">GET PAID.</text>
      <text x="${cx}" y="${140 + plateH + 680}" fill="rgba(255,255,255,0.92)" font-size="56" font-family="Arial, Helvetica, sans-serif" text-anchor="middle">Tools built for contractors.</text>
      <text x="${cx}" y="${140 + plateH + 780}" fill="rgba(255,255,255,0.8)" font-size="42" font-family="Arial, Helvetica, sans-serif" text-anchor="middle">From quote request to payment.</text>
      <rect x="${slot.left - 70}" y="${slot.top - 70}" width="${slot.size + 140}" height="${slot.size + 240}" rx="40" fill="#FFFFFF"/>
      ${qrPlaceholderSvg(slot)}
      <text x="${cx}" y="${slot.top + slot.size + 110}" fill="${PRINT_COLORS.navy}" font-size="52" font-weight="700" font-family="Arial, Helvetica, sans-serif" text-anchor="middle">SCAN TO SEE JOBPROOF</text>
      <text x="${cx}" y="${height - 100}" fill="rgba(255,255,255,0.85)" font-size="40" font-weight="600" font-family="Arial, Helvetica, sans-serif" text-anchor="middle">jobproof.ca</text>
    </svg>
  `);

  await sharp(overlay)
    .composite([
      {
        input: logoBuf,
        top: 120 + Math.round((plateH - logoH) / 2),
        left: Math.round((width - (logoMeta.width ?? 1400)) / 2),
      },
    ])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(destPath);
}

async function composePrintAsset(specId, { destPath, logoPath }) {
  const spec = PRINT_SPECS[specId];
  const args = { width: spec.widthPx, height: spec.heightPx, destPath, logoPath };

  if (specId === "full-page") return composeFullPage(args);
  if (specId === "half-page") return composeHalfPage(args);
  if (specId === "rack-card-front") return composeRackCardFront(args);
  if (specId === "rack-card-back") return composeRackCardBack(args);
  if (specId === "poster") return composePoster(args);
  throw new Error(`Unknown print spec: ${specId}`);
}

async function pngToPdf(pngPath, pdfPath, pageWidthPt, pageHeightPt) {
  const doc = await PDFDocument.create();
  const bytes = fs.readFileSync(pngPath);
  const image = await doc.embedPng(bytes);
  const page = doc.addPage([pageWidthPt, pageHeightPt]);
  page.drawImage(image, { x: 0, y: 0, width: pageWidthPt, height: pageHeightPt });
  fs.writeFileSync(pdfPath, await doc.save());
}

export async function buildAllPrintAssets({ root, logoPath, writeLog }) {
  const printRoot = path.join(root, "public/media-kit/print");
  fs.mkdirSync(printRoot, { recursive: true });

  const written = [];

  for (const spec of Object.values(PRINT_SPECS)) {
    const folder = path.join(printRoot, spec.folder);
    fs.mkdirSync(folder, { recursive: true });

    const pngPath = path.join(folder, spec.basePng);
    const pdfPath = path.join(folder, spec.basePdf);

    await composePrintAsset(spec.id, { destPath: pngPath, logoPath });
    written.push(pngPath);
    if (writeLog) writeLog(pngPath);

    await pngToPdf(pngPath, pdfPath, spec.pageW, spec.pageH);
    written.push(pdfPath);
    if (writeLog) writeLog(pdfPath);

    if (spec.legacyPng) {
      const legacyPng = path.join(printRoot, spec.legacyPng);
      fs.copyFileSync(pngPath, legacyPng);
      written.push(legacyPng);
      if (writeLog) writeLog(legacyPng);
    }
    if (spec.legacyPdf) {
      const legacyPdf = path.join(printRoot, spec.legacyPdf);
      fs.copyFileSync(pdfPath, legacyPdf);
      written.push(legacyPdf);
      if (writeLog) writeLog(legacyPdf);
    }
  }

  const metadata = {
    qrSlots: PRINT_QR_SLOTS,
    rackBackLinkArea: RACK_BACK_LINK_AREA,
    specs: Object.fromEntries(
      Object.entries(PRINT_SPECS).map(([id, s]) => [
        id,
        {
          widthPx: s.widthPx,
          heightPx: s.heightPx,
          pageW: s.pageW,
          pageH: s.pageH,
          folder: s.folder,
          basePng: s.basePng,
          basePdf: s.basePdf,
          hasQr: id !== "rack-card-back",
        },
      ])
    ),
  };

  const metaPath = path.join(printRoot, "qr-slots.json");
  fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2));
  if (writeLog) writeLog(metaPath);

  return written;
}
