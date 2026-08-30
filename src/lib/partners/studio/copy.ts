import {
  STUDIO_TAGLINE,
  studioOptionLabel,
  STUDIO_AUDIENCES,
  STUDIO_THEMES,
  type StudioAudienceId,
  type StudioCopyVariantId,
  type StudioThemeId,
} from "@/lib/partners/studio/catalog";

export type GeneratedCopy = {
  caption: string;
  postBody: string;
  emailSubject: string;
  emailHtml: string;
  emailText: string;
  headline: string;
};

type CopyContext = {
  theme: StudioThemeId;
  audience: StudioAudienceId;
  organizationName: string;
  referralUrl: string;
  isFounding: boolean;
  variant: StudioCopyVariantId;
};

const THEME_CORE: Record<
  StudioThemeId,
  { headline: string; bullets: string[]; focus: string }
> = {
  getting_more_jobs: {
    headline: "Win more work. Grow your contracting business.",
    bullets: [
      "Make it easier for customers to request a quote",
      "Respond quickly and professionally",
      "Help turn more opportunities into paying jobs",
    ],
    focus:
      "JobProof is designed to help contractors turn more opportunities into paying jobs — from the first inquiry through follow-up.",
  },
  professional_quotes: {
    headline: "Help turn quote requests into paying jobs.",
    bullets: [
      "Present clear, professional quotes",
      "Customers can review and approve online",
      "Less confusion on scope and price",
    ],
    focus:
      "A professional quoting process helps contractors move from interest to agreement with less back-and-forth.",
  },
  customer_quote_requests: {
    headline: "Make it easier for customers to hire you.",
    bullets: [
      "Give customers a simple way to request a quote",
      "Respond to opportunities quickly",
      "Keep inbound requests in one place",
    ],
    focus:
      "JobProof gives customers an easier way to request a quote — and gives contractors a clearer path to respond.",
  },
  contracts: {
    headline: "Turn interest into a clear signed agreement.",
    bullets: [
      "Put the agreement in writing",
      "Collect customer approvals",
      "Start work with clearer expectations",
    ],
    focus:
      "Once a customer is ready to move forward, JobProof helps turn the agreement into a clear signed contract.",
  },
  change_orders: {
    headline: "Get paid for the extra work you do.",
    bullets: [
      "Document scope changes",
      "Get customer approval before billing",
      "Protect revenue when the job expands",
    ],
    focus:
      "When the scope changes, JobProof helps contractors document and approve additional work so they have a better chance of getting paid for it.",
  },
  invoicing: {
    headline: "Invoice for completed work with clarity.",
    bullets: [
      "Accurate invoices tied to the job",
      "Clearer customer payment experience",
      "Less chasing and confusion",
    ],
    focus:
      "JobProof helps contractors create professional invoices connected to the work they completed — so they can get paid.",
  },
  getting_paid_faster: {
    headline: "Get paid for the work you do.",
    bullets: [
      "Clear approvals before billing",
      "Invoices connected to the job",
      "A cleaner path from work done to payment",
    ],
    focus:
      "From approved changes to professional invoices, JobProof helps contractors manage the path from completed work to payment.",
  },
  project_documentation: {
    headline: "Protect the revenue you've earned.",
    bullets: [
      "Keep photos and files with the job",
      "Preserve proof of work completed",
      "Support payment if disagreements arise",
    ],
    focus:
      "Clear job records help contractors protect the revenue they've earned when questions or disputes come up.",
  },
  job_organization: {
    headline: "Grow your business with better tools.",
    bullets: [
      "Manage customers and jobs in one place",
      "Keep the path from inquiry to payment together",
      "Spend less time hunting for details",
    ],
    focus:
      "JobProof gives contractors tools to help grow their business — from quote request through payment — in one platform.",
  },
  protect_every_job: {
    headline: "Protect every job. Get paid. Stay protected.",
    bullets: [
      "Quotes, contracts, and change orders",
      "Photos and documentation",
      "Records that support the work you completed",
    ],
    focus:
      "JobProof helps contractors protect the work and revenue they've earned with clear approvals and project records.",
  },
  everything_jobproof: {
    headline: "From quote request to payment.",
    bullets: [
      "Win more work",
      "Capture quote requests",
      "Create professional quotes",
      "Sign agreements",
      "Manage change orders",
      "Invoice customers",
      "Get paid",
      "Protect the revenue you've earned",
    ],
    focus:
      "JobProof is a business tool designed to help contractors win more work, make more money, get paid, and protect the work they've earned.",
  },
};

function audiencePhrase(audience: StudioAudienceId): string {
  const label = studioOptionLabel(STUDIO_AUDIENCES, audience).toLowerCase();
  return `Built for ${label}`;
}

function partnerLine(ctx: CopyContext): string {
  const badge = ctx.isFounding ? " · Founding Partner" : "";
  return `Recommended by ${ctx.organizationName}${badge}`;
}

function applyVariant(base: string, variant: StudioCopyVariantId): string {
  switch (variant) {
    case "short": {
      const lines = base.split("\n").filter((l) => l.trim().length > 0);
      const keep = lines.slice(0, 2);
      const linkLine = lines.find((l) => /https?:\/\//.test(l) || /Learn more:|Start here:/.test(l));
      if (linkLine && !keep.includes(linkLine)) keep.push(linkLine);
      return keep.join("\n").trim();
    }
    case "friendly":
      return base.replace(/JobProof helps/g, "JobProof makes it easier for").replace(
        /contractors/g,
        "contractors like you"
      );
    case "educational":
      return `${base}\n\nWhy it matters: better tools and workflows can help contractors win more work, get paid, and protect the revenue they've earned.`;
    case "detailed":
      return `${base}\n\n${STUDIO_TAGLINE}\n\nUse one platform for quote requests, professional quotes, contracts, change orders, invoices, documentation, and payment follow-up — designed to help contractors grow their business.`;
    case "professional":
    default:
      return base;
  }
}

export function generateStudioCopy(ctx: CopyContext): GeneratedCopy {
  const theme = THEME_CORE[ctx.theme];
  const themeLabel = studioOptionLabel(STUDIO_THEMES, ctx.theme);
  const bullets = theme.bullets.map((b) => `• ${b}`).join("\n");

  const captionBase = [
    theme.headline,
    "",
    theme.focus,
    "",
    audiencePhrase(ctx.audience),
    partnerLine(ctx),
    "",
    `Learn more: ${ctx.referralUrl}`,
  ].join("\n");

  const postBase = [
    `${themeLabel}`,
    "",
    theme.headline,
    "",
    bullets,
    "",
    theme.focus,
    "",
    partnerLine(ctx),
    `Start here: ${ctx.referralUrl}`,
  ].join("\n");

  const everythingExtra =
    ctx.theme === "everything_jobproof"
      ? `\nFrom the first customer inquiry to the final payment, JobProof helps contractors:\n${bullets}\n`
      : "";

  const emailTextBase = [
    `Hi,`,
    ``,
    `I wanted to share JobProof with you.`,
    ``,
    theme.headline,
    everythingExtra.trim(),
    theme.focus,
    ``,
    audiencePhrase(ctx.audience),
    partnerLine(ctx),
    ``,
    `Explore JobProof: ${ctx.referralUrl}`,
    ``,
    STUDIO_TAGLINE,
  ]
    .filter(Boolean)
    .join("\n");

  const emailHtml = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><title>${themeLabel}</title></head>
<body style="font-family:Arial,Helvetica,sans-serif;color:#18181b;line-height:1.6;padding:24px;">
  <p>Hi,</p>
  <p>I wanted to share <strong>JobProof</strong> with you.</p>
  <p style="font-size:18px;font-weight:700;color:#1A2558;">${theme.headline}</p>
  <p>${theme.focus}</p>
  <ul>${theme.bullets.map((b) => `<li>${b}</li>`).join("")}</ul>
  <p>${audiencePhrase(ctx.audience)}<br/>${partnerLine(ctx)}</p>
  <p><a href="${ctx.referralUrl}" style="display:inline-block;background:#F28C38;color:#fff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:8px;">Explore JobProof</a></p>
  <p style="color:#71717a;font-size:13px;">${STUDIO_TAGLINE}</p>
</body>
</html>`;

  const subjectOptions = [
    `${themeLabel}: ${STUDIO_TAGLINE}`,
    `A better way for contractors to ${themeLabel.toLowerCase()}`,
    `Recommended by ${ctx.organizationName}: JobProof`,
  ];

  return {
    headline: theme.headline,
    caption: applyVariant(captionBase, ctx.variant),
    postBody: applyVariant(postBase + everythingExtra, ctx.variant),
    emailSubject: subjectOptions[0]!,
    emailHtml,
    emailText: applyVariant(emailTextBase, ctx.variant),
  };
}
