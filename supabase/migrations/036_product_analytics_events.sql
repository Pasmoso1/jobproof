-- Product / onboarding analytics events (behavioral; separate from billing_event_logs).
CREATE TABLE IF NOT EXISTS public.product_analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_name text NOT NULL,
  session_id text,
  route text,
  source text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_hash text,
  user_agent text
);

CREATE INDEX IF NOT EXISTS product_analytics_events_created_at_idx
  ON public.product_analytics_events (created_at DESC);

CREATE INDEX IF NOT EXISTS product_analytics_events_profile_id_idx
  ON public.product_analytics_events (profile_id);

CREATE INDEX IF NOT EXISTS product_analytics_events_event_name_idx
  ON public.product_analytics_events (event_name);

CREATE INDEX IF NOT EXISTS product_analytics_events_profile_event_idx
  ON public.product_analytics_events (profile_id, event_name)
  WHERE profile_id IS NOT NULL;

COMMENT ON TABLE public.product_analytics_events IS
  'Internal product/onboarding analytics. No secrets, tokens, or payment details.';

ALTER TABLE public.product_analytics_events ENABLE ROW LEVEL SECURITY;

-- No policies: authenticated users cannot read/write; service role bypasses RLS.
