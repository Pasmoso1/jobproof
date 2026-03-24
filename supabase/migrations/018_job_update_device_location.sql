-- Optional device-reported location for a job update (MVP: in-app camera photo sets only; app-enforced)
ALTER TABLE public.job_updates
  ADD COLUMN IF NOT EXISTS location_latitude double precision,
  ADD COLUMN IF NOT EXISTS location_longitude double precision,
  ADD COLUMN IF NOT EXISTS location_accuracy_meters double precision,
  ADD COLUMN IF NOT EXISTS location_captured_at timestamptz,
  ADD COLUMN IF NOT EXISTS location_source text;

ALTER TABLE public.job_updates
  DROP CONSTRAINT IF EXISTS job_updates_location_source_check;

ALTER TABLE public.job_updates
  ADD CONSTRAINT job_updates_location_source_check
  CHECK (location_source IS NULL OR location_source = 'device_current');

COMMENT ON COLUMN public.job_updates.location_latitude IS 'Device-reported latitude when contractor opted in; not proof of where photos were taken.';
COMMENT ON COLUMN public.job_updates.location_longitude IS 'Device-reported longitude when contractor opted in.';
COMMENT ON COLUMN public.job_updates.location_accuracy_meters IS 'Geolocation API accuracy in meters, if available.';
COMMENT ON COLUMN public.job_updates.location_captured_at IS 'When the device position was read.';
COMMENT ON COLUMN public.job_updates.location_source IS 'device_current = in-app prompt after camera capture; NULL = no location stored.';
