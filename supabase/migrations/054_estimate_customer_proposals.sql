-- Customer-facing proposal snapshot and quote feedback messages.

ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS customer_proposal jsonb;

COMMENT ON COLUMN public.estimates.customer_proposal IS
  'Structured customer-facing proposal snapshot captured when a quote is prepared/sent.';

CREATE TABLE IF NOT EXISTS public.estimate_customer_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id uuid NOT NULL REFERENCES public.estimates(id) ON DELETE CASCADE,
  quote_request_id uuid REFERENCES public.quote_requests(id) ON DELETE SET NULL,
  contractor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message_type text NOT NULL CHECK (message_type IN ('question', 'change_request', 'decline')),
  customer_name text,
  customer_email text,
  customer_phone text,
  message_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_estimate_customer_messages_estimate_id
  ON public.estimate_customer_messages(estimate_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_estimate_customer_messages_quote_request_id
  ON public.estimate_customer_messages(quote_request_id, created_at DESC)
  WHERE quote_request_id IS NOT NULL;

ALTER TABLE public.estimate_customer_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Contractors manage own estimate customer messages"
  ON public.estimate_customer_messages;

CREATE POLICY "Contractors manage own estimate customer messages"
  ON public.estimate_customer_messages FOR ALL
  USING (
    contractor_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  )
  WITH CHECK (
    contractor_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );
