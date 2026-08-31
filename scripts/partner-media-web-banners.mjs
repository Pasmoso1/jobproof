/**
 * Media Kit v2 — Website & Display Banner compositor.
 * Uses the transparent JobProof logo (no white plate) on brand blue.
 *
 * Campaigns are intentionally fewer than social: banner ads need shorter copy.
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

export const WEB_BANNER_COLORS = {
  blue: "#2436BB",
  navy: "#1A2558",
  orange: "#F28C38",
  proofTeal: "#4DBACC",
  white: "#FFFFFF",
};

/** Campaign copy keyed for each format family. */
export const WEB_BANNER_CAMPAIGNS = [
  {
    id: "win-more-work",
    slug: "win-more-work",
    title: "Win More Work",
    heroHeadline: ["Win more work."],
    heroSupporting: "Turn more opportunities into paying jobs.",
    heroCta: "Try JobProof",
    leaderboardHeadline: "Win more work with JobProof",
    leaderboardCta: "Try JobProof",
    rectHeadline: ["Win more work."],
    rectSupporting: ["Turn opportunities", "into paying jobs."],
    rectCta: "Try JobProof",
    skyHeadline: ["WIN", "MORE", "WORK."],
    skySupporting: ["Turn more", "opportunities", "into paying", "jobs."],
    skyCta: "Try JobProof",
  },
  {
    id: "complete-journey",
    slug: "complete-journey",
    title: "Complete Journey",
    heroHeadline: ["Win the job.", "Manage the work.", "Get paid."],
    heroSupporting: "From quote request to payment — in one place.",
    heroCta: "Try JobProof",
    leaderboardHeadline: "Win the job. Manage the work. Get paid.",
    leaderboardCta: "Learn more",
    rectHeadline: ["Win the job.", "Manage the work.", "Get paid."],
    rectSupporting: [],
    rectCta: "Try JobProof",
    skyHeadline: ["WIN", "THE JOB.", "", "MANAGE", "THE WORK.", "", "GET", "PAID."],
    skySupporting: [],
    skyCta: "Learn more",
  },
  {
    id: "protect-earned-revenue",
    slug: "protect-earned-revenue",
    title: "Protect What You've Earned",
    heroHeadline: ["Protect what", "you've earned."],
    heroSupporting:
      "Contracts, changes, approvals and job records in one place.",
    heroCta: "Learn more",
    leaderboardHeadline: null,
    leaderboardCta: null,
    rectHeadline: ["Protect what", "you've earned."],
    rectSupporting: ["Clear records from", "contract to payment."],
    rectCta: "Learn more",
    skyHeadline: null,
    skySupporting: null,
    skyCta: null,
  },
];

export const WEB_BANNER_FORMATS = [
  {
    id: "hero-1920x480",
    folder: "hero-1920x480",
    width: 1920,
    height: 480,
    legacyFile: "jobproof-banner-1920.png",
    campaigns: ["win-more-work", "complete-journey", "protect-earned-revenue"],
  },
  {
    id: "banner-1600x400",
    folder: "banner-1600x400",
    width: 1600,
    height: 400,
    legacyFile: "jobproof-banner-1600.png",
    campaigns: ["win-more-work", "complete-journey", "protect-earned-revenue"],
  },
  {
    id: "leaderboard-728x90",
    folder: "leaderboard-728x90",
    width: 728,
    height: 90,
    legacyFile: "jobproof-banner-728x90.png",
    campaigns: ["win-more-work", "complete-journey"],
  },
  {
    id: "rectangle-300x250",
    folder: "rectangle-300x250",
    width: 300,
    height: 250,
    legacyFile: "jobproof-banner-300x250.png",
    campaigns: ["win-more-work", "complete-journey", "protect-earned-revenue"],
  },
  {
    id: "skyscraper-160x600",
    folder: "skyscraper-160x600",
    width: 160,
    height: 600,
    legacyFile: "jobproof-banner-160x600.png",
    campaigns: ["win-more-work", "complete-journey"],
  },
];

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function campaignById(id) {
  return WEB_BANNER_CAMPAIGNS.find((c) => c.id === id);
}

