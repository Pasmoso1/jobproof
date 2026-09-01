/**
 * Build production Partner Media Kit assets from uploaded JobProof logo masters.
 *
 * Logo artwork is never recolored, redrawn, stretched, or AI-generated.
 * Only copy, trim, resize (uniform), and composite onto layouts.
 *
 * Run: node scripts/build-partner-media-kit.mjs
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { buildAllSocialCampaigns } from "./partner-media-social-campaigns.mjs";
import { buildAllWebBanners } from "./partner-media-web-banners.mjs";
import { buildAllPrintAssets } from "./partner-media-print.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const DOWNLOADS = path.join(process.env.USERPROFILE || process.env.HOME || "", "Downloads");

const COLORS = {
  blue: "#2436BB",
  brightBlue: "#2C37EC",
  softTeal: "#4DB6AC",
  proofTeal: "#4DBACC",
  orange: "#F28C38",
  navy: "#1A2558",
  white: "#FFFFFF",
  zinc50: "#FAFAFA",
  zinc100: "#F4F4F5",
  zinc700: "#3F3F46",
  zinc900: "#18181B",
};

const OUT = {
  root: path.join(ROOT, "public/media-kit"),
  logos: path.join(ROOT, "public/media-kit/logos"),
  icons: path.join(ROOT, "public/media-kit/icons"),
  favicons: path.join(ROOT, "public/media-kit/favicons"),
  social: path.join(ROOT, "public/media-kit/social"),
  email: path.join(ROOT, "public/media-kit/email"),
  website: path.join(ROOT, "public/media-kit/website"),
  web: path.join(ROOT, "public/media-kit/web"),
  print: path.join(ROOT, "public/media-kit/print"),
  brand: path.join(ROOT, "public/media-kit/brand"),
  source: path.join(ROOT, "public/media-kit/source"),
};

/** First existing path wins — prefer vendored true-transparent masters. */
function resolveMaster(...candidates) {
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }
  return null;
}

const VENDORED = {
  horizontalTransparent: path.join(
    ROOT,
    "public/media-kit/source/jobproof-logo-horizontal-transparent.png"
  ),
  sheetTransparent: path.join(
    ROOT,
    "public/media-kit/source/jobproof-logos-sheet-transparent.png"
  ),
  shieldTransparent: path.join(
    ROOT,
    "public/media-kit/source/jobproof-shield-transparent.png"
  ),
};

const MASTERS = {
  /**
   * True-transparent horizontal lockup (no white plate). Prefer vendored copy,
   * then Downloads/trans12565, then legacy opaque plate master (stripped at build).
   */
  get primaryHorizontal() {
    return resolveMaster(
      VENDORED.horizontalTransparent,
      path.join(DOWNLOADS, "trans12565", "3.png"),
      path.join(DOWNLOADS, "Png.LogosTransparent", "jobproof-logo.png.png")
    );
  },
  get sheetTransparent() {
    return resolveMaster(
      VENDORED.sheetTransparent,
      path.join(DOWNLOADS, "trans12565", "1.png"),
      path.join(DOWNLOADS, "Png.LogosTransparent", "1.png")
    );
  },
  get shieldSheet() {
    return resolveMaster(
      VENDORED.shieldTransparent,
      path.join(DOWNLOADS, "trans12565", "2.png"),
      path.join(DOWNLOADS, "JobProof_13_Separate_Media_Assets_FINAL", "10_shield_transparent_1024x1024.png"),
      path.join(DOWNLOADS, "Png.LogosTransparent", "2.png")
    );
  },
  faviconDir: path.join(DOWNLOADS, "favicon"),
};

function ensureDirs() {
  for (const dir of Object.values(OUT)) fs.mkdirSync(dir, { recursive: true });
}

async function writePng(pipeline, dest) {
  await pipeline.png({ compressionLevel: 9, adaptiveFiltering: true }).toFile(dest);
  const meta = await sharp(dest).metadata();
  console.log("wrote", path.relative(ROOT, dest), `${meta.width}x${meta.height}`);
}

/** True when the PNG already has meaningful alpha (not an opaque white plate). */
async function hasSubstantialTransparency(input, minRatio = 0.12) {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let transparent = 0;
  const total = info.width * info.height;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 10) transparent++;
  }
  return transparent / total >= minRatio;
}

/**
 * Remove exterior opaque white plate via edge flood-fill.
 * Preserves interior white strokes that are not connected to the image border
 * (e.g. "Job" lettering). Prefer true-transparent masters when available —
 * checkmark tips that touch the plate may be cleared on opaque masters.
 */
