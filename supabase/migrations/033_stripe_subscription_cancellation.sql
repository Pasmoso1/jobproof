-- Stripe subscription cancellation metadata (portal cancel now / cancel at period end).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subscription_cancel_at_period_end boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS subscription_cancel_at timestamptz,
  ADD COLUMN IF NOT EXISTS subscription_canceled_at timestamptz;

COMMENT ON COLUMN public.profiles.subscription_cancel_at_period_end IS 'True when Stripe subscription is set to cancel at period end.';
COMMENT ON COLUMN public.profiles.subscription_cancel_at IS 'Stripe subscription.cancel_at: when the subscription will end.';
COMMENT ON COLUMN public.profiles.subscription_canceled_at IS 'Stripe subscription.canceled_at: when cancellation was requested or completed.';
