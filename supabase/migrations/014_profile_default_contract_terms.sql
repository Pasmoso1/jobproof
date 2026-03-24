-- Default "Terms and conditions" text for new contract drafts (Settings → Business)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS default_contract_terms_and_conditions text;
