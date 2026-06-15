import { resolveAppUrl } from "@/lib/stripe";

export type StripeKeyMode = "live" | "test" | "missing" | "invalid";

const STRIPE_ENV_VARS = {
  secret: "STRIPE_SECRET_KEY",
  publishable: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  webhook: "STRIPE_WEBHOOK_SECRET",
  priceEssentialFounder: "STRIPE_PRICE_ESSENTIAL_FOUNDER",
  priceProfessionalFounder: "STRIPE_PRICE_PROFESSIONAL_FOUNDER",
  priceEssentialStandard: "STRIPE_PRICE_ESSENTIAL_STANDARD",
  priceProfessionalStandard: "STRIPE_PRICE_PROFESSIONAL_STANDARD",
  appUrl: "NEXT_PUBLIC_APP_URL",
} as const;

/** Env vars referenced in docs but derived from NEXT_PUBLIC_APP_URL in code. */
export const STRIPE_CONNECT_URL_NOTE =
  "STRIPE_CONNECT_RETURN_URL and STRIPE_CONNECT_REFRESH_URL are not read by the app. Connect onboarding uses NEXT_PUBLIC_APP_URL + /settings/billing?stripe_connect=return|refresh.";

export const STRIPE_WEBHOOK_EVENTS_HANDLED = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
  "customer.subscription.trial_will_end",
  "invoice.finalized",
  "customer.card.updated (no-op via default)",
  "customer.bank_account.updated (no-op via default)",
  "account.updated",
] as const;

function trimEnv(name: string): string | null {
  const v = process.env[name]?.trim();
  return v || null;
}

export function detectStripeSecretKeyMode(key: string | null | undefined): StripeKeyMode {
  if (!key?.trim()) return "missing";
  const k = key.trim();
  if (k.startsWith("sk_live_")) return "live";
  if (k.startsWith("sk_test_")) return "test";
  return "invalid";
}

export function detectStripePublishableKeyMode(key: string | null | undefined): StripeKeyMode {
  if (!key?.trim()) return "missing";
  const k = key.trim();
  if (k.startsWith("pk_live_")) return "live";
  if (k.startsWith("pk_test_")) return "test";
  return "invalid";
}

/** Safe suffix for admin display — never returns full secrets. */
export function stripeIdSuffix(value: string | null | undefined): string | null {
  const v = value?.trim();
  if (!v) return null;
  if (v.length <= 8) return "••••";
  return `…${v.slice(-6)}`;
}

export type StripeEnvVarRow = {
  name: string;
  present: boolean;
  display: string;
};

export type StripeReadinessReport = {
  nodeEnv: string;
  secretKeyMode: StripeKeyMode;
  secretKeyPrefix: string;
  publishableKeyMode: StripeKeyMode;
  publishableKeyPrefix: string;
  inferredStripeMode: "live" | "test" | "unknown";
  keyModeConsistent: boolean;
  webhookSecretPresent: boolean;
  webhookModeNote: string;
  appUrl: string;
  appUrlSource: "env" | "fallback";
  connectReturnUrl: string;
  connectRefreshUrl: string;
  connectUrlSource: string;
  envVars: StripeEnvVarRow[];
  priceIds: Array<{
    envName: string;
    present: boolean;
    suffix: string | null;
  }>;
  allPriceIdsPresent: boolean;
  paidCheckoutReady: boolean;
  betaTesterFeatureEnabled: true;
  issues: string[];
  warnings: string[];
  webhookEndpoint: string;
  webhookEventsHandled: readonly string[];
};


