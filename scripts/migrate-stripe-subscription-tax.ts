/**
 * One-time / ops utility: enable Stripe Tax (automatic_tax) on existing JobProof
 * SaaS subscriptions and ensure Stripe Customers have a Canadian billing address.
 *
 * Does NOT run during app deploy. Dry-run by default.
 *
 * Usage (from repo root, with env loaded):
 *   npx tsx --env-file=.env.local scripts/migrate-stripe-subscription-tax.ts
 *   npx tsx --env-file=.env.local scripts/migrate-stripe-subscription-tax.ts --apply
 *
 * Reports: inspected, already_correct, updated, skipped_incomplete_address, failures.
 */

import Stripe from "stripe";

type Counts = {
  inspected: number;
  already_correct: number;
  updated: number;
  skipped_incomplete_address: number;
  failures: number;
};

function env(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

function addressComplete(customer: Stripe.Customer): boolean {
  const a = customer.address;
  if (!a) return false;
  return Boolean(
    a.line1?.trim() &&
      a.city?.trim() &&
      a.state?.trim() &&
      a.postal_code?.trim() &&
      String(a.country ?? "").toUpperCase() === "CA"
  );
}

async function main() {
  const apply = process.argv.includes("--apply");
  const dryRun = !apply;
  const stripe = new Stripe(env("STRIPE_SECRET_KEY"));

  const counts: Counts = {
    inspected: 0,
    already_correct: 0,
    updated: 0,
    skipped_incomplete_address: 0,
    failures: 0,
  };

  console.log(
    dryRun
      ? "[migrate-stripe-subscription-tax] DRY RUN (pass --apply to write)"
      : "[migrate-stripe-subscription-tax] APPLY mode"
  );

  let startingAfter: string | undefined;
  for (;;) {
    const page = await stripe.subscriptions.list({
      status: "all",
      limit: 100,
      starting_after: startingAfter,
      expand: ["data.customer"],
    });
    if (!page.data.length) break;

    for (const sub of page.data) {
      if (!["active", "trialing", "past_due", "unpaid", "incomplete"].includes(sub.status)) {
        continue;
      }
      // Only JobProof plan subscriptions (metadata or known price env ids).
      const priceId = sub.items.data[0]?.price?.id ?? "";
      const knownPrices = [
        process.env.STRIPE_PRICE_ESSENTIAL_FOUNDER,
        process.env.STRIPE_PRICE_PROFESSIONAL_FOUNDER,
        process.env.STRIPE_PRICE_ESSENTIAL_STANDARD,
        process.env.STRIPE_PRICE_PROFESSIONAL_STANDARD,
      ]
        .map((p) => p?.trim())
        .filter(Boolean) as string[];
      const isJobProof =
        Boolean(sub.metadata?.profile_id) ||
        (priceId && knownPrices.includes(priceId));
      if (!isJobProof) continue;

      counts.inspected += 1;
      const customerRaw = sub.customer;
      const customerId =
        typeof customerRaw === "string" ? customerRaw : customerRaw?.id;
      if (!customerId) {
        counts.failures += 1;
        console.error("failure: missing customer", { subscription: sub.id });
        continue;
      }

      let customer: Stripe.Customer;
      try {
        const retrieved =
          typeof customerRaw === "object" && customerRaw && !customerRaw.deleted
            ? customerRaw
            : await stripe.customers.retrieve(customerId);
        if (!retrieved || ("deleted" in retrieved && retrieved.deleted)) {
          counts.failures += 1;
          console.error("failure: deleted customer", { subscription: sub.id, customerId });
          continue;
        }
        customer = retrieved as Stripe.Customer;
      } catch (err) {
        counts.failures += 1;
        console.error("failure: retrieve customer", {
          subscription: sub.id,
          customerId,
          error: err instanceof Error ? err.message : String(err),
        });
        continue;
      }

      const taxEnabled = Boolean(sub.automatic_tax?.enabled);
      const complete = addressComplete(customer);

      if (taxEnabled && complete) {
        counts.already_correct += 1;
        console.log("already_correct", { subscription: sub.id, customer: customerId });
        continue;
      }

      if (!complete) {
        counts.skipped_incomplete_address += 1;
        console.log("skipped_incomplete_address", {
          subscription: sub.id,
          customer: customerId,
          profile_id: sub.metadata?.profile_id ?? null,
          country: customer.address?.country ?? null,
          state: customer.address?.state ?? null,
          has_line1: Boolean(customer.address?.line1),
          has_postal: Boolean(customer.address?.postal_code),
        });
        continue;
      }

      if (taxEnabled) {
        counts.already_correct += 1;
        continue;
      }

      if (dryRun) {
        counts.updated += 1;
        console.log("would_update", { subscription: sub.id, customer: customerId });
        continue;
      }

      try {
        await stripe.subscriptions.update(sub.id, {
          automatic_tax: { enabled: true },
        });
        counts.updated += 1;
        console.log("updated", { subscription: sub.id, customer: customerId });
      } catch (err) {
        counts.failures += 1;
        console.error("failure: enable automatic_tax", {
          subscription: sub.id,
          customer: customerId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (!page.has_more) break;
    startingAfter = page.data[page.data.length - 1]?.id;
    if (!startingAfter) break;
  }

  console.log("[migrate-stripe-subscription-tax] summary", counts);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
