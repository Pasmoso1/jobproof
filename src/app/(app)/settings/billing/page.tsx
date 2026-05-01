import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatDateEastern } from "@/lib/datetime-eastern";
import { getSubscriptionAccess } from "@/lib/subscription-access";
import { BillingActionButtons } from "./billing-actions-client";
import { refreshStripeConnectStatus } from "./actions";

function fmt(iso?: string | null) {
  if (!iso) return "—";
  return formatDateEastern(iso, { dateStyle: "medium" });
}

export default async function BillingSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (sp.stripe_connect === "return" || sp.stripe_connect === "refresh") {
    await refreshStripeConnectStatus();
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();
  if (!profile) redirect("/login");

  const access = getSubscriptionAccess(profile);
  const checkoutState = String(sp.checkout ?? "");
  const isPastDue = String(profile.subscription_status ?? "") === "past_due";
  const isTrialing = ["trial", "trialing"].includes(
    String(profile.subscription_status ?? "").toLowerCase()
  );
  const connectReady = Boolean(
    profile.stripe_connect_charges_enabled && profile.stripe_connect_payouts_enabled
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/dashboard" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
          ← Back to dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-zinc-900">Billing</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Manage your JobProof subscription and Stripe payment account.
        </p>
      </div>
      {checkoutState === "success" ? (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          Checkout completed. Subscription details will update shortly.
        </div>
      ) : null}
      {checkoutState === "cancelled" ? (
        <div className="rounded-lg border border-zinc-200 bg-zinc-100 p-4 text-sm text-zinc-700">
          Checkout cancelled. No changes were made.
        </div>
      ) : null}

      {!access.canCreateContracts && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-medium">Read-only mode enabled</p>
          <p className="mt-1">{access.reason}</p>
        </div>
      )}
      {isPastDue && profile.grace_period_ends_at && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Past due. Grace period ends {fmt(profile.grace_period_ends_at)}.
        </div>
      )}
      {isTrialing && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          Trial active until {fmt(profile.trial_ends_at)}.
        </div>
      )}

      <section className="rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="text-base font-semibold text-zinc-900">Subscription</h2>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-zinc-500">Current plan</dt>
            <dd className="font-medium capitalize text-zinc-900">
              {profile.plan_tier ?? "—"} {profile.pricing_version ? `(${profile.pricing_version})` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Status</dt>
            <dd className="font-medium text-zinc-900">{profile.subscription_status ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Current period end</dt>
            <dd className="font-medium text-zinc-900">{fmt(profile.subscription_current_period_end)}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Stripe customer</dt>
            <dd className="font-mono text-xs text-zinc-700">{profile.stripe_customer_id ?? "—"}</dd>
          </div>
        </dl>
        <div className="mt-4">
          <BillingActionButtons
            connectOnboardingIncomplete={
              !connectReady && Boolean(profile.stripe_connect_account_id)
            }
          />
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="text-base font-semibold text-zinc-900">Accept online payments</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Connect Stripe to let customers pay invoices by card. You can set this up later.
        </p>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-zinc-500">Connected account</dt>
            <dd className="font-mono text-xs text-zinc-700">{profile.stripe_connect_account_id ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Onboarding status</dt>
            <dd className="font-medium text-zinc-900">
              {connectReady ? "Stripe connected" : "Onboarding incomplete"}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Charges enabled</dt>
            <dd className="font-medium text-zinc-900">
              {profile.stripe_connect_charges_enabled ? "Yes" : "No"}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Payouts enabled</dt>
            <dd className="font-medium text-zinc-900">
              {profile.stripe_connect_payouts_enabled ? "Yes" : "No"}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

