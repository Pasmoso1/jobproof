-- Pending Essential downgrade (paid subscriptions): Professional stays active until effective_at.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pending_plan_tier text CHECK (pending_plan_tier IN ('essential', 'professional')),
  ADD COLUMN IF NOT EXISTS pending_plan_effective_at timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_subscription_schedule_id text;

COMMENT ON COLUMN public.profiles.pending_plan_tier IS 'Plan tier that will apply after pending_plan_effective_at (in-app downgrade scheduling).';
COMMENT ON COLUMN public.profiles.pending_plan_effective_at IS 'When pending_plan_tier takes effect (usually current period end).';
COMMENT ON COLUMN public.profiles.stripe_subscription_schedule_id IS 'Stripe Subscription Schedule id managing a deferred plan change.';
