-- Custom primary trade label when quote_primary_trade = 'Other'
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS quote_primary_trade_other text;

COMMENT ON COLUMN public.profiles.quote_primary_trade_other IS
  'Custom trade label when quote_primary_trade is Other (for AI/pricing features).';
