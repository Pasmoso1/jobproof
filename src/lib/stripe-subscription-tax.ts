/**
 * Stripe Tax helpers for JobProof SaaS subscriptions (contractor billing only).
 *
 * Tax calculation remains Stripe’s responsibility via automatic_tax + active
 * Tax registrations in the Dashboard. JobProof never hardcodes GST/HST/QST/PST/RST
 * rates for subscription charges.
 *
 * Expected product tax code (configure on the Stripe Product, not in app code):
 * use a SaaS / electronically supplied software services code from Stripe’s Tax
 * code catalog (verify in Dashboard before go-live).
 *
 * Authorship for billing address: JobProof business profile → Stripe Customer.
 * Portal address edits are not pulled back into JobProof in this release.
 */

import type Stripe from "stripe";
import { canadianProvinceCode, normalizeCanadianProvince } from "@/lib/canada/provinces";
import { normalizeCanadianPostalCode } from "@/lib/canada/postal-code";
import { DEFAULT_CONTRACTOR_COUNTRY_CODE } from "@/lib/canada/country";

export const STRIPE_TAX_BILLING_ADDRESS_INCOMPLETE_MESSAGE =
  "Complete your business address (street, city, province, and postal code) under Settings → Business before subscribing. JobProof uses that address for Canadian sales tax on your subscription.";

export const STRIPE_TAX_ADDRESS_SYNC_FAILED_MESSAGE =
  "Your business address was saved, but we could not update billing tax location in Stripe. Future subscription invoices may use your previous address until you retry. Address changes apply to future subscription invoices only.";

export const STRIPE_TAX_ADDRESS_FUTURE_INVOICES_NOTE =
  "Address changes apply to future subscription invoices.";

/** Documented expectation only — configure on Stripe Product / Tax settings. */
export const STRIPE_SAAS_PRODUCT_TAX_CODE_CHECKLIST_NOTE =
  "Confirm the Solo/Pro Stripe Products use a SaaS or electronically supplied software tax code from Stripe’s catalog. Do not set this in application code.";

export type StripeBillingAddressSource = {
  business_name?: string | null;
  contractor_name?: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  province?: string | null;
  postal_code?: string | null;
};

export type NormalizedStripeBillingAddress = {
  name: string;
  line1: string;
  line2: string | null;
  city: string;
  /** Two-letter CA province/territory code for Stripe address.state */
  state: string;
  postal_code: string;
  country: typeof DEFAULT_CONTRACTOR_COUNTRY_CODE;
  /** Canonical full province name (JobProof storage) */
  provinceName: string;
};

export type BillingAddressValidationResult =
  | { ok: true; address: NormalizedStripeBillingAddress }
  | { ok: false; error: string };

export function validateStripeBillingAddressSource(
  profile: StripeBillingAddressSource
): BillingAddressValidationResult {
  const name =
    String(profile.business_name ?? "").trim() ||
    String(profile.contractor_name ?? "").trim();
  const line1 = String(profile.address_line_1 ?? "").trim();
  const line2Raw = String(profile.address_line_2 ?? "").trim();
  const city = String(profile.city ?? "").trim();
  const provinceName = normalizeCanadianProvince(profile.province);
  const state = canadianProvinceCode(profile.province);
  const postal_code = normalizeCanadianPostalCode(profile.postal_code);

  if (!name || !line1 || !city || !provinceName || !state || !postal_code) {
    return { ok: false, error: STRIPE_TAX_BILLING_ADDRESS_INCOMPLETE_MESSAGE };
  }

  return {
    ok: true,
    address: {
      name,
      line1,
      line2: line2Raw || null,
      city,
      state,
      postal_code,
      country: DEFAULT_CONTRACTOR_COUNTRY_CODE,
      provinceName,
    },
  };
}

export function stripeCustomerAddressFromNormalized(
  address: NormalizedStripeBillingAddress
): Stripe.AddressParam {
  return {
    line1: address.line1,
    line2: address.line2 ?? undefined,
    city: address.city,
    state: address.state,
    postal_code: address.postal_code,
    country: address.country,
  };
}

