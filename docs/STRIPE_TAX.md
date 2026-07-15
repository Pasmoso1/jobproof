# Stripe Tax — JobProof SaaS subscriptions

JobProof collects GST/HST (and later provincial taxes when registered) on **JobProof subscriptions only**. Contractor-created customer quotes, estimates, contracts, and invoices are **out of scope**.

Stripe Tax is the source of truth. JobProof does not hardcode GST/HST/QST/PST/RST rates for SaaS charges.

## Authorship for billing address

**JobProof business profile → Stripe Customer** is authoritative in this release.

- Before Checkout, JobProof pushes the contractor’s business address to the existing Stripe Customer.
- After business-address updates, JobProof syncs again (with retry on Billing if sync fails).
- Returning from the Billing Portal re-pushes JobProof → Stripe; we do **not** overwrite JobProof with Stripe address data (avoids stale portal data beating a newer JobProof edit).

Configure the Stripe Billing Portal so customers can update their billing address (Dashboard → Settings → Billing → Customer portal).

## Expected product tax code

Configure on the **Stripe Product** (Solo / Pro), not in application code:

- Use a SaaS / electronically supplied software services tax code from Stripe’s Tax code catalog.
- Verify the exact catalog code in the Stripe Dashboard before go-live.

`STRIPE_SAAS_PRODUCT_TAX_CODE_CHECKLIST_NOTE` in `src/lib/stripe-subscription-tax.ts` documents this for operators.

## Stripe Dashboard checklist

- [ ] Stripe Tax activated
- [ ] Ontario (Canada) head-office / origin address configured
- [ ] Canadian GST/HST registration added under Tax registrations
- [ ] Default tax behaviour set to **exclusive** (or each Price set to `tax_behavior=exclusive`)
- [ ] Solo and Pro Prices confirmed as **CAD**, monthly recurring, **tax-exclusive**
- [ ] SaaS / software product tax code confirmed on each Product
- [ ] Customer billing-address collection enabled for Checkout (app sets `billing_address_collection=required`)
- [ ] Billing Portal: customer can update billing address
- [ ] Test-mode Checkout completed for multiple provinces (see below)

## Future provincial registration checklist

When JobProof obtains provincial registration (QST / BC PST / SK PST / MB RST):

1. Obtain the legal registration.
2. Add it under **Stripe Tax → Registrations** with the correct jurisdiction.
3. Set the correct **effective date**.
4. Test a Checkout Session with a billing address in that province.
5. Confirm the resulting subscription invoice and Stripe Tax reports.

No application code change is required once the registration is active in Stripe.

## Existing subscription migration

Do **not** run a production-wide migration during deploy.

Optional ops script (dry-run by default):

```bash
npx tsx --env-file=.env.local scripts/migrate-stripe-subscription-tax.ts
npx tsx --env-file=.env.local scripts/migrate-stripe-subscription-tax.ts --apply
```

Reports: `inspected`, `already_correct`, `updated`, `skipped_incomplete_address`, `failures`.

Incomplete Stripe Customer addresses are skipped — complete the JobProof business profile (and sync) first.

## Manual test-mode checklist

Use Stripe **test mode**. Expected tax depends only on **active registrations** in the test account (initially often GST/HST only — do not assume QST/PST appear).

| Case | Expectation |
|------|-------------|
| Ontario billing address | Tax consistent with GST/HST registration |
| Alberta | Tax consistent with active regs (often GST only) |
| Nova Scotia | Tax consistent with active regs |
| Québec | Tax consistent with active regs (QST only if registered) |
| British Columbia | Tax consistent with active regs (PST only if registered) |
| Incomplete address | Checkout blocked in JobProof with link to Business settings |
| Change province after subscribe | Update Business settings → sync → future invoices use new location |
| Trial user subscribes | Checkout with automatic_tax; no Stripe trial |
| Expired-trial user subscribes | Same |
| Solo / Pro checkout | Both paths use the same tax Checkout settings |

Checkout must show final tax before payment. JobProof UI shows “Plus applicable taxes” only — no estimated tax amount.

## Webhooks

`invoice.paid` logs (billing audit metadata, not a tax ledger): invoice id, subtotal, tax, total, currency, customer address country/state, automatic_tax status.

Profile subscription status sync is unchanged; tax-inclusive totals from Stripe must not break JobProof access fields.
