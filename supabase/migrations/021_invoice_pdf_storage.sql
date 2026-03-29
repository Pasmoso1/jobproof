-- Invoice PDFs: optional persisted copy in private storage (profile-scoped folder)

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS invoice_pdf_path text;

COMMENT ON COLUMN public.invoices.invoice_pdf_path IS 'Path in invoice-pdfs bucket: {profile_id}/{invoice_id}.pdf';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'invoice-pdfs',
  'invoice-pdfs',
  false,
  5242880,
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload invoice PDFs to own folder"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'invoice-pdfs'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
    AND (storage.foldername(name))[1] = p.id::text
  )
);

CREATE POLICY "Users can read own invoice PDFs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'invoice-pdfs'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
    AND (storage.foldername(name))[1] = p.id::text
  )
);

CREATE POLICY "Users can update own invoice PDFs"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'invoice-pdfs'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
    AND (storage.foldername(name))[1] = p.id::text
  )
);