async function stripExteriorWhitePlate(input, { threshold = 245 } = {}) {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const out = Buffer.from(data);
  const isPlate = (i) =>
    out[i] >= threshold &&
    out[i + 1] >= threshold &&
    out[i + 2] >= threshold &&
    out[i + 3] > 0;

  const seen = new Uint8Array(w * h);
  const qx = new Int32Array(w * h);
  const qy = new Int32Array(w * h);
  let qs = 0;
  let qe = 0;
  const push = (x, y) => {
    const k = y * w + x;
    if (seen[k]) return;
    seen[k] = 1;
    qx[qe] = x;
    qy[qe] = y;
    qe++;
  };

  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y);
    push(w - 1, y);
  }

  while (qs < qe) {
    const x = qx[qs];
    const y = qy[qs];
    qs++;
    const i = (y * w + x) * 4;
    if (!isPlate(i)) continue;
    out[i + 3] = 0;
    if (x > 0) push(x - 1, y);
    if (x < w - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < h - 1) push(x, y + 1);
  }

  return sharp(out, { raw: { width: w, height: h, channels: 4 } })
    .trim({ threshold: 1 })
    .png()
    .toBuffer();
}

/** Normalize a logo master: keep true transparency; strip opaque white plates. */
async function prepareTransparentLogo(input) {
  const buf = await sharp(input).ensureAlpha().png().toBuffer();
  if (await hasSubstantialTransparency(buf)) {
    return sharp(buf).trim({ threshold: 1 }).png().toBuffer();
  }
  return stripExteriorWhitePlate(buf);
}

async function resizeContain(input, width, height, background = { r: 0, g: 0, b: 0, alpha: 0 }) {
  return sharp(input)
    .resize(width, height, { fit: "contain", background })
    .png({ compressionLevel: 9, adaptiveFiltering: true });
}