export function buildStripeReadinessReport(options?: {
  betaTesterCount?: number;
}): StripeReadinessReport {
  const secretRaw = trimEnv(STRIPE_ENV_VARS.secret);
  const publishableRaw = trimEnv(STRIPE_ENV_VARS.publishable);
  const webhookRaw = trimEnv(STRIPE_ENV_VARS.webhook);

  const secretKeyMode = detectStripeSecretKeyMode(secretRaw);
  const publishableKeyMode = detectStripePublishableKeyMode(publishableRaw);

  const secretKeyPrefix =
    secretKeyMode === "live"
      ? "sk_live"
      : secretKeyMode === "test"
        ? "sk_test"
        : secretKeyMode === "missing"
          ? "missing"
          : "invalid";

  const publishableKeyPrefix =
    publishableKeyMode === "live"
      ? "pk_live"
      : publishableKeyMode === "test"
        ? "pk_test"
        : publishableKeyMode === "missing"
          ? "missing"
          : "invalid";

  const inferredStripeMode: "live" | "test" | "unknown" =
    secretKeyMode === "live" || publishableKeyMode === "live"
      ? "live"
      : secretKeyMode === "test" || publishableKeyMode === "test"
        ? "test"
        : "unknown";

  const keyModeConsistent =
    (secretKeyMode === "live" && publishableKeyMode === "live") ||
    (secretKeyMode === "test" && publishableKeyMode === "test") ||
    secretKeyMode === "missing" ||
    publishableKeyMode === "missing";

  const issues: string[] = [];
  const warnings: string[] = [];

  if (secretKeyMode === "missing") {
    issues.push("STRIPE_SECRET_KEY is missing.");
  }
  if (publishableKeyMode === "missing") {
    issues.push("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is missing.");
  }
  if (secretKeyMode === "invalid") {
    issues.push("STRIPE_SECRET_KEY has an unrecognized prefix (expected sk_live_ or sk_test_).");
  }
  if (publishableKeyMode === "invalid") {
    issues.push(
      "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY has an unrecognized prefix (expected pk_live_ or pk_test_)."
    );
  }
  if (!webhookRaw) {
    issues.push("STRIPE_WEBHOOK_SECRET is missing.");
  }

  if (secretKeyMode === "live" && publishableKeyMode === "test") {
    issues.push(
      "Stripe key mismatch: secret key is live (sk_live) but publishable key is test (pk_test). Checkout will fail."
    );
  }
  if (secretKeyMode === "test" && publishableKeyMode === "live") {
    issues.push(
      "Stripe key mismatch: secret key is test (sk_test) but publishable key is live (pk_live). Checkout will fail."
    );
  }

  if (process.env.NODE_ENV === "production" && secretKeyMode === "test") {
    issues.push("Production requires STRIPE_SECRET_KEY to start with sk_live_ (currently sk_test).");
  }

  if (process.env.NODE_ENV === "production" && publishableKeyMode === "test") {
    issues.push(
      "Production requires NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to start with pk_live_ (currently pk_test)."
    );
  }

  if (secretKeyMode !== "missing" && publishableKeyMode !== "missing" && !keyModeConsistent) {
    warnings.push("Stripe secret and publishable keys appear to be from different modes.");
  }

  const priceEnvNames = [
    STRIPE_ENV_VARS.priceEssentialFounder,
    STRIPE_ENV_VARS.priceProfessionalFounder,
    STRIPE_ENV_VARS.priceEssentialStandard,
    STRIPE_ENV_VARS.priceProfessionalStandard,
  ] as const;

  const priceIds = priceEnvNames.map((envName) => {
    const raw = trimEnv(envName);
    return {
      envName,
      present: Boolean(raw),
      suffix: stripeIdSuffix(raw),
    };
  });

  const allPriceIdsPresent = priceIds.every((p) => p.present);
  if (!allPriceIdsPresent) {
    issues.push("One or more Stripe price ID environment variables are missing.");
  }

  const appUrlFromEnv = trimEnv(STRIPE_ENV_VARS.appUrl);
  const appUrl = resolveAppUrl();
  const appUrlSource = appUrlFromEnv ? "env" : "fallback";

  if (process.env.NODE_ENV === "production" && !appUrlFromEnv) {
    warnings.push("NEXT_PUBLIC_APP_URL is not set; Connect and Checkout return URLs use localhost fallback.");
  }

  if (
    process.env.NODE_ENV === "production" &&
    appUrlFromEnv &&
    !/^https:\/\//i.test(appUrlFromEnv)
  ) {
    warnings.push("NEXT_PUBLIC_APP_URL should use HTTPS in production.");
  }

  const webhookModeNote =
    webhookRaw && secretKeyMode !== "missing"
      ? secretKeyMode === "live"
        ? "Webhook secret is configured. Use a live-mode webhook endpoint in the Stripe Dashboard for production."
        : "Webhook secret is configured. Use a test-mode webhook endpoint in the Stripe Dashboard for sandbox."
      : "Webhook mode cannot be inferred from the secret alone — it must match the Stripe Dashboard endpoint (test vs live).";

  if (webhookRaw && secretKeyMode !== "missing" && publishableKeyMode !== "missing" && !keyModeConsistent) {
    warnings.push(`${webhookModeNote} Key prefix mismatch may indicate the wrong webhook secret.`);
  }

  const envVars: StripeEnvVarRow[] = [
    {
      name: STRIPE_ENV_VARS.secret,
      present: Boolean(secretRaw),
      display: secretKeyPrefix,
    },
    {
      name: STRIPE_ENV_VARS.publishable,
      present: Boolean(publishableRaw),
      display: publishableKeyPrefix,
    },
    {
      name: STRIPE_ENV_VARS.webhook,
      present: Boolean(webhookRaw),
      display: webhookRaw ? "configured" : "missing",
    },
    {
      name: STRIPE_ENV_VARS.appUrl,
      present: Boolean(appUrlFromEnv),
      display: appUrl,
    },
  ];

  const paidCheckoutReady =
    secretKeyMode !== "missing" &&
    publishableKeyMode !== "missing" &&
    keyModeConsistent &&
    allPriceIdsPresent &&
    Boolean(webhookRaw);

  if (
    process.env.NODE_ENV === "production" &&
    appUrlFromEnv &&
    !/^https:\/\/www\.jobproof\.ca\/?$/i.test(appUrlFromEnv)
  ) {
    warnings.push(
      `NEXT_PUBLIC_APP_URL is "${appUrl}" — production should use https://www.jobproof.ca for Checkout and Connect return URLs.`
    );
  }

  const webhookBase = appUrlFromEnv?.replace(/\/$/, "") ?? "https://www.jobproof.ca";
  const expectedWebhook = "https://www.jobproof.ca/api/webhooks/stripe";
  if (
    process.env.NODE_ENV === "production" &&
    `${webhookBase}/api/webhooks/stripe` !== expectedWebhook
  ) {
    warnings.push(`Webhook URL should be ${expectedWebhook} (currently derived as ${webhookBase}/api/webhooks/stripe).`);
  }

  const betaCount = options?.betaTesterCount;
  if (typeof betaCount === "number") {
    if (betaCount > 0) {
      warnings.push(
        `${betaCount} legacy beta tester account(s) retain free access. New signups require Stripe Checkout.`
      );
    }
  }

  return {
    nodeEnv: process.env.NODE_ENV ?? "unknown",
    secretKeyMode,
    secretKeyPrefix,
    publishableKeyMode,
    publishableKeyPrefix,
    inferredStripeMode,
    keyModeConsistent,
    webhookSecretPresent: Boolean(webhookRaw),
    webhookModeNote,
    appUrl,
    appUrlSource,
    connectReturnUrl: `${appUrl}/settings/billing?stripe_connect=return`,
    connectRefreshUrl: `${appUrl}/settings/billing?stripe_connect=refresh`,
    connectUrlSource: STRIPE_CONNECT_URL_NOTE,
    envVars,
    priceIds,
    allPriceIdsPresent,
    paidCheckoutReady,
    betaTesterFeatureEnabled: true,
    issues,
    warnings,
    webhookEndpoint: `${webhookBase}/api/webhooks/stripe`,
    webhookEventsHandled: STRIPE_WEBHOOK_EVENTS_HANDLED,
  };
}

