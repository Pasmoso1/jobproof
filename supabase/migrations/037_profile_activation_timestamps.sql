-- First-use / onboarding milestone timestamps (set once per profile).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_job_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_job_update_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_contract_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_invoice_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_payment_recorded_at timestamptz,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

COMMENT ON COLUMN public.profiles.onboarding_started_at IS 'First time contractor engaged with onboarding (panel or CTA).';
COMMENT ON COLUMN public.profiles.first_job_created_at IS 'First job created (activation cohort).';
COMMENT ON COLUMN public.profiles.first_job_update_at IS 'First proof update / photo on any job.';
COMMENT ON COLUMN public.profiles.first_contract_sent_at IS 'First contract sent for signature.';
COMMENT ON COLUMN public.profiles.first_invoice_sent_at IS 'First invoice emailed to customer.';
COMMENT ON COLUMN public.profiles.first_payment_recorded_at IS 'First manual or tracked invoice payment.';
COMMENT ON COLUMN public.profiles.onboarding_completed_at IS 'Job + proof + (contract OR invoice) milestone.';