function backdropSvg(width, height, { accentTop = 8, accentBottom = 8 } = {}) {
  return Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${WEB_BANNER_COLORS.navy}"/>
          <stop offset="55%" stop-color="${WEB_BANNER_COLORS.blue}"/>
          <stop offset="100%" stop-color="#2A45D4"/>
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#bg)"/>
      <rect x="0" y="0" width="${width}" height="${accentTop}" fill="${WEB_BANNER_COLORS.orange}"/>
      <rect x="0" y="${height - accentBottom}" width="${width}" height="${accentBottom}" fill="${WEB_BANNER_COLORS.proofTeal}"/>
      <circle cx="${Math.round(width * 0.92)}" cy="${Math.round(height * 0.18)}" r="${Math.round(Math.min(width, height) * 0.45)}" fill="rgba(255,255,255,0.05)"/>
      <circle cx="${Math.round(width * 0.08)}" cy="${Math.round(height * 0.88)}" r="${Math.round(Math.min(width, height) * 0.35)}" fill="rgba(77,186,204,0.12)"/>
      <circle cx="${Math.round(width * 0.72)}" cy="${Math.round(height * 0.7)}" r="${Math.round(Math.min(width, height) * 0.4)}" fill="rgba(242,140,56,0.07)"/>
    </svg>
  `);
}

function ctaSvg({ x, y, width, height, label, fontSize }) {
  return `
    <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${Math.round(height * 0.22)}" fill="${WEB_BANNER_COLORS.orange}"/>
    <text x="${x + width / 2}" y="${y + Math.round(height * 0.66)}" fill="#FFFFFF" font-size="${fontSize}" font-weight="700" font-family="Arial, Helvetica, sans-serif" text-anchor="middle">${escapeXml(label)}</text>
  `;
}

async function resizeLogo(logoPath, width) {
  return sharp(logoPath)
    .resize({ width, fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();
}

async function composeHeroOrWide({
  width,
  height,
  destPath,
  campaign,
  logoPath,
  compact,
}) {
  const logoW = compact ? 380 : 460;
  const logoBuf = await resizeLogo(logoPath, logoW);
  const logoMeta = await sharp(logoBuf).metadata();
  const logoH = logoMeta.height ?? 0;
  const logoTop = compact ? 28 : 36;
  const logoLeft = compact ? 48 : 64;

  const lines = campaign.heroHeadline;
  const multi = lines.length > 1;
  const headlineSize = compact
    ? multi
      ? 36
      : 44
    : multi
      ? 42
      : 56;
  const supportingSize = compact ? 20 : 24;
  const ctaW = compact ? 200 : 240;
  const ctaH = compact ? 44 : 52;
  const ctaFont = compact ? 16 : 18;

  const contentTop = logoTop + logoH + (compact ? 28 : 36);
  const lineH = headlineSize * 1.12;
  const headlineSvg = lines
    .map((line, i) => {
      const y = contentTop + Math.round(headlineSize * 0.8) + i * lineH;
      return `<text x="${logoLeft}" y="${y}" fill="#FFFFFF" font-size="${headlineSize}" font-weight="700" font-family="Arial, Helvetica, sans-serif">${escapeXml(line)}</text>`;
    })
    .join("");

  const supportingY =
    contentTop + lines.length * lineH + (compact ? 18 : 24);
  const ctaY = height - (compact ? 72 : 88);

  const overlay = Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      ${headlineSvg}
      <text x="${logoLeft}" y="${supportingY}" fill="rgba(255,255,255,0.92)" font-size="${supportingSize}" font-weight="500" font-family="Arial, Helvetica, sans-serif">${escapeXml(campaign.heroSupporting)}</text>
      ${ctaSvg({
        x: logoLeft,
        y: ctaY,
        width: ctaW,
        height: ctaH,
        label: campaign.heroCta,
        fontSize: ctaFont,
      })}
    </svg>
  `);

  const panelW = Math.round(width * (compact ? 0.28 : 0.3));
  const panelH = Math.round(height * 0.62);
  const panelX = width - panelW - (compact ? 40 : 56);
  const panelY = Math.round((height - panelH) / 2);
  const panel = Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="${panelX}" y="${panelY}" width="${panelW}" height="${panelH}" rx="18" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.18)" stroke-width="2"/>
      <rect x="${panelX + 18}" y="${panelY + 18}" width="${panelW - 36}" height="28" rx="8" fill="rgba(255,255,255,0.14)"/>
      <rect x="${panelX + 18}" y="${panelY + 62}" width="${Math.round((panelW - 36) * 0.7)}" height="14" rx="4" fill="rgba(255,255,255,0.22)"/>
      <rect x="${panelX + 18}" y="${panelY + 88}" width="${Math.round((panelW - 36) * 0.9)}" height="14" rx="4" fill="rgba(255,255,255,0.14)"/>
      <rect x="${panelX + 18}" y="${panelY + 114}" width="${Math.round((panelW - 36) * 0.55)}" height="14" rx="4" fill="rgba(255,255,255,0.14)"/>
      <rect x="${panelX + 18}" y="${panelY + panelH - 70}" width="${panelW - 36}" height="42" rx="10" fill="${WEB_BANNER_COLORS.orange}"/>
      <text x="${panelX + panelW / 2}" y="${panelY + panelH - 42}" fill="#FFFFFF" font-size="16" font-weight="700" font-family="Arial, Helvetica, sans-serif" text-anchor="middle">Quote → Payment</text>
    </svg>
  `);

  await sharp(
    backdropSvg(width, height, {
      accentTop: compact ? 6 : 10,
      accentBottom: compact ? 6 : 10,
    })
  )
    .composite([
      { input: panel, top: 0, left: 0 },
      { input: logoBuf, top: logoTop, left: logoLeft },
      { input: overlay, top: 0, left: 0 },
    ])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(destPath);
}

async function composeLeaderboard({
  width,
  height,
  destPath,
  campaign,
  logoPath,
}) {
  const logoBuf = await resizeLogo(logoPath, 168);
  const logoMeta = await sharp(logoBuf).metadata();
  const logoH = logoMeta.height ?? 0;
  const logoTop = Math.round((height - logoH) / 2);
  const logoLeft = 16;

  const textX = logoLeft + (logoMeta.width ?? 168) + 18;
  const ctaW = 118;
  const ctaH = 40;
  const ctaX = width - ctaW - 16;
  const ctaY = Math.round((height - ctaH) / 2);
  const headlineSize = campaign.id === "complete-journey" ? 18 : 22;

  const overlay = Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <text x="${textX}" y="${Math.round(height * 0.58)}" fill="#FFFFFF" font-size="${headlineSize}" font-weight="700" font-family="Arial, Helvetica, sans-serif">${escapeXml(campaign.leaderboardHeadline)}</text>
      ${ctaSvg({
        x: ctaX,
        y: ctaY,
        width: ctaW,
        height: ctaH,
        label: campaign.leaderboardCta,
        fontSize: 14,
      })}
    </svg>
  `);

  await sharp(backdropSvg(width, height, { accentTop: 4, accentBottom: 4 }))
    .composite([
      { input: logoBuf, top: logoTop, left: logoLeft },
      { input: overlay, top: 0, left: 0 },
    ])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(destPath);
}

