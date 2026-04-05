-- Business contact email for invoices / customer-facing pages (separate from login email)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS business_contact_email text;

COMMENT ON COLUMN public.profiles.business_contact_email IS
  'Contractor email shown on invoices, PDFs, and public invoice page; falls back to auth email in app when null.';

-- Backfill from Supabase Auth for existing profiles (no login email change)
UPDATE public.profiles p
SET business_contact_email = u.email
FROM auth.users u
WHERE p.user_id = u.id
  AND u.email IS NOT NULL
  AND btrim(u.email) <> ''
  AND (
    p.business_contact_email IS NULL
    OR btrim(p.business_contact_email) = ''
  );
