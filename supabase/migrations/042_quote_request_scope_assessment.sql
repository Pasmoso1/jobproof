-- AI scope assessment for quote request follow-up

ALTER TABLE public.quote_requests
  ADD COLUMN IF NOT EXISTS ai_scope_fit text CHECK (
    ai_scope_fit IS NULL OR ai_scope_fit IN (
      'within_scope',
      'mixed_scope',
      'possibly_out_of_scope',
      'outside_scope'
    )
  ),
  ADD COLUMN IF NOT EXISTS ai_scope_reason text,
  ADD COLUMN IF NOT EXISTS ai_scope_contractor_note text,
  ADD COLUMN IF NOT EXISTS ai_scope_customer_clarification_needed boolean;

COMMENT ON COLUMN public.quote_requests.ai_scope_fit IS
  'AI assessment of whether the request fits the contractor listed trade';
COMMENT ON COLUMN public.quote_requests.ai_scope_reason IS
  'Short factual reason for the scope assessment (contractor-facing context)';
COMMENT ON COLUMN public.quote_requests.ai_scope_contractor_note IS
  'Contractor-facing scope note; not shown to the customer';
COMMENT ON COLUMN public.quote_requests.ai_scope_customer_clarification_needed IS
  'Whether scope ambiguity requires customer clarification during follow-up';
