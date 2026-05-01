-- Stripe subscription billing + Stripe Connect fields on profiles.
-- Safe additive migration (nullable columns, no breaking schema changes).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS stripe_price_id text,
  ADD COLUMN IF NOT EXISTS plan_tier text CHECK (plan_tier IN ('essential', 'professional')),
  ADD COLUMN IF NOT EXISTS pricing_version text CHECK (pricing_version IN ('founder', 'standard')),
  ADD COLUMN IF NOT EXISTS subscription_current_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS grace_period_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_connect_account_id text,
  ADD COLUMN IF NOT EXISTS stripe_connect_onboarding_complete boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_connect_charges_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_connect_payouts_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_connect_details_submitted boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id
  ON public.profiles (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_stripe_subscription_id
  ON public.profiles (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_stripe_connect_account_id
  ON public.profiles (stripe_connect_account_id)
  WHERE stripe_connect_account_id IS NOT NULL;

COMMENT ON COLUMN public.profiles.stripe_customer_id IS 'Stripe customer id used for JobProof subscription billing.';
COMMENT ON COLUMN public.profiles.stripe_subscription_id IS 'Current Stripe subscription id for JobProof billing.';
COMMENT ON COLUMN public.profiles.stripe_price_id IS 'Stripe price id for the active JobProof plan.';
COMMENT ON COLUMN public.profiles.plan_tier IS 'Billing plan tier: essential or professional.';
COMMENT ON COLUMN public.profiles.pricing_version IS 'Pricing cohort: founder or standard.';
COMMENT ON COLUMN public.profiles.subscription_status IS 'Normalized subscription lifecycle status.';
COMMENT ON COLUMN public.profiles.subscription_current_period_end IS 'Current subscription period end timestamp from Stripe.';
COMMENT ON COLUMN public.profiles.trial_ends_at IS 'Stripe trial end timestamp.';
COMMENT ON COLUMN public.profiles.grace_period_ends_at IS 'End of grace period after failed payment.';
COMMENT ON COLUMN public.profiles.stripe_connect_account_id IS 'Connected Stripe Express account id for contractor online invoice payments.';

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_subscription_status_check;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_subscription_status_check1;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_subscription_status_check2;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_subscription_status_check3;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_subscription_status_check4;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_subscription_status_check5;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_subscription_status_check6;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_subscription_status_check7;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_subscription_status_check8;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_subscription_status_check9;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_subscription_status_check
  CHECK (
    subscription_status IN (
      'trial',
      'trialing',
      'active',
      'past_due',
      'canceled',
      'cancelled',
      'unpaid',
      'incomplete',
      'incomplete_expired'
    )
  );
