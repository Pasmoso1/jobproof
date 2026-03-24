-- Job attachments storage bucket
-- Bucket is private; access via RLS and signed URLs

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'job-attachments',
  'job-attachments',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;

-- RLS: Users can upload to their own profile folder (path: profile_id/job_id/filename)
CREATE POLICY "Users can upload to own job attachments"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'job-attachments'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
    AND (storage.foldername(name))[1] = p.id::text
  )
);

-- RLS: Users can read their own attachments (via profile ownership of job)
CREATE POLICY "Users can read own job attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'job-attachments'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
    AND (storage.foldername(name))[1] = p.id::text
  )
);

-- RLS: Users can delete their own attachments
CREATE POLICY "Users can delete own job attachments"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'job-attachments'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
    AND (storage.foldername(name))[1] = p.id::text
  )
);
