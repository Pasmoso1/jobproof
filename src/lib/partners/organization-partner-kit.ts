/**
 * Organization Partner Kit — personalized downloadable resources for approved
 * Organization Partners. Content is generated with referral URL, code, and QR.
 */

import { ORGANIZATION_REWARD_CAD } from "@/lib/partners/constants";

export type OrganizationKitContext = {
  organizationName: string;
  referralUrl: string;
  referralCode: string;
  qrImageUrl: string;
  origin: string;
};

export type OrganizationKitMime =
  | "text/html"
  | "text/plain"
  | "image/svg+xml";

export type OrganizationKitItem = {
  id: string;
  name: string;
  description: string;
  recommendedUse: string;
  mime: OrganizationKitMime;
  fileName: string;
  previewLabel: string;
  build: (ctx: OrganizationKitContext) => string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeXml(value: string): string {
  return escapeHtml(value).replace(/'/g, "&apos;");
}

function shellHtml(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light; }
    body { font-family: system-ui, -apple-system, Segoe UI, sans-serif; margin: 0; color: #18181b; background: #fff; line-height: 1.55; }
    .wrap { max-width: 720px; margin: 0 auto; padding: 32px 24px 48px; }
    h1 { color: #2436BB; font-size: 1.75rem; margin: 0 0 8px; }
    h2 { font-size: 1.15rem; margin: 28px 0 8px; }
    .eyebrow { text-transform: uppercase; letter-spacing: .08em; font-size: .75rem; font-weight: 700; color: #2436BB; }
    .card { border: 1px solid #e4e4e7; border-radius: 16px; padding: 20px; margin-top: 16px; background: #fafafa; }
    .cta { display: inline-block; margin-top: 12px; background: #2436BB; color: #fff !important; text-decoration: none; padding: 10px 16px; border-radius: 10px; font-weight: 600; }
    .accent { color: #F28C38; font-weight: 700; }
    .muted { color: #52525b; font-size: .95rem; }
    ul { padding-left: 1.2rem; }
    li { margin: 6px 0; }
    .qr { width: 160px; height: 160px; border: 1px solid #e4e4e7; border-radius: 12px; background: #fff; padding: 8px; }
    .footer { margin-top: 32px; font-size: .85rem; color: #71717a; border-top: 1px solid #e4e4e7; padding-top: 16px; }
    @media print { .wrap { padding: 0; } .card { break-inside: avoid; } }
  </style>
</head>
<body>
  <div class="wrap">${body}</div>
</body>
</html>`;
}

function memberBenefitsList(): string {
  return [
    "Get more jobs",
    "Receive customer quote requests",
    "Create professional quotes",
    "Manage customers",
    "Manage projects",
    "Create contracts",
    "Handle change orders",
    "Create invoices",
    "Stay organized",
    "Get paid faster",
    "Protect every job",
  ]
    .map((b) => `<li>${b}</li>`)
    .join("\n");
}

function referralBlock(ctx: OrganizationKitContext): string {
  return `<div class="card">
  <p class="eyebrow">Member signup</p>
  <p><strong>Referral link:</strong> <a href="${escapeHtml(ctx.referralUrl)}">${escapeHtml(ctx.referralUrl)}</a></p>
  <p><strong>Referral code:</strong> ${escapeHtml(ctx.referralCode)}</p>
  <p style="margin-top:16px"><img class="qr" src="${escapeHtml(ctx.qrImageUrl)}" alt="Referral QR code for ${escapeHtml(ctx.organizationName)}" /></p>
</div>`;
}

export function buildOrganizationKitContext(input: {
  organizationName: string;
  referralUrl: string;
  referralCode: string;
  origin: string;
}): OrganizationKitContext {
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=512x512&data=${encodeURIComponent(input.referralUrl)}`;
  return {
    organizationName: input.organizationName,
    referralUrl: input.referralUrl,
    referralCode: input.referralCode,
    qrImageUrl,
    origin: input.origin,
  };
}

export const ORGANIZATION_PARTNER_KIT: OrganizationKitItem[] = [
  {
    id: "member-benefit-one-pager",
    name: "Member Benefit One-Pager",
    description:
      "A printable overview of JobProof benefits for your members, with your referral link and QR code.",
    recommendedUse: "Member packets, website downloads, conference handouts",
    mime: "text/html",
    fileName: "jobproof-member-benefit-one-pager.html",
    previewLabel: "HTML · print-ready",
    build: (ctx) =>
      shellHtml(
        "JobProof Member Benefit One-Pager",
        `<p class="eyebrow">Recommended by ${escapeHtml(ctx.organizationName)}</p>
        <h1>A stronger business tool for contractors</h1>
        <p class="muted">JobProof helps contractors win more work, stay organized, get paid faster, and protect every job.</p>
        <h2>What members can do with JobProof</h2>
        <ul>${memberBenefitsList()}</ul>
        <p>Organization Partners earn <span class="accent">$${ORGANIZATION_REWARD_CAD} CAD</span> per qualified referral after standard qualification requirements are met.</p>
        ${referralBlock(ctx)}
        <a class="cta" href="${escapeHtml(ctx.referralUrl)}">Start free with JobProof</a>
        <p class="footer">Powered by JobProof · ${escapeHtml(ctx.origin)}</p>`
      ),
  },
  {
    id: "newsletter-article",
    name: "Newsletter Article",
    description:
      "Ready-to-paste newsletter copy introducing JobProof as a member benefit.",
    recommendedUse: "Monthly newsletters and member digests",
    mime: "text/plain",
    fileName: "jobproof-newsletter-article.txt",
    previewLabel: "Plain text",
    build: (ctx) =>
      `Recommended Member Tool: JobProof

${ctx.organizationName} is proud to recommend JobProof — an all-in-one platform that helps contractors:

• Get more jobs
• Receive customer quote requests
• Create professional quotes
• Manage customers and projects
• Create contracts and change orders
• Create invoices and get paid faster
• Stay organized and protect every job

Members can get started here:
${ctx.referralUrl}

Referral code: ${ctx.referralCode}

Questions? Reply to this newsletter or visit JobProof for a quick demo.
`,
  },
  {
    id: "newsletter-graphic",
    name: "Newsletter Graphic",
    description:
      "SVG banner with your organization name, JobProof branding, and referral QR.",
    recommendedUse: "Email newsletters and digital member updates",
    mime: "image/svg+xml",
    fileName: "jobproof-newsletter-graphic.svg",
    previewLabel: "SVG · 1200×400",
    build: (ctx) => buildBannerSvg(ctx, 1200, 400, "Recommended for members"),
  },
  {
    id: "website-banner",
    name: "Website Banner",
    description:
      "Wide website banner with co-brand messaging and your personalized referral QR.",
    recommendedUse: "Member benefit pages and partner resource hubs",
    mime: "image/svg+xml",
    fileName: "jobproof-organization-website-banner.svg",
    previewLabel: "SVG · 1600×500",
    build: (ctx) => buildBannerSvg(ctx, 1600, 500, "Member business tool"),
  },
  {
    id: "member-email-html",
    name: "Member Email (HTML)",
    description:
      "HTML email introducing JobProof with your referral link and QR code embedded.",
    recommendedUse: "Member announcements and drip campaigns",
    mime: "text/html",
    fileName: "jobproof-member-email.html",
    previewLabel: "HTML email",
    build: (ctx) =>
      shellHtml(
        "JobProof for Members",
        `<p class="eyebrow">${escapeHtml(ctx.organizationName)}</p>
        <h1>A recommended tool for growing contractor businesses</h1>
        <p>We recommend JobProof to help members get more jobs, create professional quotes, manage projects, handle contracts and change orders, invoice with confidence, and get paid faster — while protecting every job.</p>
        <ul>${memberBenefitsList()}</ul>
        ${referralBlock(ctx)}
        <a class="cta" href="${escapeHtml(ctx.referralUrl)}">Explore JobProof</a>
        <p class="footer">Recommended by ${escapeHtml(ctx.organizationName)} · Powered by JobProof</p>`
      ),
  },
  {
    id: "member-email-text",
    name: "Member Email (Plain Text)",
    description: "Plain-text version of the member announcement email.",
    recommendedUse: "CRM tools that prefer plain text",
    mime: "text/plain",
    fileName: "jobproof-member-email.txt",
    previewLabel: "Plain text",
    build: (ctx) =>
      `Subject: A recommended business tool for members — JobProof

Hi,

${ctx.organizationName} recommends JobProof for contractors who want to:
- Get more jobs and receive quote requests
- Create professional quotes, contracts, and invoices
- Manage customers and projects in one place
- Handle change orders clearly
- Stay organized, get paid faster, and protect every job

Get started: ${ctx.referralUrl}
Referral code: ${ctx.referralCode}

Recommended by ${ctx.organizationName}
Powered by JobProof
`,
  },
  {
    id: "welcome-package-insert",
    name: "Welcome Package Insert",
    description:
      "One-page insert for new-member welcome kits with signup QR and benefits.",
    recommendedUse: "New member onboarding packages",
    mime: "text/html",
    fileName: "jobproof-welcome-package-insert.html",
    previewLabel: "HTML · print-ready",
    build: (ctx) =>
      shellHtml(
        "Welcome Package Insert",
        `<p class="eyebrow">Welcome to ${escapeHtml(ctx.organizationName)}</p>
        <h1>Start stronger with JobProof</h1>
        <p>As a member benefit, we recommend JobProof — the contractor platform for quotes, customers, projects, contracts, change orders, invoices, and job protection.</p>
        <ul>${memberBenefitsList()}</ul>
        ${referralBlock(ctx)}
        <a class="cta" href="${escapeHtml(ctx.referralUrl)}">Claim your member start</a>`
      ),
  },
  {
    id: "conference-flyer",
    name: "Conference Flyer",
    description:
      "Conference handout with member benefits and your organization referral QR.",
    recommendedUse: "Annual conferences and networking events",
    mime: "image/svg+xml",
    fileName: "jobproof-conference-flyer.svg",
    previewLabel: "SVG · letter",
    build: (ctx) => buildPrintSvg(ctx, 816, 1056, "Conference flyer"),
  },
  {
    id: "conference-poster",
    name: "Conference Poster",
    description:
      "Large-format poster graphic for booths and member lounge displays.",
    recommendedUse: "Conference booths and association offices",
    mime: "image/svg+xml",
    fileName: "jobproof-conference-poster.svg",
    previewLabel: "SVG · poster",
    build: (ctx) => buildPrintSvg(ctx, 900, 1200, "Conference poster"),
  },
  {
    id: "trade-show-qr-sign",
    name: "Trade Show QR Sign",
    description:
      "Bold QR sign for booths and registration desks — members scan to sign up.",
    recommendedUse: "Trade shows and expo booths",
    mime: "image/svg+xml",
    fileName: "jobproof-trade-show-qr-sign.svg",
    previewLabel: "SVG · QR sign",
    build: (ctx) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080" role="img" aria-label="Trade show QR sign">
  <rect width="1080" height="1080" fill="#ffffff"/>
  <rect x="0" y="0" width="1080" height="18" fill="#2436BB"/>
  <rect x="0" y="18" width="1080" height="8" fill="#F28C38"/>
  <text x="540" y="120" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="28" font-weight="700" fill="#2436BB">RECOMMENDED BY</text>
  <text x="540" y="175" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="42" font-weight="700" fill="#18181b">${escapeXml(truncate(ctx.organizationName, 36))}</text>
  <text x="540" y="250" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="36" font-weight="700" fill="#2436BB">Scan to try JobProof</text>
  <image href="${escapeXml(ctx.qrImageUrl)}" x="290" y="300" width="500" height="500"/>
  <text x="540" y="860" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="26" fill="#52525b">Code: ${escapeXml(ctx.referralCode)}</text>
  <text x="540" y="920" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="22" fill="#71717a">${escapeXml(truncate(ctx.referralUrl, 48))}</text>
  <text x="540" y="1000" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="24" font-weight="600" fill="#2436BB">Powered by JobProof</text>
</svg>`,
  },
  {
    id: "presentation-slides",
    name: "Presentation Slides",
    description:
      "Slide outline HTML you can present or copy into PowerPoint / Google Slides.",
    recommendedUse: "Member webinars and board presentations",
    mime: "text/html",
    fileName: "jobproof-presentation-slides.html",
    previewLabel: "HTML slides outline",
    build: (ctx) =>
      shellHtml(
        "JobProof Presentation Outline",
        `<p class="eyebrow">${escapeHtml(ctx.organizationName)} × JobProof</p>
        <h1>Presentation outline</h1>
        <div class="card"><h2>Slide 1 — Title</h2><p>A stronger member benefit for contractors<br/>Recommended by ${escapeHtml(ctx.organizationName)} · Powered by JobProof</p></div>
        <div class="card"><h2>Slide 2 — The challenge</h2><p>Contractors lose time and money to messy quotes, unclear approvals, and scattered job records.</p></div>
        <div class="card"><h2>Slide 3 — What JobProof helps members do</h2><ul>${memberBenefitsList()}</ul></div>
        <div class="card"><h2>Slide 4 — How members get started</h2>${referralBlock(ctx)}</div>
        <div class="card"><h2>Slide 5 — Call to action</h2><p>Scan the QR or visit ${escapeHtml(ctx.referralUrl)}</p></div>`
      ),
  },
  {
    id: "frequently-asked-questions",
    name: "Frequently Asked Questions",
    description:
      "Member-facing FAQ covering JobProof benefits and how to sign up with your link.",
    recommendedUse: "Resource libraries and support emails",
    mime: "text/html",
    fileName: "jobproof-organization-faqs.html",
    previewLabel: "HTML",
    build: (ctx) =>
      shellHtml(
        "JobProof FAQs for Members",
        `<h1>Frequently asked questions</h1>
        <div class="card"><h2>What is JobProof?</h2><p>JobProof is an all-in-one contractor platform for quote requests, professional quotes, customers, projects, contracts, change orders, invoices, organization, faster payments, and job protection.</p></div>
        <div class="card"><h2>Why is ${escapeHtml(ctx.organizationName)} recommending it?</h2><p>It helps members operate more professionally and grow — a practical benefit beyond networking alone.</p></div>
        <div class="card"><h2>How do I sign up?</h2><p>Use this link: <a href="${escapeHtml(ctx.referralUrl)}">${escapeHtml(ctx.referralUrl)}</a><br/>Or enter code <strong>${escapeHtml(ctx.referralCode)}</strong>.</p>
        <p><img class="qr" src="${escapeHtml(ctx.qrImageUrl)}" alt="Signup QR" /></p></div>
        <div class="card"><h2>Is protection the only benefit?</h2><p>No. Protection is one benefit among many — winning jobs, quoting, managing work, and getting paid remain core.</p></div>`
      ),
  },
  {
    id: "partner-overview-pdf",
    name: "Partner Overview PDF",
    description:
      "Printable HTML overview of the Organization Partner Program (print to PDF from your browser).",
    recommendedUse: "Internal stakeholder reviews and board packages",
    mime: "text/html",
    fileName: "jobproof-organization-partner-overview.html",
    previewLabel: "HTML · print to PDF",
    build: (ctx) =>
      shellHtml(
        "Organization Partner Overview",
        `<p class="eyebrow">Organization Partner Program</p>
        <h1>Partner overview</h1>
        <p>${escapeHtml(ctx.organizationName)} is set up as a JobProof Organization Partner.</p>
        <h2>Reward</h2>
        <p>Earn <span class="accent">$${ORGANIZATION_REWARD_CAD} CAD</span> per qualified referral after existing qualification requirements are met. Payout timing and attribution follow the standard Partner Program.</p>
        <h2>Your tracking assets</h2>
        ${referralBlock(ctx)}
        <h2>Marketing support</h2>
        <ul>
          <li>Organization Partner Kit in the Media Centre</li>
          <li>Marketing Studio with co-branded campaign presets</li>
          <li>Organization Dashboard for referrals and resources</li>
        </ul>
        <p class="footer">JobProof brand remains dominant on all co-branded materials.</p>`
      ),
  },
];

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

function buildBannerSvg(
  ctx: OrganizationKitContext,
  width: number,
  height: number,
  kicker: string
): string {
  const name = truncate(ctx.organizationName, 40);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(kicker)}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f8fafc"/>
      <stop offset="100%" stop-color="#eef2ff"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  <rect x="0" y="0" width="${width}" height="10" fill="#2436BB"/>
  <rect x="0" y="10" width="${width}" height="6" fill="#F28C38"/>
  <text x="48" y="80" font-family="Segoe UI, Arial, sans-serif" font-size="22" font-weight="700" fill="#2436BB">${escapeXml(kicker.toUpperCase())}</text>
  <text x="48" y="140" font-family="Segoe UI, Arial, sans-serif" font-size="40" font-weight="700" fill="#18181b">Recommended by ${escapeXml(name)}</text>
  <text x="48" y="200" font-family="Segoe UI, Arial, sans-serif" font-size="28" font-weight="600" fill="#2436BB">JobProof for contractors</text>
  <text x="48" y="250" font-family="Segoe UI, Arial, sans-serif" font-size="20" fill="#52525b">Get more jobs · Quote professionally · Get paid faster · Protect every job</text>
  <text x="48" y="${height - 60}" font-family="Segoe UI, Arial, sans-serif" font-size="18" fill="#71717a">${escapeXml(truncate(ctx.referralUrl, 56))}</text>
  <text x="48" y="${height - 28}" font-family="Segoe UI, Arial, sans-serif" font-size="16" fill="#2436BB">Code ${escapeXml(ctx.referralCode)} · Powered by JobProof</text>
  <image href="${escapeXml(ctx.qrImageUrl)}" x="${width - 220}" y="${Math.max(70, height / 2 - 90)}" width="170" height="170"/>
</svg>`;
}

function buildPrintSvg(
  ctx: OrganizationKitContext,
  width: number,
  height: number,
  label: string
): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(label)}">
  <rect width="${width}" height="${height}" fill="#ffffff"/>
  <rect x="0" y="0" width="${width}" height="16" fill="#2436BB"/>
  <rect x="0" y="16" width="${width}" height="8" fill="#F28C38"/>
  <text x="48" y="90" font-family="Segoe UI, Arial, sans-serif" font-size="20" font-weight="700" fill="#2436BB">RECOMMENDED BY</text>
  <text x="48" y="140" font-family="Segoe UI, Arial, sans-serif" font-size="36" font-weight="700" fill="#18181b">${escapeXml(truncate(ctx.organizationName, 32))}</text>
  <text x="48" y="210" font-family="Segoe UI, Arial, sans-serif" font-size="42" font-weight="700" fill="#2436BB">JobProof</text>
  <text x="48" y="260" font-family="Segoe UI, Arial, sans-serif" font-size="22" fill="#52525b">Win more work. Stay organized. Get paid. Protect every job.</text>
  <text x="48" y="330" font-family="Segoe UI, Arial, sans-serif" font-size="20" font-weight="600" fill="#18181b">Members can:</text>
  <text x="48" y="370" font-family="Segoe UI, Arial, sans-serif" font-size="18" fill="#3f3f46">• Get more jobs &amp; quote requests</text>
  <text x="48" y="400" font-family="Segoe UI, Arial, sans-serif" font-size="18" fill="#3f3f46">• Create quotes, contracts &amp; invoices</text>
  <text x="48" y="430" font-family="Segoe UI, Arial, sans-serif" font-size="18" fill="#3f3f46">• Manage customers &amp; projects</text>
  <text x="48" y="460" font-family="Segoe UI, Arial, sans-serif" font-size="18" fill="#3f3f46">• Handle change orders &amp; get paid faster</text>
  <image href="${escapeXml(ctx.qrImageUrl)}" x="${width / 2 - 140}" y="${height - 420}" width="280" height="280"/>
  <text x="${width / 2}" y="${height - 110}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="18" fill="#52525b">${escapeXml(ctx.referralUrl)}</text>
  <text x="${width / 2}" y="${height - 70}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="700" fill="#2436BB">Code ${escapeXml(ctx.referralCode)}</text>
  <text x="${width / 2}" y="${height - 30}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="16" fill="#71717a">Powered by JobProof</text>
</svg>`;
}
