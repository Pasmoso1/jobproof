-- Optional contractor-described services beyond primary trade (quote scope matching)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS contractor_extra_capabilities text;

COMMENT ON COLUMN public.profiles.contractor_extra_capabilities IS
  'Optional free-text list of additional services the contractor offers; used for quote scope matching';
