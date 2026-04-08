-- Allow `partially_paid` on jobs.invoice_status for type alignment (optional future sync).

ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_invoice_status_check;
ALTER TABLE public.jobs ADD CONSTRAINT jobs_invoice_status_check
  CHECK (invoice_status IN ('none', 'draft', 'sent', 'paid', 'overdue', 'partially_paid'));
