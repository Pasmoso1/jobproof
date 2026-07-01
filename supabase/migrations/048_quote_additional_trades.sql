-- Additional trades beyond quote_primary_trade for scope matching and AI context.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS quote_additional_trades text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.profiles
  ADD CONSTRAINT quote_additional_trades_valid CHECK (
    quote_additional_trades <@ ARRAY[
      'Painter',
      'Landscaper',
      'Renovator',
      'Handyman',
      'Roofer',
      'HVAC',
      'Plumber',
      'Electrician',
      'Flooring',
      'Deck/Fence'
    ]::text[]
  );

COMMENT ON COLUMN public.profiles.quote_additional_trades IS
  'Additional trades the contractor performs beyond quote_primary_trade (for scope matching; not shown publicly).';