/** Ensure transparent safe padding so the wordmark never touches the canvas edge. */
async function ensureSafePadding(input, padding = 24) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  });
  const w = info.width;
  const h = info.height;
  let minX = w;
  let maxX = 0;
  let minY = h;
  let maxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] <= 20) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < minX) return Buffer.from(input);

  const leftPad = Math.max(0, padding - minX);
  const rightPad = Math.max(0, padding - (w - 1 - maxX));
  const topPad = Math.max(0, padding - minY);
  const bottomPad = Math.max(0, padding - (h - 1 - maxY));

  return sharp(input)
    .extend({
      top: topPad,
      bottom: bottomPad,
      left: leftPad,
      right: rightPad,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
}

async function prepareLogos() {
  const sheetPath = MASTERS.sheetTransparent;
  const shieldPath = MASTERS.shieldSheet;
  const primaryPath = MASTERS.primaryHorizontal;
  if (!sheetPath) throw new Error("Missing required master: sheetTransparent");
  if (!shieldPath) throw new Error("Missing required master: shieldSheet");
  if (!primaryPath) throw new Error("Missing required master: primaryHorizontal");

  fs.copyFileSync(
    sheetPath,
    path.join(OUT.source, "png-logos-transparent-1.png")
  );
  fs.copyFileSync(shieldPath, path.join(OUT.source, "jobproof-shield-source.png"));

  // Primary horizontal — prefer true-transparent master (no white plate).
  // Opaque plate masters are edge-flood-stripped; never hull-pad white into a sticker.
  fs.copyFileSync(
    primaryPath,
    path.join(OUT.source, "jobproof-logo-horizontal-source.png")
  );
  const primaryClean = await prepareTransparentLogo(primaryPath);
  console.log(
    "using horizontal master:",
    path.relative(ROOT, primaryPath),
    (await hasSubstantialTransparency(await sharp(primaryPath).png().toBuffer()))
      ? "(already transparent)"
      : "(white plate stripped)"
  );

  const primaryBuf = await ensureSafePadding(primaryClean, 32);
  await writePng(sharp(primaryBuf), path.join(OUT.logos, "jobproof-primary-horizontal.png"));

  // Secondary — same artwork, slightly tighter outer padding (still full wordmark)
  const secondaryBuf = await ensureSafePadding(primaryClean, 16);
  await writePng(
    sharp(secondaryBuf).resize({ width: 1600, fit: "inside", withoutEnlargement: true }),
    path.join(OUT.logos, "jobproof-secondary-horizontal.png")
  );

  // Compact — reduced outer padding only; never crop the brand name
  const compactPadded = await ensureSafePadding(primaryClean, 8);
  const compactResized = await sharp(compactPadded)
    .resize({ width: 640, fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();
  // Re-apply minimum transparent padding after resize so the right edge never clips.
  const compactBuf = await ensureSafePadding(compactResized, 8);
  await writePng(sharp(compactBuf), path.join(OUT.logos, "jobproof-compact-horizontal.png"));

  // Site header logo — same transparent lockup used across white/zinc app chrome.
  await writePng(
    sharp(primaryBuf).resize({ width: 1154, fit: "inside", withoutEnlargement: true }),
    path.join(ROOT, "public/jobproof-logo.png")
  );

  // Shield — prefer true-transparent master
  const shieldClean = await prepareTransparentLogo(shieldPath);
  const shieldBuf = await ensureSafePadding(shieldClean, 24);
  const shieldMaster = path.join(OUT.icons, "jobproof-shield-1024.png");
  await writePng(
    sharp(shieldBuf).resize(1024, 1024, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    }),
    shieldMaster
  );

  for (const size of [512, 256, 128, 64, 32]) {
    await writePng(
      await resizeContain(shieldMaster, size, size),
      path.join(OUT.icons, `jobproof-shield-${size}.png`)
    );
  }

  // App icons — composite real shield onto light/dark pads (shield unchanged)
  const shield512 = await sharp(shieldMaster)
    .resize(400, 400, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  await writePng(
    sharp({
      create: {
        width: 512,
        height: 512,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      },
    }).composite([{ input: shield512, gravity: "centre" }]),
    path.join(OUT.icons, "jobproof-app-light-512.png")
  );

  await writePng(
    sharp({
      create: {
        width: 512,
        height: 512,
        channels: 4,
        background: { r: 26, g: 37, b: 88, alpha: 1 },
      },
    }).composite([{ input: shield512, gravity: "centre" }]),
    path.join(OUT.icons, "jobproof-app-dark-512.png")
  );
}

async function prepareFavicons() {
  const dir = MASTERS.faviconDir;
  if (fs.existsSync(dir)) {
    const map = {
      "favicon.ico": "jobproof-favicon.ico",
      "favicon.svg": "jobproof-favicon.svg",
      "favicon-96x96.png": "jobproof-favicon-96.png",
      "apple-touch-icon.png": "jobproof-apple-touch-icon.png",
      "web-app-manifest-192x192.png": "jobproof-web-app-192.png",
      "web-app-manifest-512x512.png": "jobproof-web-app-512.png",
    };
    for (const [src, dest] of Object.entries(map)) {
      const from = path.join(dir, src);
      if (fs.existsSync(from)) {
        fs.copyFileSync(from, path.join(OUT.favicons, dest));
        console.log("copied", path.relative(ROOT, path.join(OUT.favicons, dest)));
      }
    }
  }

  const shield32 = path.join(OUT.icons, "jobproof-shield-32.png");
  await writePng(await resizeContain(shield32, 32, 32), path.join(OUT.favicons, "jobproof-favicon-32.png"));
  await writePng(await resizeContain(shield32, 16, 16), path.join(OUT.favicons, "jobproof-favicon-16.png"));
}

async function buildSocial() {
  const logoPath = path.join(OUT.logos, "jobproof-primary-horizontal.png");
  await buildAllSocialCampaigns({
    root: ROOT,
    logoPath,
    writeLog: (dest) =>
      console.log("wrote", path.relative(ROOT, dest)),
  });

  // Remove obsolete Wave-1 platform-first graphics from Media Centre display roots.
  for (const legacy of [
    "jobproof-facebook-post-1080.png",
    "jobproof-instagram-post-1080.png",
    "jobproof-instagram-story-1080x1920.png",
    "jobproof-twitter-1600x900.png",
  ]) {
    const p = path.join(OUT.social, legacy);
    if (fs.existsSync(p)) {
      fs.unlinkSync(p);
      console.log("removed legacy", path.relative(ROOT, p));
    }
  }
}

async function buildWebsiteBanners() {
  const logoPath = path.join(OUT.logos, "jobproof-primary-horizontal.png");
  await buildAllWebBanners({
    root: ROOT,
    logoPath,
    writeLog: (dest) => console.log("wrote", path.relative(ROOT, dest)),
  });
}

async function buildPrint() {
  const logoPath = path.join(OUT.logos, "jobproof-primary-horizontal.png");
  await buildAllPrintAssets({
    root: ROOT,
    logoPath,
    writeLog: (dest) => console.log("wrote", path.relative(ROOT, dest)),
  });
}

async function buildBrandGuidelinesPdf() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([612, 792]);
  const blue = rgb(0.141, 0.212, 0.733);
  const navy = rgb(0.102, 0.145, 0.345);
  const zinc = rgb(0.25, 0.25, 0.28);

  let y = 740;
  const draw = (text, size, f = font, color = zinc) => {
    page.drawText(text, { x: 48, y, size, font: f, color, maxWidth: 516 });
    y -= size + 10;
  };

  page.drawRectangle({ x: 0, y: 762, width: 612, height: 30, color: blue });
  page.drawText("JobProof Brand Guidelines", {
    x: 48,
    y: 772,
    size: 14,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  draw("Partner Media Kit", 22, fontBold, navy);
  draw("Use only approved assets. Do not alter the JobProof logo.", 11);
  y -= 8;

  draw("Approved logo usage", 14, fontBold, navy);
  for (const line of [
    "• Use the supplied full-colour logo files",
    "• Maintain the original aspect ratio",
    "• Leave clear space around the mark",
    "• Use high-resolution files for large placements",
    "• Place on backgrounds with strong contrast",
  ]) {
    draw(line, 11);
  }
  y -= 6;

  draw("Minimum spacing & size", 14, fontBold, navy);
  draw("• Keep clear space at least equal to the shield height around the logo", 11);
  draw("• Digital minimum width: 120px for horizontal logo, 32px for shield", 11);
  draw("• Print minimum width: 1.25 in for horizontal logo, 0.4 in for shield", 11);
  y -= 6;

  draw("Colour palette (from JobProof branding)", 14, fontBold, navy);
  for (const line of [
    "• JobProof Blue  #2436BB",
    "• Bright Blue    #2C37EC",
    "• Soft Teal      #4DB6AC",
    "• Proof Teal     #4DBACC",
    "• Accent Orange  #F28C38",
    "• White          #FFFFFF",
  ]) {
    draw(line, 11);
  }
  y -= 6;

  draw("Acceptable backgrounds", 14, fontBold, navy);
  draw("• White, light neutrals, or solid brand blue/navy with strong contrast", 11);
  draw("• Photography only when the logo remains fully legible", 11);
  y -= 6;

  draw("Unacceptable modifications", 14, fontBold, navy);
  for (const line of [
    "• Stretching, compressing, rotating, or cropping the logo",
    "• Recolouring or rearranging the shield and wordmark",
    "• Adding shadows, outlines, or effects",
    "• Placing over busy imagery that reduces legibility",
  ]) {
    draw(line, 11);
  }
  y -= 6;

  draw("Typography & tone of voice", 14, fontBold, navy);
  draw("• Prefer clean modern sans-serif type in partner materials", 11);
  draw("• Tone: professional, trustworthy, contractor-first, clear, helpful", 11);
  draw("• Emphasize quotes, contracts, change orders, invoices, documentation,", 11);
  draw("  dispute protection, fast payments, and a professional image", 11);
  y -= 10;

  draw("Questions: partners@jobproof.ca", 11, fontBold, blue);

  // Embed logo at bottom
  const logoBytes = fs.readFileSync(path.join(OUT.logos, "jobproof-compact-horizontal.png"));
  const logo = await doc.embedPng(logoBytes);
  const lw = 160;
  const lh = (logo.height / logo.width) * lw;
  page.drawImage(logo, { x: 48, y: 48, width: lw, height: lh });

  const out = path.join(OUT.brand, "jobproof-brand-guidelines.pdf");
  fs.writeFileSync(out, await doc.save());
  console.log("wrote", path.relative(ROOT, out));
}

function writeEmailResources() {
  const introHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Introducing JobProof</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7;">
        <tr><td style="background:#2436BB;padding:20px 28px;">
          <img src="https://jobproof.ca/media-kit/logos/jobproof-compact-horizontal.png" alt="JobProof" width="200" style="display:block;border:0;height:auto;"/>
        </td></tr>
        <tr><td style="padding:28px;">
          <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:#1A2558;">Help contractors win more work and grow their business</h1>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3f3f46;">
            JobProof gives contractors tools to manage the journey from quote request to payment — helping turn more opportunities into paying jobs, and keep clear records that protect earned revenue.
          </p>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#3f3f46;">
            If you work with contractors who are ready for clearer systems, share JobProof with them:
          </p>
          <a href="[PARTNER LINK]" style="display:inline-block;background:#F28C38;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:12px 20px;border-radius:8px;">Explore JobProof</a>
        </td></tr>
        <tr><td style="padding:16px 28px 28px;font-size:12px;color:#71717a;">
          Replace [PARTNER LINK] with your personal referral URL from the Partner Portal.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
`;

  const introText = `Help contractors win more work and grow their business

JobProof gives contractors tools to manage the journey from quote request to payment — helping turn more opportunities into paying jobs, and keep clear records that protect earned revenue.

Share JobProof: [PARTNER LINK]

Replace [PARTNER LINK] with your personal referral URL from the Partner Portal.
`;

  const referralHtml = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><title>JobProof referral</title></head>
<body style="font-family:Arial,Helvetica,sans-serif;color:#18181b;line-height:1.6;padding:24px;">
  <p>Hi,</p>
  <p>I wanted to share JobProof with you. It’s built for contractors who need professional quotes, contracts, change orders, invoices, documentation, and clearer payment workflows—with records that support dispute protection.</p>
  <p>You can learn more here: <a href="[PARTNER LINK]">[PARTNER LINK]</a></p>
  <p>Happy to answer questions if helpful.</p>
</body>
</html>
`;

  const referralText = `Hi,

I wanted to share JobProof with you. It’s built for contractors who need professional quotes, contracts, change orders, invoices, documentation, and clearer payment workflows—with records that support dispute protection.

Learn more: [PARTNER LINK]

Happy to answer questions if helpful.
`;

  const reminderHtml = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><title>JobProof reminder</title></head>
<body style="font-family:Arial,Helvetica,sans-serif;color:#18181b;line-height:1.6;padding:24px;">
  <p>Hi,</p>
  <p>Quick reminder about JobProof—the contractor platform for quotes, contracts, change orders, invoices, and job documentation that helps teams look professional and get paid with more confidence.</p>
  <p>Here’s the link again: <a href="[PARTNER LINK]">[PARTNER LINK]</a></p>
</body>
</html>
`;

  const reminderText = `Hi,

Quick reminder about JobProof—the contractor platform for quotes, contracts, change orders, invoices, and job documentation that helps teams look professional and get paid with more confidence.

Here’s the link again: [PARTNER LINK]
`;

  const subjects = `JobProof partner email — subject line suggestions

1. A simpler way for contractors to quote, contract, and get paid
2. Help your network look more professional on every job
3. Quotes, contracts, change orders, and invoices—in one place
4. Protect every project with clearer documentation
5. Share JobProof with contractors who want faster payments
6. From first quote to final invoice—without the paperwork scramble
7. A Canadian platform built for growing trade businesses
`;

  fs.writeFileSync(path.join(OUT.email, "introduction-email.html"), introHtml);
  fs.writeFileSync(path.join(OUT.email, "introduction-email.txt"), introText);
  fs.writeFileSync(path.join(OUT.email, "referral-email.html"), referralHtml);
  fs.writeFileSync(path.join(OUT.email, "referral-email.txt"), referralText);
  fs.writeFileSync(path.join(OUT.email, "reminder-email.html"), reminderHtml);
  fs.writeFileSync(path.join(OUT.email, "reminder-email.txt"), reminderText);
  fs.writeFileSync(path.join(OUT.email, "subject-line-suggestions.txt"), subjects);
  console.log("wrote email resources in public/media-kit/email/");
}

async function main() {
  ensureDirs();
  await prepareLogos();
  await prepareFavicons();
  await buildSocial();
  await buildWebsiteBanners();
  await buildPrint();
  await buildBrandGuidelinesPdf();
  writeEmailResources();

  fs.writeFileSync(
    path.join(OUT.root, "README.md"),
    `# Partner media kit assets

Canonical logo masters (do not recreate or recolour):

- \`source/png-logos-transparent-1.png\` (uploaded package sheet)
- \`source/jobproof-shield-source.png\`

Generate / refresh exports:

\`\`\`bash
node scripts/build-partner-media-kit.mjs
\`\`\`

Folders:

- \`logos/\` \`icons/\` \`favicons/\` \`social/\` \`web/\` \`email/\` \`website/\` \`print/\` \`brand/\`

Intentionally pending until vector masters exist:

- Logo SVG / logo PDF packs (favicon SVG is available)
`
  );
  console.log("Media kit build complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
