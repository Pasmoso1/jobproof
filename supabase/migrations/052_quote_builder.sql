-- Quote Builder: normalized draft sections per quote request

ALTER TABLE public.quote_requests
  ADD COLUMN IF NOT EXISTS quote_builder_status text NOT NULL DEFAULT 'empty'
    CHECK (quote_builder_status IN ('empty', 'draft', 'ready')),
  ADD COLUMN IF NOT EXISTS quote_builder_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS quote_builder_input_hash text,
  ADD COLUMN IF NOT EXISTS quote_builder_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS quote_builder_site_visit_banner boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.quote_requests.quote_builder_status IS
  'Quote Builder lifecycle: empty, draft, ready (contractor-approved, not sent).';
COMMENT ON COLUMN public.quote_requests.quote_builder_input_hash IS
  'Hash of all source inputs — enables section-level regeneration when inputs change.';
COMMENT ON COLUMN public.quote_requests.quote_builder_site_visit_banner IS
  'Show banner when site visit notes indicate customer-requested scope changes.';

CREATE TABLE public.quote_request_builder_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_request_id uuid NOT NULL REFERENCES public.quote_requests(id) ON DELETE CASCADE,
  contractor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  section_key text NOT NULL CHECK (
    section_key IN (
      'project_summary',
      'scope_of_work',
      'included_work',
      'items_requiring_confirmation',
      'optional_upgrades',
      'exclusions',
      'suggested_timeline',
      'suggested_warranty',
      'assumptions',
      'recommended_next_steps',
      'pricing'
    )
  ),
  title text NOT NULL,
  content jsonb NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'generated' CHECK (source IN ('generated', 'contractor')),
  contractor_edited boolean NOT NULL DEFAULT false,
  contractor_edited_at timestamptz,
  generated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quote_request_builder_sections_key_unique
    UNIQUE (quote_request_id, section_key)
);

CREATE INDEX idx_quote_builder_sections_request
  ON public.quote_request_builder_sections(quote_request_id, display_order);

CREATE INDEX idx_quote_builder_sections_contractor
  ON public.quote_request_builder_sections(contractor_id);

COMMENT ON TABLE public.quote_request_builder_sections IS
  'Editable Quote Builder sections — one row per section per quote request.';
COMMENT ON COLUMN public.quote_request_builder_sections.content IS
  'Versioned JSON payload (list items, timeline text, or pricing placeholders).';
COMMENT ON COLUMN public.quote_request_builder_sections.contractor_edited IS
  'When true, regeneration preserves this section content.';

DROP TRIGGER IF EXISTS quote_request_builder_sections_updated_at
  ON public.quote_request_builder_sections;
CREATE TRIGGER quote_request_builder_sections_updated_at
  BEFORE UPDATE ON public.quote_request_builder_sections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.quote_request_builder_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contractors manage own quote builder sections"
  ON public.quote_request_builder_sections FOR ALL
  USING (
    contractor_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  )
  WITH CHECK (
    contractor_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );
