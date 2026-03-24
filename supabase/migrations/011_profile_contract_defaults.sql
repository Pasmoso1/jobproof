-- Optional default text for new contracts (Settings → Business)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS default_contract_payment_terms text,
  ADD COLUMN IF NOT EXISTS default_contract_warranty_note text,
  ADD COLUMN IF NOT EXISTS default_contract_cancellation_note text;
