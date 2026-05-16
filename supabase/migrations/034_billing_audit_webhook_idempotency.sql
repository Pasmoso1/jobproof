-- Billing audit trail (operational/debug) + Stripe webhook idempotency.
-- Service role inserts only from app server; no end-user RLS policies required.

CREATE TABLE IF NOT EXISTS public.billing_event_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_event_id text,
  event_type text NOT NULL,
  old_subscription_status text,
  new_subscription_status text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_billing_event_logs_profile_created
  ON public.billing_event_logs (profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_billing_event_logs_stripe_event_id
  ON public.billing_event_logs (stripe_event_id)
  WHERE stripe_event_id IS NOT NULL;

COMMENT ON TABLE public.billing_event_logs IS 'Append-only billing lifecycle events for support and debugging (no secrets).';

ALTER TABLE public.billing_event_logs ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.stripe_processed_events (
  stripe_event_id text PRIMARY KEY,
  processed_at timestamptz NOT NULL DEFAULT now(),
  event_type text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stripe_processed_events_processed_at
  ON public.stripe_processed_events (processed_at DESC);

COMMENT ON TABLE public.stripe_processed_events IS 'Stripe webhook idempotency — one row per delivered event id.';

ALTER TABLE public.stripe_processed_events ENABLE ROW LEVEL SECURITY;
