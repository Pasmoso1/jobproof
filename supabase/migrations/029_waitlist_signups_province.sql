-- Optional waitlist province (nullable for existing rows). Safe if table is created out-of-band.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'waitlist_signups'
  ) THEN
    ALTER TABLE public.waitlist_signups
      ADD COLUMN IF NOT EXISTS province text;
  END IF;
END $$;
