-- Estimated start date for change orders (required in app for new submissions)

ALTER TABLE public.change_orders
  ADD COLUMN IF NOT EXISTS new_estimated_start_date date;
