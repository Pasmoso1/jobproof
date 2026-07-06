-- AI Quote Preparation Checklist: normalized workflow items per quote request

ALTER TABLE public.quote_requests
  ADD COLUMN IF NOT EXISTS quote_checklist_input_hash text,
  ADD COLUMN IF NOT EXISTS quote_checklist_generated_at timestamptz;

COMMENT ON COLUMN public.quote_requests.quote_checklist_input_hash IS
  'Hash of checklist source inputs — skips regeneration when unchanged.';
COMMENT ON COLUMN public.quote_requests.quote_checklist_generated_at IS
  'When the quote preparation checklist was last generated.';

CREATE TABLE public.quote_request_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_request_id uuid NOT NULL REFERENCES public.quote_requests(id) ON DELETE CASCADE,
  contractor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stable_key text NOT NULL,
  category text NOT NULL CHECK (
    category IN (
      'before_contacting_customer',
      'during_first_conversation',
      'site_visit',
      'pricing_considerations',
      'potential_risks',
      'recommended_next_action'
    )
  ),
  title text NOT NULL,
  description text NOT NULL,
  priority text NOT NULL CHECK (priority IN ('Critical', 'Important', 'Optional')),
  display_order integer NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  completed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  generated_from text NOT NULL,
  ai_reason text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quote_request_checklist_items_stable_key_unique
    UNIQUE (quote_request_id, stable_key)
);

CREATE INDEX idx_quote_checklist_items_request
  ON public.quote_request_checklist_items(quote_request_id, is_active, display_order);

CREATE INDEX idx_quote_checklist_items_contractor
  ON public.quote_request_checklist_items(contractor_id);

COMMENT ON TABLE public.quote_request_checklist_items IS
  'Structured AI quote preparation checklist — contractor workflow tasks (private).';
COMMENT ON COLUMN public.quote_request_checklist_items.stable_key IS
  'Deterministic key for incremental regeneration; preserves completion state.';
COMMENT ON COLUMN public.quote_request_checklist_items.ai_reason IS
  'Internal AI rationale — never shown to contractors.';

DROP TRIGGER IF EXISTS quote_request_checklist_items_updated_at
  ON public.quote_request_checklist_items;
CREATE TRIGGER quote_request_checklist_items_updated_at
  BEFORE UPDATE ON public.quote_request_checklist_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.quote_request_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contractors manage own checklist items"
  ON public.quote_request_checklist_items FOR ALL
  USING (
    contractor_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  )
  WITH CHECK (
    contractor_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );
