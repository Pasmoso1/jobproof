import { Resend } from "resend";
import type { BillingPlanTier } from "@/lib/stripe";
import { betaPlanTierLabel } from "@/lib/beta-tester";
import { resolveAppUrl } from "@/lib/stripe";

export type TrialEmailRef = {
  profileId: string;
  userEmail?: string | null;
  planTier?: BillingPlanTier | null;
  trialEndsAt?: string | null;
  daysRemaining?: number | null;
};

function fromAddress(): string {
  return process.env.RESEND_FROM?.trim() || "Job Proof <hello@jobproof.ca>";
}

async function sendSimpleEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.warn("[trial-emails] RESEND_API_KEY missing — skipped:", input.subject);
    return { ok: false, error: "Email service not configured" };
  }
  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: fromAddress(),
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
    if (error) {
      console.error("[trial-emails]", error);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Email send failed";
    console.error("[trial-emails]", msg);
    return { ok: false, error: msg };
  }
}

function appLinks() {
  const base = resolveAppUrl();
  return {
    dashboard: `${base}/dashboard`,
    billing: `${base}/settings/billing`,
    onboarding: `${base}/onboarding/business-profile`,
  };
}

export async function sendTrialWelcomeEmail(ref: TrialEmailRef): Promise<void> {
  const to = String(ref.userEmail ?? "").trim();
  if (!to) return;
  const links = appLinks();
  const plan = betaPlanTierLabel(ref.planTier ?? null);
  const subject = "Welcome to JobProof";
  const text = [
    "Welcome to JobProof.",
    "",
    "Your account is ready. Finish setup to start your 14-day free trial.",
    plan !== "—" ? `You selected the ${plan} plan.` : "",
    "No credit card is required.",
    "",
    `Continue setup: ${links.onboarding}`,
  ]
    .filter(Boolean)
    .join("\n");
  const html = `
    <p>Welcome to JobProof.</p>
    <p>Your account is ready. Finish setup to start your <strong>14-day free trial</strong>.</p>
    ${plan !== "—" ? `<p>You selected the <strong>${plan}</strong> plan.</p>` : ""}
    <p>No credit card is required.</p>
    <p><a href="${links.onboarding}">Continue setup</a></p>
  `;
  await sendSimpleEmail({ to, subject, html, text });
}

export async function sendTrialStartedEmail(ref: TrialEmailRef): Promise<void> {
  const to = String(ref.userEmail ?? "").trim();
  if (!to) return;
  const links = appLinks();
  const plan = betaPlanTierLabel(ref.planTier ?? null);
  const subject = "Your 14-day free trial has started";
  const text = [
    "Your 14-day free trial has started.",
    plan !== "—" ? `You're evaluating the ${plan} plan.` : "",
    "You have full access for 14 days. No credit card required.",
    "",
    `Open JobProof: ${links.dashboard}`,
  ]
    .filter(Boolean)
    .join("\n");
  const html = `
    <p><strong>Your 14-day free trial has started.</strong></p>
    ${plan !== "—" ? `<p>You're evaluating the <strong>${plan}</strong> plan.</p>` : ""}
    <p>You have full access for 14 days. No credit card required.</p>
    <p><a href="${links.dashboard}">Open JobProof</a></p>
  `;
  await sendSimpleEmail({ to, subject, html, text });
}

export async function sendTrialDay3Email(ref: TrialEmailRef): Promise<void> {
  const to = String(ref.userEmail ?? "").trim();
  if (!to) return;
  const links = appLinks();
  const subject = "How’s your JobProof trial going?";
  const text = [
    "Just checking in.",
    "If you have questions about quotes, site visits, or proposals, reply to this email — we're happy to help.",
    "",
    `Open JobProof: ${links.dashboard}`,
  ].join("\n");
  const html = `
    <p>Just checking in.</p>
    <p>If you have questions about quotes, site visits, or proposals, reply to this email — we're happy to help.</p>
    <p><a href="${links.dashboard}">Open JobProof</a></p>
  `;
  await sendSimpleEmail({ to, subject, html, text });
}

export async function sendTrialDay7Email(ref: TrialEmailRef): Promise<void> {
  const to = String(ref.userEmail ?? "").trim();
  if (!to) return;
  const links = appLinks();
  const subject = "One week left in your JobProof trial";
  const text = [
    "You still have about a week left to explore JobProof.",
    "Try sending a proposal or walking through a quote request if you haven't yet.",
    "",
    `Open JobProof: ${links.dashboard}`,
  ].join("\n");
  const html = `
    <p>You still have about a week left to explore JobProof.</p>
    <p>Try sending a proposal or walking through a quote request if you haven't yet.</p>
    <p><a href="${links.dashboard}">Open JobProof</a></p>
  `;
  await sendSimpleEmail({ to, subject, html, text });
}

export async function sendTrialDay12Email(ref: TrialEmailRef): Promise<void> {
  const to = String(ref.userEmail ?? "").trim();
  if (!to) return;
  const links = appLinks();
  const subject = "Your JobProof trial ends in two days";
  const text = [
    "Your free trial ends in about two days.",
    "After it ends, you can still sign in and view everything you've saved. Creating new work will pause until you subscribe.",
    "",
    `Subscribe when you're ready: ${links.billing}`,
  ].join("\n");
  const html = `
    <p>Your free trial ends in about <strong>two days</strong>.</p>
    <p>After it ends, you can still sign in and view everything you've saved. Creating new work will pause until you subscribe.</p>
    <p><a href="${links.billing}">Subscribe when you're ready</a></p>
  `;
  await sendSimpleEmail({ to, subject, html, text });
}

export async function sendTrialEndedEmail(ref: TrialEmailRef): Promise<void> {
  const to = String(ref.userEmail ?? "").trim();
  if (!to) return;
  const links = appLinks();
  const subject = "Your JobProof trial has ended";
  const text = [
    "Your free trial has ended.",
    "All of your information is still here — customers, quotes, notes, and history.",
    "Subscribe anytime to keep creating new work.",
    "",
    `Subscribe now: ${links.billing}`,
  ].join("\n");
  const html = `
    <p><strong>Your free trial has ended.</strong></p>
    <p>All of your information is still here — customers, quotes, notes, and history.</p>
    <p>Subscribe anytime to keep creating new work.</p>
    <p><a href="${links.billing}">Subscribe now</a></p>
  `;
  await sendSimpleEmail({ to, subject, html, text });
}
