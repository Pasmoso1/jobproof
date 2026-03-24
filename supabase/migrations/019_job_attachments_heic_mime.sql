-- Allow iOS / mobile camera HEIC uploads (bucket MIME allow-list)
UPDATE storage.buckets
SET allowed_mime_types = ARRAY(
  SELECT DISTINCT unnest(
    COALESCE(allowed_mime_types, ARRAY[]::text[])
      || ARRAY[
        'image/heic'::text,
        'image/heif'::text
      ]
  )
)
WHERE id = 'job-attachments';
