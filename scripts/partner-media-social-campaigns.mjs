/**
 * Media Kit v2 social campaign graphic compositor.
 * Uses the transparent JobProof logo (no white plate) on brand blue.
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

export const SOCIAL_COLORS = {
  blue: "#2436BB",
  navy: "#1A2558",
  orange: "#F28C38",
  proofTeal: "#4DBACC",
  white: "#FFFFFF",
};

export const SOCIAL_CAMPAIGN_RENDER_SPECS = [
  {
    id: "win-more-work",
    folder: "win-more-work",
    slug: "win-more-work",
    headline: ["Win more work."],
    supporting: "From quote request to signed job.",
    cta: "Try JobProof",
  },
  {
    id: "turn-quotes-into-jobs",
    folder: "turn-quotes-into-jobs",
    slug: "turn-quotes-into-jobs",
    headline: ["Turn more quotes", "into paying jobs."],
    supporting: "Respond quickly. Quote professionally.",
    cta: "Start with JobProof",
  },
  {
    id: "easier-to-hire",
    folder: "easier-to-hire",
    slug: "easier-to-hire",
    headline: ["Make it easier for", "customers to hire you."],
    supporting: "From inquiry to quote, approval, and signed agreement.",
    cta: "Try JobProof",
  },
  {
    id: "get-paid",
    folder: "get-paid",
    slug: "get-paid",
    headline: ["Do the work.", "Get paid."],
    supporting: "From approved work to invoice and payment.",
    cta: "Start with JobProof",
  },
  {
    id: "protect-earned-revenue",
    folder: "protect-earned-revenue",
    slug: "protect-earned-revenue",
    headline: ["Protect what", "you've earned."],
    supporting: "Contracts, approvals, changes, and clear job records.",
    cta: "Protect every job",
  },
  {
    id: "quote-to-payment",
    folder: "quote-to-payment",
    slug: "quote-to-payment",
    headline: ["Win the job.", "Manage the work.", "Get paid."],
    supporting: "From quote request to payment — in one place.",
    cta: "Try JobProof",
  },
];

export const SOCIAL_FORMATS = [
  { id: "square", width: 1080, height: 1080 },
  { id: "portrait", width: 1080, height: 1350 },
  { id: "story", width: 1080, height: 1920 },
  { id: "linkedin", width: 1200, height: 627 },
  { id: "x", width: 1600, height: 900 },
];

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function layoutFor(width, height) {
  const isLandscape = width > height;
  const isStory = height / width > 1.5;
  const isLinkedIn = width === 1200 && height === 627;

  if (isLinkedIn) {
    return {
      logoWidth: 320,
      logoTop: 36,
      logoLeft: 48,
      headlineFontSize: 44,
      headlineY: 220,
      supportingFontSize: 22,
      supportingY: 340,
      ctaWidth: 240,
      ctaHeight: 48,
      ctaFontSize: 18,
      accentBar: 8,
    };
  }

  if (isStory) {
    return {
      logoWidth: 460,
      logoTop: 120,
      logoLeft: 64,
      headlineFontSize: 64,
      headlineY: 520,
      supportingFontSize: 28,
      supportingY: 780,
      ctaWidth: 320,
      ctaHeight: 64,
      ctaFontSize: 22,
      accentBar: 14,
    };
  }

  if (isLandscape) {
    return {
      logoWidth: 380,
      logoTop: 48,
      logoLeft: 64,
      headlineFontSize: 54,
      headlineY: 280,
      supportingFontSize: 24,
      supportingY: 460,
      ctaWidth: 280,
      ctaHeight: 52,
      ctaFontSize: 20,
      accentBar: 10,
    };
  }

  // square / portrait
  return {
    logoWidth: Math.min(420, width - 120),
    logoTop: 56,
    logoLeft: 64,
    headlineFontSize: height >= 1300 ? 58 : 52,
    headlineY: Math.round(height * 0.32),
    supportingFontSize: 24,
    supportingY: Math.round(height * 0.32) + 160,
    ctaWidth: 280,
    ctaHeight: 56,
    ctaFontSize: 20,
    accentBar: 12,
  };
}

function wrapHeadline(lines, maxLines = 3) {
  return lines.slice(0, maxLines);
}

export async function composeCampaignGraphic({
  width,
  height,
  destPath,
  headline,
  supporting,
  cta,
  logoPath,
}) {
  const L = layoutFor(width, height);
  const lines = wrapHeadline(headline, height < 700 ? 2 : 3);

  // Soft gradient + brand accents (SVG), not a flat blue rectangle.
  const backdrop = Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${SOCIAL_COLORS.navy}"/>
          <stop offset="55%" stop-color="${SOCIAL_COLORS.blue}"/>
          <stop offset="100%" stop-color="#2A45D4"/>
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#bg)"/>
      <rect x="0" y="0" width="${width}" height="${L.accentBar}" fill="${SOCIAL_COLORS.orange}"/>
      <rect x="0" y="${height - L.accentBar}" width="${width}" height="${L.accentBar}" fill="${SOCIAL_COLORS.proofTeal}"/>
      <circle cx="${width - 60}" cy="70" r="${Math.round(width * 0.18)}" fill="rgba(255,255,255,0.05)"/>
      <circle cx="${Math.round(width * 0.08)}" cy="${height - 40}" r="${Math.round(width * 0.14)}" fill="rgba(77,186,204,0.12)"/>
      <circle cx="${Math.round(width * 0.75)}" cy="${Math.round(height * 0.55)}" r="${Math.round(width * 0.22)}" fill="rgba(242,140,56,0.08)"/>
    </svg>
  `);

  const logoBuf = await sharp(logoPath)
    .resize({
      width: L.logoWidth,
      fit: "inside",
      withoutEnlargement: true,
    })
    .png()
    .toBuffer();
  const logoMeta = await sharp(logoBuf).metadata();
  const logoH = logoMeta.height ?? 0;

  // LinkedIn / short landscape: push headline below rendered logo.
  let headlineY = L.headlineY;
  let supportingY = L.supportingY;
  if (height <= 700) {
    const gap = 36;
    const ascent = Math.round(L.headlineFontSize * 0.8);
    headlineY = L.logoTop + logoH + gap + ascent;
    supportingY = headlineY + lines.length * L.headlineFontSize * 1.12 + 18;
  }

  const headlineSvg = lines
    .map((line, i) => {
      const y = headlineY + i * L.headlineFontSize * 1.12;
      return `<text x="64" y="${y}" fill="${SOCIAL_COLORS.white}" font-size="${L.headlineFontSize}" font-weight="700" font-family="Arial, Helvetica, sans-serif">${escapeXml(line)}</text>`;
    })
    .join("");

  const ctaY = height - Math.round(height < 800 ? 88 : 110);
  const ctaW = Math.min(L.ctaWidth, width - 128);
  const supportingSvg = `
    <text x="64" y="${supportingY}" fill="rgba(255,255,255,0.9)" font-size="${L.supportingFontSize}" font-weight="500" font-family="Arial, Helvetica, sans-serif">${escapeXml(supporting)}</text>
    <rect x="64" y="${ctaY}" width="${ctaW}" height="${L.ctaHeight}" rx="12" fill="${SOCIAL_COLORS.orange}"/>
    <text x="${64 + ctaW / 2}" y="${ctaY + Math.round(L.ctaHeight * 0.64)}" fill="${SOCIAL_COLORS.white}" font-size="${L.ctaFontSize}" font-weight="700" font-family="Arial, Helvetica, sans-serif" text-anchor="middle">${escapeXml(cta)}</text>
  `;

  const copyOverlay = Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      ${headlineSvg}
      ${supportingSvg}
    </svg>
  `);

  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  await sharp(backdrop)
    .composite([
      { input: logoBuf, top: L.logoTop, left: L.logoLeft },
      { input: copyOverlay, top: 0, left: 0 },
    ])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(destPath);

  return destPath;
}

export async function buildAllSocialCampaigns({ root, logoPath, writeLog }) {
  const socialRoot = path.join(root, "public/media-kit/social");
  fs.mkdirSync(socialRoot, { recursive: true });

  for (const campaign of SOCIAL_CAMPAIGN_RENDER_SPECS) {
    const folder = path.join(socialRoot, campaign.folder);
    fs.mkdirSync(folder, { recursive: true });
    for (const format of SOCIAL_FORMATS) {
      const fileName = `jobproof-${campaign.slug}-${format.id}.png`;
      const dest = path.join(folder, fileName);
      await composeCampaignGraphic({
        width: format.width,
        height: format.height,
        destPath: dest,
        headline: campaign.headline,
        supporting: campaign.supporting,
        cta: campaign.cta,
        logoPath,
      });
      if (writeLog) writeLog(dest);
    }
  }

  // Keep a stable LinkedIn path for any residual references during Wave 1 migration.
  const canonicalLinkedIn = path.join(
    socialRoot,
    "win-more-work",
    "jobproof-win-more-work-linkedin.png"
  );
  const legacyLinkedIn = path.join(socialRoot, "jobproof-linkedin-1200x627.png");
  if (fs.existsSync(canonicalLinkedIn)) {
    fs.copyFileSync(canonicalLinkedIn, legacyLinkedIn);
  }
}