async function composeRectangle({
  width,
  height,
  destPath,
  campaign,
  logoPath,
}) {
  const logoBuf = await resizeLogo(logoPath, 168);
  const logoTop = 16;
  const logoLeft = 18;

  const lines = campaign.rectHeadline;
  const support = campaign.rectSupporting ?? [];
  const headlineSize = lines.length >= 3 ? 22 : 26;
  const supportSize = 14;
  const startY = 78;
  const lineH = headlineSize * 1.15;

  const headlineSvg = lines
    .map((line, i) => {
      const y = startY + Math.round(headlineSize * 0.85) + i * lineH;
      return `<text x="${logoLeft}" y="${y}" fill="#FFFFFF" font-size="${headlineSize}" font-weight="700" font-family="Arial, Helvetica, sans-serif">${escapeXml(line)}</text>`;
    })
    .join("");

  const supportStart = startY + lines.length * lineH + 10;
  const supportSvg = support
    .map((line, i) => {
      const y = supportStart + i * (supportSize * 1.35);
      return `<text x="${logoLeft}" y="${y}" fill="rgba(255,255,255,0.9)" font-size="${supportSize}" font-weight="500" font-family="Arial, Helvetica, sans-serif">${escapeXml(line)}</text>`;
    })
    .join("");

  const ctaW = 140;
  const ctaH = 36;
  const overlay = Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      ${headlineSvg}
      ${supportSvg}
      ${ctaSvg({
        x: logoLeft,
        y: height - ctaH - 16,
        width: ctaW,
        height: ctaH,
        label: campaign.rectCta,
        fontSize: 14,
      })}
    </svg>
  `);

  await sharp(backdropSvg(width, height, { accentTop: 5, accentBottom: 5 }))
    .composite([
      { input: logoBuf, top: logoTop, left: logoLeft },
      { input: overlay, top: 0, left: 0 },
    ])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(destPath);
}

async function composeSkyscraper({
  width,
  height,
  destPath,
  campaign,
  logoPath,
}) {
  const logoBuf = await resizeLogo(logoPath, 128);
  const logoTop = 24;
  const logoLeft = Math.max(16, Math.round((width - 128) / 2));

  const lines = campaign.skyHeadline ?? [];
  const support = campaign.skySupporting ?? [];
  const headlineSize = 26;
  const supportSize = 13;
  let yCursor = 120;
  const headlineParts = [];
  for (const line of lines) {
    if (line === "") {
      yCursor += 14;
      continue;
    }
    yCursor += headlineSize * 1.05;
    headlineParts.push(
      `<text x="${width / 2}" y="${Math.round(yCursor)}" fill="#FFFFFF" font-size="${headlineSize}" font-weight="700" font-family="Arial, Helvetica, sans-serif" text-anchor="middle">${escapeXml(line)}</text>`
    );
  }

  yCursor += 22;
  const supportParts = [];
  for (const line of support) {
    yCursor += supportSize * 1.4;
    supportParts.push(
      `<text x="${width / 2}" y="${Math.round(yCursor)}" fill="rgba(255,255,255,0.9)" font-size="${supportSize}" font-weight="500" font-family="Arial, Helvetica, sans-serif" text-anchor="middle">${escapeXml(line)}</text>`
    );
  }

  const ctaW = 128;
  const ctaH = 40;
  const overlay = Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      ${headlineParts.join("")}
      ${supportParts.join("")}
      ${ctaSvg({
        x: Math.round((width - ctaW) / 2),
        y: height - ctaH - 28,
        width: ctaW,
        height: ctaH,
        label: campaign.skyCta,
        fontSize: 13,
      })}
    </svg>
  `);

  await sharp(backdropSvg(width, height, { accentTop: 6, accentBottom: 6 }))
    .composite([
      { input: logoBuf, top: logoTop, left: logoLeft },
      { input: overlay, top: 0, left: 0 },
    ])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(destPath);
}