/**
 * Startup safety checks — logs warnings/errors only; never prints full keys.
 * Throws in production when live secret + test publishable mismatch (hard misconfiguration).
 */
export function runStripeStartupSafetyChecks(): void {
  const report = buildStripeReadinessReport();

  const tag = "[JobProof:Stripe]";
  console.log(
    `${tag} startup: mode=${report.inferredStripeMode} secret=${report.secretKeyPrefix} publishable=${report.publishableKeyPrefix} paidCheckoutReady=${report.paidCheckoutReady}`
  );

  for (const issue of report.issues) {
    console.error(`${tag} startup ERROR: ${issue}`);
  }
  for (const warning of report.warnings) {
    console.warn(`${tag} startup WARN: ${warning}`);
  }

  const liveSecretTestPublishable =
    report.secretKeyMode === "live" && report.publishableKeyMode === "test";
  if (liveSecretTestPublishable && process.env.NODE_ENV === "production") {
    throw new Error(
      `${tag} FATAL: STRIPE_SECRET_KEY is live (sk_live) but NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is test (pk_test). Fix env vars before serving production traffic.`
    );
  }
  if (liveSecretTestPublishable) {
    console.error(
      `${tag} FATAL (non-prod): live secret key with test publishable key — subscription checkout will fail.`
    );
  }

  if (report.priceIds.some((p) => !p.present)) {
    console.warn(
      `${tag} startup WARN: missing price IDs — ${report.priceIds
        .filter((p) => !p.present)
        .map((p) => p.envName)
        .join(", ")}`
    );
  }
}
