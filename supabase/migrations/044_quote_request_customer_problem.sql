-- Customer problem classification from AI quote follow-up (contractor-facing)

ALTER TABLE public.quote_requests
  ADD COLUMN IF NOT EXISTS ai_customer_problem_label text,
  ADD COLUMN IF NOT EXISTS ai_customer_problem_confidence text CHECK (
    ai_customer_problem_confidence IS NULL OR ai_customer_problem_confidence IN (
      'high',
      'medium',
      'low'
    )
  ),
  ADD COLUMN IF NOT EXISTS ai_customer_problem_reasoning text;

COMMENT ON COLUMN public.quote_requests.ai_customer_problem_label IS
  'AI-detected customer problem category (independent of contractor trade)';
COMMENT ON COLUMN public.quote_requests.ai_customer_problem_confidence IS
  'Confidence in the detected customer problem classification';
COMMENT ON COLUMN public.quote_requests.ai_customer_problem_reasoning IS
  'Short reasoning for the detected customer problem (contractor-facing)';