export async function composeWebBanner({ format, campaign, destPath, logoPath }) {
  fs.mkdirSync(path.dirname(destPath), { recursive: true });

  if (format.id === "hero-1920x480") {
    await composeHeroOrWide({
      width: format.width,
      height: format.height,
      destPath,
      campaign,
      logoPath,
      compact: false,
    });
    return;
  }
  if (format.id === "banner-1600x400") {
    await composeHeroOrWide({
      width: format.width,
      height: format.height,
      destPath,
      campaign,
      logoPath,
      compact: true,
    });
    return;
  }
  if (format.id === "leaderboard-728x90") {
    await composeLeaderboard({
      width: format.width,
      height: format.height,
      destPath,
      campaign,
      logoPath,
    });
    return;
  }
  if (format.id === "rectangle-300x250") {
    await composeRectangle({
      width: format.width,
      height: format.height,
      destPath,
      campaign,
      logoPath,
    });
    return;
  }
  if (format.id === "skyscraper-160x600") {
    await composeSkyscraper({
      width: format.width,
      height: format.height,
      destPath,
      campaign,
      logoPath,
    });
  }
}

export async function buildAllWebBanners({ root, logoPath, writeLog }) {
  const webRoot = path.join(root, "public/media-kit/web");
  const legacyRoot = path.join(root, "public/media-kit/website");
  fs.mkdirSync(webRoot, { recursive: true });
  fs.mkdirSync(legacyRoot, { recursive: true });

  const written = [];

  for (const format of WEB_BANNER_FORMATS) {
    const folder = path.join(webRoot, format.folder);
    fs.mkdirSync(folder, { recursive: true });

    for (const campaignId of format.campaigns) {
      const campaign = campaignById(campaignId);
      if (!campaign) continue;
      if (format.id === "leaderboard-728x90" && !campaign.leaderboardHeadline) {
        continue;
      }
      if (format.id === "skyscraper-160x600" && !campaign.skyHeadline) {
        continue;
      }

      const fileName = `jobproof-${campaign.slug}-${format.width}x${format.height}.png`;
      const dest = path.join(folder, fileName);
      await composeWebBanner({ format, campaign, destPath: dest, logoPath });
      written.push(dest);
      if (writeLog) writeLog(dest);

      if (campaignId === "win-more-work" && format.legacyFile) {
        const legacyDest = path.join(legacyRoot, format.legacyFile);
        fs.copyFileSync(dest, legacyDest);
        if (writeLog) writeLog(legacyDest);
      }
    }
  }

  return written;
}
