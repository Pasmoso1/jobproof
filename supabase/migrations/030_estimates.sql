-- Estimates / quotes (pre-job workflow)

CREATE TABLE public.estimates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE RESTRICT,
  job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  estimate_number text NOT NULL,
  title text NOT NULL,
  scope_of_work text,
  property_address_line_1 text,
  property_address_line_2 text,
  property_city text,
  property_province text,
  property_postal_code text,
  subtotal numeric(12, 2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  tax_rate numeric(5, 4) NOT NULL DEFAULT 0 CHECK (tax_rate >= 0),
  tax_amount numeric(12, 2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  total numeric(12, 2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  deposit_amount numeric(12, 2),
  expiry_date date,
  notes text,
  status text NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'sent', 'viewed', 'accepted', 'declined')
  ),
  public_token uuid UNIQUE,
  sent_at timestamptz,
  viewed_at timestamptz,
  responded_at timestamptz,
  accepted_at timestamptz,
  declined_at timestamptz,
  estimate_pdf_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_estimates_profile_id ON public.estimates(profile_id);
CREATE INDEX idx_estimates_customer_id ON public.estimates(customer_id)
  WHERE customer_id IS NOT NULL;
CREATE INDEX idx_estimates_job_id ON public.estimates(job_id)
  WHERE job_id IS NOT NULL;
CREATE INDEX idx_estimates_public_token ON public.estimates(public_token)
  WHERE public_token IS NOT NULL;
CREATE UNIQUE INDEX idx_estimates_profile_estimate_number
  ON public.estimates(profile_id, estimate_number);

COMMENT ON TABLE public.estimates IS 'Pre-job quotes; public_token set when sent to customer.';
COMMENT ON COLUMN public.estimates.public_token IS 'Secret for /estimate/[token]; null until first send.';
COMMENT ON COLUMN public.estimates.estimate_pdf_path IS 'Path in estimate-pdfs bucket: {profile_id}/{estimate_id}.pdf';

DROP TRIGGER IF EXISTS estimates_updated_at ON public.estimates;
CREATE TRIGGER estimates_updated_at
  BEFORE UPDATE ON public.estimates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.estimates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own estimates"
  ON public.estimates FOR ALL
  USING (
    profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  )
  WITH CHECK (
    profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

-- PDF storage (contractor uploads; same pattern as invoice-pdfs)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'estimate-pdfs',
  'estimate-pdfs',
  false,
  5242880,
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload estimate PDFs to own folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'estimate-pdfs'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
      AND (storage.foldername(name))[1] = p.id::text
    )
  );

CREATE POLICY "Users can read own estimate PDFs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'estimate-pdfs'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
      AND (storage.foldername(name))[1] = p.id::text
    )
  );

CREATE POLICY "Users can update own estimate PDFs"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'estimate-pdfs'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
      AND (storage.foldername(name))[1] = p.id::text
    )
  );

-- Email audit: include estimate sends
ALTER TABLE public.email_logs DROP CONSTRAINT IF EXISTS email_logs_type_check;
ALTER TABLE public.email_logs ADD CONSTRAINT email_logs_type_check
  CHECK (type IN ('contract', 'change_order', 'invoice', 'estimate'));

COMMENT ON COLUMN public.email_logs.type IS 'contract | change_order | invoice | estimate';
