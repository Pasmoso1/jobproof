-- Quote request system foundation: public intake + contractor dashboard

-- Profile fields for public quote page settings
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS quote_slug text,
  ADD COLUMN IF NOT EXISTS quote_logo_url text,
  ADD COLUMN IF NOT EXISTS quote_pricing_profile text CHECK (
    quote_pricing_profile IS NULL OR quote_pricing_profile IN ('budget', 'average', 'premium')
  ),
  ADD COLUMN IF NOT EXISTS quote_primary_trade text CHECK (
    quote_primary_trade IS NULL OR quote_primary_trade IN (
      'Painter',
      'Landscaper',
      'Renovator',
      'Handyman',
      'Roofer',
      'HVAC',
      'Plumber',
      'Electrician',
      'Flooring',
      'Deck/Fence',
      'Other'
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_quote_slug
  ON public.profiles (lower(quote_slug))
  WHERE quote_slug IS NOT NULL;

COMMENT ON COLUMN public.profiles.quote_slug IS 'Public URL slug for /quote/[slug]';
COMMENT ON COLUMN public.profiles.quote_logo_url IS 'Logo URL shown on public quote request page';
COMMENT ON COLUMN public.profiles.quote_pricing_profile IS 'Contractor pricing tier: budget, average, premium';
COMMENT ON COLUMN public.profiles.quote_primary_trade IS 'Primary trade shown in quote settings';

CREATE TABLE public.quote_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'new' CHECK (
    status IN (
      'new',
      'reviewed',
      'responded',
      'site_visit_requested',
      'converted',
      'closed'
    )
  ),
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  customer_phone text,
  property_address text NOT NULL,
  project_type text NOT NULL,
  description text NOT NULL,
  is_urgent boolean NOT NULL DEFAULT false,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_quote_requests_contractor_id ON public.quote_requests(contractor_id);
CREATE INDEX idx_quote_requests_status ON public.quote_requests(contractor_id, status);
CREATE INDEX idx_quote_requests_submitted_at ON public.quote_requests(contractor_id, submitted_at DESC);

COMMENT ON TABLE public.quote_requests IS 'Inbound project quote requests from public /quote/[slug] page';

DROP TRIGGER IF EXISTS quote_requests_updated_at ON public.quote_requests;
CREATE TRIGGER quote_requests_updated_at
  BEFORE UPDATE ON public.quote_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.quote_request_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_request_id uuid NOT NULL REFERENCES public.quote_requests(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_quote_request_attachments_request_id
  ON public.quote_request_attachments(quote_request_id);

COMMENT ON TABLE public.quote_request_attachments IS 'Photos uploaded with a public quote request';

ALTER TABLE public.quote_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_request_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contractors manage own quote requests"
  ON public.quote_requests FOR ALL
  USING (
    contractor_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  )
  WITH CHECK (
    contractor_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Contractors read own quote request attachments"
  ON public.quote_request_attachments FOR SELECT
  USING (
    quote_request_id IN (
      SELECT qr.id FROM public.quote_requests qr
      WHERE qr.contractor_id IN (
        SELECT id FROM public.profiles WHERE user_id = auth.uid()
      )
    )
  );

-- Storage bucket for quote request photos (uploaded via service role on public submit)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'quote-request-attachments',
  'quote-request-attachments',
  false,
  10485760,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/heic',
    'image/heif'
  ]::text[]
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Contractors read quote request attachment files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'quote-request-attachments'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
      AND (storage.foldername(name))[1] = p.id::text
    )
  );
