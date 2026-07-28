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
    headline: "Win more work with professional quotes and fast follow-up.",
    bullets: [
      "Respond to quote requests quickly",
      "Present professional estimates",
      "Convert more leads into paying customers",
    ],
    focus:
      "JobProof helps contractors convert more leads into paying customers with clearer quoting and follow-up.",
  },
  professional_quotes: {
    headline: "Create professional quotes in minutes.",
    bullets: [
      "Customers approve online",
      "No paperwork scramble",
      "Less confusion on scope and price",
    ],
    focus:
      "Create professional quotes customers can review and approve without the usual back-and-forth.",
  },
  customer_quote_requests: {
    headline: "Capture customer quote requests in one place.",
    bullets: [
      "Inbound requests stay organized",
      "Respond faster with clearer details",
      "Start every job on the right foot",
    ],
    focus:
      "JobProof helps contractors receive and manage customer quote requests without losing details in texts and emails.",
  },
  contracts: {
    headline: "Professional contracts. Clear approvals.",
    bullets: [
      "Put agreements in writing",
      "Collect customer approvals",
      "Reduce misunderstandings before work starts",
    ],
    focus:
      "JobProof helps contractors create professional contracts and secure clear customer approvals.",
  },
  change_orders: {
    headline: "Track every change before it becomes a dispute.",
    bullets: [
      "Document scope changes",
      "Get customer approval",
      "Keep the job financially clear",
    ],
    focus:
      "Change orders in JobProof help contractors stay aligned when the work changes.",
  },
  invoicing: {
    headline: "Invoice professionally. Get paid with confidence.",
    bullets: [
      "Accurate invoices tied to the job",
      "Clearer customer payment experience",
      "Less chasing and confusion",
    ],
    focus:
      "JobProof helps contractors create professional invoices connected to the work they completed.",
  },
  getting_paid_faster: {
    headline: "Track every change. Invoice professionally. Reduce payment delays.",
    bullets: [
      "Clear approvals before billing",
      "Organized job records",
      "Faster, cleaner payment follow-up",
    ],
    focus:
      "Stay organized and reduce payment delays with quotes, approvals, change orders, and invoices in one place.",
  },
  project_documentation: {
    headline: "Document the work with photos, files, and clear records.",
    bullets: [
      "Upload photos and files",
      "Keep project details connected",
      "Protect every job with better records",
    ],
    focus:
      "Project documentation in JobProof helps contractors preserve the proof of work alongside the rest of the job.",
  },
  job_organization: {
    headline: "Customers, jobs, files, and follow-up—organized.",
    bullets: [
      "Manage customers and jobs",
      "Keep documents together",
      "Spend less time searching for details",
    ],
    focus:
      "JobProof helps contractors stay organized from the first inquiry through final payment.",
  },
  protect_every_job: {
    headline: "Protect every job with approvals and clear records.",
    bullets: [
      "Quotes, contracts, and change orders",
      "Photos and documentation",
      "Records that support the work you completed",
    ],
    focus:
      "JobProof helps contractors protect every job with organized approvals, documentation, and project records.",
  },
  everything_jobproof: {
    headline: STUDIO_TAGLINE,
    bullets: [
      "Get more jobs",
      "Create quotes",
      "Manage customers",
      "Track projects",
      "Collect approvals",
      "Create contracts",
      "Manage change orders",
      "Invoice customers",
      "Document work",
      "Protect every job",
    ],
    focus:
      "From the first customer inquiry to the final payment, JobProof helps contractors run a more professional business.",
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
      return `${base}\n\nWhy it matters: clearer systems help contractors win more work, stay organized, get paid, and protect every job.`;
    case "detailed":
      return `${base}\n\n${STUDIO_TAGLINE}\n\nUse one platform for quote requests, professional quotes, customers, jobs, contracts, change orders, documentation, invoices, and payment follow-up.`;
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
