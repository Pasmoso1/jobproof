# Stripe Testing Checklist

Use Stripe **test mode** for all checks below.

## 1) Subscription checkout

- Open `/settings/billing`.
- Click **Choose Essential** or **Choose Professional**.
- Complete checkout in Stripe test mode.
- Confirm webhook updates profile fields:
  - `stripe_customer_id`
  - `stripe_subscription_id`
  - `stripe_price_id`
  - `plan_tier`
  - `pricing_version`
  - `subscription_status`
  - `subscription_current_period_end`
  - `trial_ends_at`

## 2) Failed payment + grace period

- In Stripe test mode, trigger failed invoice payment for the subscription.
- Confirm webhook sets:
  - `subscription_status = past_due`
  - `grace_period_ends_at = now + 7 days` (if not already set)
- Confirm app behavior:
  - During grace: create/send contract + invoice still allowed.
  - After grace: read-only mode (creation/sending blocked).

## 3) Stripe Connect onboarding

- In `/settings/billing`, click **Connect Stripe**.
- Complete or partially complete onboarding.
- Confirm profile updates:
  - `stripe_connect_account_id`
  - `stripe_connect_charges_enabled`
  - `stripe_connect_payouts_enabled`
  - `stripe_connect_details_submitted`
  - `stripe_connect_onboarding_complete`

## 4) Public invoice online payment

- Ensure contractor has connected account with charges enabled.
- Open public invoice link with remaining balance.
- Click **Pay online**, complete Stripe checkout.
- Confirm webhook creates one `invoice_payments` row:
  - `payment_method = card`
  - `note` contains Stripe payment reference
- Confirm invoice recalculates to `partially_paid` or `paid`.
- Retry webhook event and confirm duplicate payment row is not created.

## 5) Webhook verification

- Ensure `STRIPE_WEBHOOK_SECRET` is set.
- Confirm `/api/webhooks/stripe` receives and verifies signatures.
- Confirm handled events:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.paid`
  - `invoice.payment_failed`
  - `customer.subscription.trial_will_end`
  - `account.updated`

