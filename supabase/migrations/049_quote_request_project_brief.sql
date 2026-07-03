-- AI-generated Project Brief for contractor quote request review
ALTER TABLE public.quote_requests
  ADD COLUMN IF NOT EXISTS project_brief jsonb,
  ADD COLUMN IF NOT EXISTS project_brief_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS project_brief_input_hash text;

COMMENT ON COLUMN public.quote_requests.project_brief IS
  'Structured Project Brief (overview, snapshot, facts, verification items, risks, next step).';
COMMENT ON COLUMN public.quote_requests.project_brief_generated_at IS
  'When the Project Brief was last generated.';
COMMENT ON COLUMN public.quote_requests.project_brief_input_hash IS
  'Hash of source inputs — used to skip regeneration when nothing changed.';
