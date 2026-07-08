-- Link quote requests to customers and estimates; extend Quote Builder lifecycle.

ALTER TABLE public.quote_requests
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS estimate_id uuid REFERENCES public.estimates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_quote_requests_customer_id
  ON public.quote_requests(customer_id)
  WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_quote_requests_estimate_id
  ON public.quote_requests(estimate_id)
  WHERE estimate_id IS NOT NULL;

COMMENT ON COLUMN public.quote_requests.customer_id IS
  'Contractor customer record linked from this quote request.';
COMMENT ON COLUMN public.quote_requests.estimate_id IS
  'Formal estimate created when the contractor sends a quote.';

ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS quote_request_id uuid REFERENCES public.quote_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_estimates_quote_request_id
  ON public.estimates(quote_request_id)
  WHERE quote_request_id IS NOT NULL;

COMMENT ON COLUMN public.estimates.quote_request_id IS
  'Source quote request when estimate was created from Quote Builder.';

ALTER TABLE public.quote_requests
  DROP CONSTRAINT IF EXISTS quote_requests_quote_builder_status_check;

ALTER TABLE public.quote_requests
  ADD CONSTRAINT quote_requests_quote_builder_status_check
  CHECK (quote_builder_status IN ('empty', 'draft', 'ready', 'sent'));

COMMENT ON COLUMN public.quote_requests.quote_builder_status IS
  'Quote Builder lifecycle: empty, draft, ready, sent (delivered to customer).';
