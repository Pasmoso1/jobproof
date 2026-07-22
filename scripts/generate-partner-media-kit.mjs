/**
 * Generate Partner Media Center logo assets from the brand sheet.
 *
 * Source: public/media-kit/source/JobProofLG.png
 * Run: node scripts/generate-partner-media-kit.mjs
 *
 * Crop coordinates are tuned against the 1536×1024 sheet layout.
 * Re-run and inspect public/media-kit/** after changing coordinates.
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const SOURCE = path.join(ROOT, "public/media-kit/source/JobProofLG.png");
const OUT = {
  logos: path.join(ROOT, "public/media-kit/logos"),
  icons: path.join(ROOT, "public/media-kit/icons"),
  favicons: path.join(ROOT, "public/media-kit/favicons"),
  downloads: path.join(ROOT, "public/media-kit/downloads"),
  qa: path.join(ROOT, "public/media-kit/source/qa-final"),
};

/** Manual crop regions on the 1536×1024 source sheet. */
const REGIONS = {
  primaryHorizontal: { left: 170, top: 115, width: 760, height: 230 },
  secondaryHorizontal: { left: 115, top: 350, width: 580, height: 190 },
  // Compact lockup sits beside the mid-size shield row.
  compactHorizontal: { left: 470, top: 548, width: 360, height: 115 },
  // Cleanest isolated shield available on the sheet (from light app icon).
  shieldMaster: { left: 1110, top: 590, width: 125, height: 125 },
  appLight: { left: 1095, top: 575, width: 155, height: 155 },
  appDark: { left: 1285, top: 575, width: 155, height: 155 },
};

async function ensureDirs() {
  for (const dir of Object.values(OUT)) fs.mkdirSync(dir, { recursive: true });
}

/**
 * Extract a region, remove near-black sheet background to transparency,
 * then trim empty edges without clipping logo content.
 */
async function extractClean(region, options = {}) {
  const { padding = 4, blackThreshold = 28 } = options;
  const extracted = await sharp(SOURCE).extract(region).ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  });
  const { data, info } = extracted;
  const out = Buffer.from(data);

  for (let i = 0; i < out.length; i += 4) {
    const r = out[i];
    const g = out[i + 1];
    const b = out[i + 2];
    // Sheet canvas is near-black; keep logo navy/teal/white/orange pixels.
    if (r <= blackThreshold && g <= blackThreshold && b <= blackThreshold) {
      out[i + 3] = 0;
    }
  }

  let pipeline = sharp(out, {
    raw: { width: info.width, height: info.height, channels: 4 },
  }).png();

  const trimmed = await pipeline.trim({ threshold: 5 }).toBuffer();
  if (padding > 0) {
    return sharp(trimmed)
      .extend({
        top: padding,
        bottom: padding,
        left: padding,
        right: padding,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png({ compressionLevel: 9, adaptiveFiltering: true });
  }
  return sharp(trimmed).png({ compressionLevel: 9, adaptiveFiltering: true });
}

async function writePng(img, dest) {
  await img.toFile(dest);
  const meta = await sharp(dest).metadata();
  console.log("wrote", path.relative(ROOT, dest), `${meta.width}x${meta.height}`);
}

async function resizeSquareFrom(sourcePath, size, dest) {
  await sharp(sourcePath)
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(dest);
  console.log("wrote", path.relative(ROOT, dest), `${size}x${size}`);
}

async function main() {
  if (!fs.existsSync(SOURCE)) {
    throw new Error(`Missing source sheet: ${SOURCE}`);
  }
  await ensureDirs();

  // QA copies of raw regions (before cleanup) for visual verification.
  for (const [name, region] of Object.entries(REGIONS)) {
    await sharp(SOURCE)
      .extract(region)
      .png()
      .toFile(path.join(OUT.qa, `${name}.png`));
  }

  const primaryPath = path.join(OUT.logos, "jobproof-primary-horizontal.png");
  const secondaryPath = path.join(OUT.logos, "jobproof-secondary-horizontal.png");
  const compactPath = path.join(OUT.logos, "jobproof-compact-horizontal.png");
  const shield1024 = path.join(OUT.icons, "jobproof-shield-1024.png");

  await writePng(await extractClean(REGIONS.primaryHorizontal), primaryPath);
  await writePng(await extractClean(REGIONS.secondaryHorizontal), secondaryPath);

  // Prefer a clean compact export: if sheet crop is incomplete, scale secondary to ~320px wide.
  const compactTmp = path.join(OUT.qa, "compact-sheet.png");
  await writePng(
    await extractClean(REGIONS.compactHorizontal, { padding: 2 }),
    compactTmp
  );
  const compactMeta = await sharp(compactTmp).metadata();
  if ((compactMeta.width ?? 0) >= 280) {
    await sharp(compactTmp)
      .resize({ width: 320, withoutEnlargement: true })
      .png({ compressionLevel: 9 })
      .toFile(compactPath);
  } else {
    await sharp(secondaryPath)
      .resize({ width: 320, withoutEnlargement: false })
      .png({ compressionLevel: 9 })
      .toFile(compactPath);
  }
  console.log("wrote", path.relative(ROOT, compactPath));

  // Master shield from sheet, then upscale/downscale cleanly for size set.
  const shieldMasterPath = path.join(OUT.qa, "shield-master-clean.png");
  await writePng(await extractClean(REGIONS.shieldMaster, { padding: 2 }), shieldMasterPath);
  await sharp(shieldMasterPath)
    .resize(1024, 1024, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(shield1024);
  console.log("wrote", path.relative(ROOT, shield1024), "1024x1024");

  for (const size of [512, 256, 128, 64, 32]) {
    await resizeSquareFrom(
      shield1024,
      size,
      path.join(OUT.icons, `jobproof-shield-${size}.png`)
    );
  }

  const lightTmp = path.join(OUT.qa, "app-light-tmp.png");
  const darkTmp = path.join(OUT.qa, "app-dark-tmp.png");
  await writePng(
    await extractClean(REGIONS.appLight, { padding: 0, blackThreshold: 20 }),
    lightTmp
  );
  await sharp(lightTmp)
    .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT.icons, "jobproof-app-light-512.png"));
  console.log("wrote public/media-kit/icons/jobproof-app-light-512.png 512x512");

  await writePng(
    await extractClean(REGIONS.appDark, { padding: 0, blackThreshold: 20 }),
    darkTmp
  );
  await sharp(darkTmp)
    .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT.icons, "jobproof-app-dark-512.png"));
  console.log("wrote public/media-kit/icons/jobproof-app-dark-512.png 512x512");

  await resizeSquareFrom(shield1024, 32, path.join(OUT.favicons, "jobproof-favicon-32.png"));
  await resizeSquareFrom(shield1024, 16, path.join(OUT.favicons, "jobproof-favicon-16.png"));

  console.log("\nDone. Inspect QA crops in public/media-kit/source/qa-final/");
  console.log("Omitted formats (not derived from raster sheet): SVG, PDF, ICO, ZIP.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
