-- Work-component scope analysis fields for quote requests

ALTER TABLE public.quote_requests
  ADD COLUMN IF NOT EXISTS ai_scope_confidence text CHECK (
    ai_scope_confidence IS NULL OR ai_scope_confidence IN ('high', 'medium', 'low')
  ),
  ADD COLUMN IF NOT EXISTS ai_work_components jsonb,
  ADD COLUMN IF NOT EXISTS ai_specialist_trades jsonb;

COMMENT ON COLUMN public.quote_requests.ai_scope_confidence IS
  'Confidence in scope assessment based on work-component analysis';
COMMENT ON COLUMN public.quote_requests.ai_work_components IS
  'Decomposed work components with contractor capability match (contractor-facing)';
COMMENT ON COLUMN public.quote_requests.ai_specialist_trades IS
  'Trades typically required for identified work components';
