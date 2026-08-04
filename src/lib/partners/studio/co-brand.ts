/**
 * Co-branded Marketing Studio graphics (SVG) for Organization Partners.
 * JobProof brand remains dominant; organization logo/name appear as recommendation.
 */

export type CoBrandLayout = "logo_stack" | "recommended_by";

function buildQrImageUrl(referralUrl: string, size = 280): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(referralUrl)}`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

export function buildCoBrandSvg(input: {
  organizationName: string;
  referralUrl: string;
  organizationLogoUrl?: string | null;
  jobproofLogoUrl?: string;
  layout?: CoBrandLayout;
  width?: number;
  height?: number;
  headline?: string;
}): string {
  const width = input.width ?? 1200;
  const height = input.height ?? 628;
  const layout = input.layout ?? "recommended_by";
  const qr = buildQrImageUrl(input.referralUrl, 280);
  const jobproofLogo =
    input.jobproofLogoUrl ?? "/media-kit/logos/jobproof-primary-horizontal.png";
  const orgName = truncate(input.organizationName, 42);
  const headline =
    input.headline ?? "Win more work. Stay organized. Get paid. Protect every job.";

  const orgLogoBlock = input.organizationLogoUrl
    ? `<image href="${escapeXml(input.organizationLogoUrl)}" x="64" y="72" width="220" height="72" preserveAspectRatio="xMidYMid meet"/>`
    : `<text x="64" y="110" font-family="Segoe UI, Arial, sans-serif" font-size="28" font-weight="700" fill="#18181b">${escapeXml(orgName)}</text>`;

  if (layout === "logo_stack") {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Co-branded JobProof campaign">
  <rect width="${width}" height="${height}" fill="#ffffff"/>
  <rect x="0" y="0" width="${width}" height="12" fill="#2436BB"/>
  <rect x="0" y="12" width="${width}" height="6" fill="#F28C38"/>
  ${orgLogoBlock}
  <text x="64" y="200" font-family="Segoe UI, Arial, sans-serif" font-size="22" font-weight="700" fill="#2436BB">RECOMMENDED BUSINESS TOOL</text>
  <image href="${escapeXml(jobproofLogo)}" x="64" y="230" width="320" height="96" preserveAspectRatio="xMidYMid meet"/>
  <text x="64" y="380" font-family="Segoe UI, Arial, sans-serif" font-size="32" font-weight="700" fill="#18181b">${escapeXml(truncate(headline, 64))}</text>
  <text x="64" y="430" font-family="Segoe UI, Arial, sans-serif" font-size="20" fill="#52525b">${escapeXml(truncate(input.referralUrl, 58))}</text>
  <image href="${escapeXml(qr)}" x="${width - 300}" y="${height - 320}" width="220" height="220"/>
  <text x="${width - 190}" y="${height - 60}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="16" fill="#71717a">Scan to start</text>
</svg>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Recommended by organization co-brand">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f8fafc"/>
      <stop offset="100%" stop-color="#eef2ff"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#g)"/>
  <rect x="0" y="0" width="${width}" height="12" fill="#2436BB"/>
  <rect x="0" y="12" width="${width}" height="6" fill="#F28C38"/>
  <text x="64" y="90" font-family="Segoe UI, Arial, sans-serif" font-size="20" font-weight="700" fill="#2436BB">RECOMMENDED BY</text>
  ${
    input.organizationLogoUrl
      ? `<image href="${escapeXml(input.organizationLogoUrl)}" x="64" y="110" width="240" height="80" preserveAspectRatio="xMidYMid meet"/>`
      : `<text x="64" y="150" font-family="Segoe UI, Arial, sans-serif" font-size="34" font-weight="700" fill="#18181b">${escapeXml(orgName)}</text>`
  }
  <image href="${escapeXml(jobproofLogo)}" x="64" y="230" width="360" height="110" preserveAspectRatio="xMidYMid meet"/>
  <text x="64" y="390" font-family="Segoe UI, Arial, sans-serif" font-size="30" font-weight="700" fill="#18181b">${escapeXml(truncate(headline, 60))}</text>
  <text x="64" y="440" font-family="Segoe UI, Arial, sans-serif" font-size="20" fill="#52525b">Powered by JobProof</text>
  <text x="64" y="490" font-family="Segoe UI, Arial, sans-serif" font-size="18" fill="#71717a">${escapeXml(truncate(input.referralUrl, 58))}</text>
  <image href="${escapeXml(qr)}" x="${width - 300}" y="${height - 320}" width="220" height="220"/>
</svg>`;
}

/** Data-URL wrapper so drafts can preview without a separate API round-trip. */
export function buildCoBrandDataUrl(input: Parameters<typeof buildCoBrandSvg>[0]): string {
  const svg = buildCoBrandSvg(input);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