/**
 * Update an existing Stripe Customer name + Canadian billing address.
 * Does not create a new customer.
 */
export async function syncStripeCustomerBillingAddress(
  stripe: Stripe,
  customerId: string,
  address: NormalizedStripeBillingAddress
): Promise<void> {
  await stripe.customers.update(customerId, {
    name: address.name,
    address: stripeCustomerAddressFromNormalized(address),
  });
}

export type ExclusivePriceCheckResult =
  | { ok: true; priceId: string; unitAmount: number | null; currency: string }
  | { ok: false; error: string; code: "tax_configuration_error" };

/**
 * Verify a JobProof subscription Price is CAD monthly and tax-exclusive.
 * Does not mutate Stripe Prices (immutable tax_behavior).
 */
export async function assertExclusiveCadMonthlySubscriptionPrice(
  stripe: Stripe,
  priceId: string
): Promise<ExclusivePriceCheckResult> {
  const price = await stripe.prices.retrieve(priceId);
  const currency = String(price.currency ?? "").toLowerCase();
  if (currency !== "cad") {
    return {
      ok: false,
      code: "tax_configuration_error",
      error:
        "Subscription price is not configured in CAD. Correct the Stripe Price in the Dashboard (do not change it from the app).",
    };
  }
  if (price.type !== "recurring" || price.recurring?.interval !== "month") {
    return {
      ok: false,
      code: "tax_configuration_error",
      error:
        "Subscription price must be a monthly recurring Price. Correct it in the Stripe Dashboard.",
    };
  }
  // unspecified inherits account default; exclusive is required for tax-exclusive display.
  const behavior = price.tax_behavior;
  if (behavior === "inclusive") {
    return {
      ok: false,
      code: "tax_configuration_error",
      error:
        "Subscription price is tax-inclusive. Create a new tax-exclusive Price in Stripe (existing Prices cannot change tax behaviour) and update the env price ID.",
    };
  }
  if (behavior != null && behavior !== "exclusive" && behavior !== "unspecified") {
    return {
      ok: false,
      code: "tax_configuration_error",
      error:
        "Subscription price tax behaviour is invalid for JobProof. Use tax_behavior=exclusive on a new Stripe Price.",
    };
  }
  return {
    ok: true,
    priceId: price.id,
    unitAmount: price.unit_amount ?? null,
    currency,
  };
}

/** Log-safe summary when automatic tax cannot run (no full address). */
export function logAutomaticTaxFailure(input: {
  profileId: string;
  stripeCustomerId?: string | null;
  sessionOrSubscriptionId?: string | null;
  automaticTaxStatus?: string | null;
  disabledReason?: string | null;
  addressComplete: boolean;
  provinceCode?: string | null;
}): void {
  console.error("[stripe-tax] automatic_tax issue", {
    profile_id: input.profileId,
    stripe_customer_id: input.stripeCustomerId ?? null,
    session_or_subscription_id: input.sessionOrSubscriptionId ?? null,
    automatic_tax_status: input.automaticTaxStatus ?? null,
    disabled_reason: input.disabledReason ?? null,
    address_complete: input.addressComplete,
    province_code: input.provinceCode ?? null,
  });
}

export function formatBillingAddressForDisplay(profile: StripeBillingAddressSource): string {
  const v = validateStripeBillingAddressSource(profile);
  if (!v.ok) {
    const parts = [
      profile.address_line_1,
      profile.city,
      profile.province,
      profile.postal_code,
    ]
      .map((p) => String(p ?? "").trim())
      .filter(Boolean);
    return parts.length ? parts.join(", ") : "Not set";
  }
  const a = v.address;
  const line2 = a.line2 ? `, ${a.line2}` : "";
  return `${a.line1}${line2}, ${a.city}, ${a.provinceName} ${a.postal_code}, Canada`;
}

export function subscriptionCheckoutTaxParams(): {
  automatic_tax: { enabled: true };
  billing_address_collection: "required";
  customer_update: { address: "auto"; name: "auto" };
} {
  return {
    automatic_tax: { enabled: true },
    billing_address_collection: "required",
    customer_update: {
      address: "auto",
      name: "auto",
    },
  };
}
