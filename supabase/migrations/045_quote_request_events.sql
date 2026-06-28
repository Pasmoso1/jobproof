-- Timeline / history entries for quote request contractor actions

CREATE TABLE public.quote_request_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_request_id uuid NOT NULL REFERENCES public.quote_requests(id) ON DELETE CASCADE,
  contractor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_label text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_quote_request_events_request_id
  ON public.quote_request_events(quote_request_id, created_at DESC);

COMMENT ON TABLE public.quote_request_events IS
  'Contractor action history for a quote request (declines, status changes, etc.)';

ALTER TABLE public.quote_request_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contractors read own quote request events"
  ON public.quote_request_events FOR SELECT
  USING (
    contractor_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Contractors insert own quote request events"
  ON public.quote_request_events FOR INSERT
  WITH CHECK (
    contractor_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );
