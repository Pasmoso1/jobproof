-- Once-per-account guard for the GA4 signup_verified (Email Verified) event.
-- Set atomically by the app shell right before the browser sends the event
-- (src/lib/ga4-signup-verified-server.ts). Holds a timestamp only; no PII.
--
-- Accounts already confirmed when this migration runs are backfilled so they never
-- emit a late signup_verified. Idempotent: re-running changes nothing.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ga4_signup_verified_sent_at timestamptz;

COMMENT ON COLUMN public.profiles.ga4_signup_verified_sent_at IS
  'When the GA4 signup_verified event was claimed for this account (analytics dedupe only).';

ALTER TABLE public.profiles DISABLE TRIGGER profiles_updated_at;

UPDATE public.profiles p
SET ga4_signup_verified_sent_at = u.email_confirmed_at
FROM auth.users u
WHERE u.id = p.user_id
  AND u.email_confirmed_at IS NOT NULL
  AND p.ga4_signup_verified_sent_at IS NULL;

ALTER TABLE public.profiles ENABLE TRIGGER profiles_updated_at;
