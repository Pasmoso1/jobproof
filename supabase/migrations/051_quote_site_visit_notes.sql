-- Site Visit Notes: contractor-private workspace for quote request site visits

CREATE TABLE public.quote_request_site_visit_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_request_id uuid NOT NULL UNIQUE REFERENCES public.quote_requests(id) ON DELETE CASCADE,
  contractor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  quick_notes text NOT NULL DEFAULT '',
  organized_notes jsonb,
  organized_notes_generated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_site_visit_notes_contractor
  ON public.quote_request_site_visit_notes(contractor_id);

COMMENT ON TABLE public.quote_request_site_visit_notes IS
  'Contractor-private site visit notes per quote request (quick + AI-organized).';
COMMENT ON COLUMN public.quote_request_site_visit_notes.quick_notes IS
  'Free-form contractor observations from the site visit.';
COMMENT ON COLUMN public.quote_request_site_visit_notes.organized_notes IS
  'Structured sections for future Quote Builder — versioned JSON, never auto-overwrites quick_notes.';

DROP TRIGGER IF EXISTS quote_request_site_visit_notes_updated_at
  ON public.quote_request_site_visit_notes;
CREATE TRIGGER quote_request_site_visit_notes_updated_at
  BEFORE UPDATE ON public.quote_request_site_visit_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.quote_request_site_visit_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contractors manage own site visit notes"
  ON public.quote_request_site_visit_notes FOR ALL
  USING (
    contractor_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  )
  WITH CHECK (
    contractor_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE TABLE public.quote_request_site_visit_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_request_id uuid NOT NULL REFERENCES public.quote_requests(id) ON DELETE CASCADE,
  contractor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  caption text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_site_visit_photos_request
  ON public.quote_request_site_visit_photos(quote_request_id, display_order);

CREATE INDEX idx_site_visit_photos_contractor
  ON public.quote_request_site_visit_photos(contractor_id);

COMMENT ON TABLE public.quote_request_site_visit_photos IS
  'Photos taken by contractor during site visit — separate from customer uploads.';

ALTER TABLE public.quote_request_site_visit_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contractors manage own site visit photos"
  ON public.quote_request_site_visit_photos FOR ALL
  USING (
    contractor_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  )
  WITH CHECK (
    contractor_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE TABLE public.quote_request_site_visit_voice_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_request_id uuid NOT NULL REFERENCES public.quote_requests(id) ON DELETE CASCADE,
  contractor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  audio_file_path text NOT NULL,
  mime_type text NOT NULL,
  duration_seconds numeric(10, 2),
  transcription text NOT NULL DEFAULT '',
  source text NOT NULL CHECK (source IN ('browser_speech', 'audio_upload')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_site_visit_voice_request
  ON public.quote_request_site_visit_voice_notes(quote_request_id, created_at DESC);

CREATE INDEX idx_site_visit_voice_contractor
  ON public.quote_request_site_visit_voice_notes(contractor_id);

COMMENT ON TABLE public.quote_request_site_visit_voice_notes IS
  'Voice dictation recordings and transcriptions for site visit notes.';

ALTER TABLE public.quote_request_site_visit_voice_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contractors manage own site visit voice notes"
  ON public.quote_request_site_visit_voice_notes FOR ALL
  USING (
    contractor_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  )
  WITH CHECK (
    contractor_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

-- Extend quote-request-attachments bucket for site visit audio
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
  'audio/webm',
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'audio/ogg',
  'audio/x-m4a'
]::text[]
WHERE id = 'quote-request-attachments';

-- Contractor upload/delete for site visit files: {contractorId}/{requestId}/site-visit/...
CREATE POLICY "Contractors upload site visit attachment files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'quote-request-attachments'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
      AND (storage.foldername(name))[1] = p.id::text
      AND (storage.foldername(name))[3] = 'site-visit'
    )
  );

CREATE POLICY "Contractors delete site visit attachment files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'quote-request-attachments'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
      AND (storage.foldername(name))[1] = p.id::text
      AND (storage.foldername(name))[3] = 'site-visit'
    )
  );
