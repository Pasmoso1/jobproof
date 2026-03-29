ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS e_transfer_email text;

COMMENT ON COLUMN public.profiles.e_transfer_email IS 'Interac e-Transfer receiving address shown on invoices and payment instructions.';
