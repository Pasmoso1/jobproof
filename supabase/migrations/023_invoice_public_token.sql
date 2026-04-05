-- Customer-facing invoice links (no auth): unguessable token per invoice

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS public_token uuid,
  ADD COLUMN IF NOT EXISTS viewed_at timestamptz;

UPDATE public.invoices
SET public_token = gen_random_uuid()
WHERE public_token IS NULL;

ALTER TABLE public.invoices
  ALTER COLUMN public_token SET NOT NULL;

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_public_token_key UNIQUE (public_token);

CREATE INDEX IF NOT EXISTS idx_invoices_public_token ON public.invoices (public_token);

COMMENT ON COLUMN public.invoices.public_token IS 'Secret token for /invoice/[token] customer view (no login).';
COMMENT ON COLUMN public.invoices.viewed_at IS 'First time customer opened the public invoice page (optional analytics).';
