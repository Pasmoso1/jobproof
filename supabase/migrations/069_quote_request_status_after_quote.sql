-- Data-only backfill: requests whose quote was already delivered no longer need a response.
-- Matches the application lifecycle in src/lib/quote-requests/request-lifecycle.ts:
--   quote sent     -> 'responded' (only from new / reviewed / site_visit_requested)
--   quote accepted -> 'converted' (from any open status; 'closed' is never reopened)
-- Idempotent: re-running changes nothing.

UPDATE public.quote_requests qr
SET status = 'converted'
WHERE qr.status IN ('new', 'reviewed', 'site_visit_requested', 'responded')
  AND EXISTS (
    SELECT 1
    FROM public.estimates e
    WHERE e.quote_request_id = qr.id
      AND e.status = 'accepted'
  );

UPDATE public.quote_requests qr
SET status = 'responded'
WHERE qr.status IN ('new', 'reviewed', 'site_visit_requested')
  AND EXISTS (
    SELECT 1
    FROM public.estimates e
    WHERE e.quote_request_id = qr.id
      AND e.sent_at IS NOT NULL
  );
