-- JobProof Phase 1.5: Schema alignment for MVP
-- Revises customers, jobs, job_updates, job_update_attachments, storage_usage

-- =============================================================================
-- 1. CUSTOMERS: expand address, rename name, add notes
-- =============================================================================

ALTER TABLE public.customers RENAME COLUMN name TO full_name;

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS address_line_1 text,
  ADD COLUMN IF NOT EXISTS address_line_2 text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS province text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS notes text;

UPDATE public.customers SET address_line_1 = address WHERE address IS NOT NULL;
ALTER TABLE public.customers DROP COLUMN IF EXISTS address;

-- =============================================================================
-- 2. JOBS: expand with property address, pricing, dates, contract fields
-- =============================================================================

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS service_category text,
  ADD COLUMN IF NOT EXISTS property_address_line_1 text,
  ADD COLUMN IF NOT EXISTS property_address_line_2 text,
  ADD COLUMN IF NOT EXISTS property_city text,
  ADD COLUMN IF NOT EXISTS property_province text,
  ADD COLUMN IF NOT EXISTS property_postal_code text,
  ADD COLUMN IF NOT EXISTS estimated_price numeric(12, 2),
  ADD COLUMN IF NOT EXISTS deposit_amount numeric(12, 2),
  ADD COLUMN IF NOT EXISTS tax_rate numeric(5, 4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS estimated_completion_date date,
  ADD COLUMN IF NOT EXISTS actual_completion_date date,
  ADD COLUMN IF NOT EXISTS contract_status text DEFAULT 'none' CHECK (contract_status IN ('none', 'draft', 'pending', 'signed', 'void')),
  ADD COLUMN IF NOT EXISTS invoice_status text DEFAULT 'none' CHECK (invoice_status IN ('none', 'draft', 'sent', 'paid', 'overdue')),
  ADD COLUMN IF NOT EXISTS active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS original_contract_price numeric(12, 2),
  ADD COLUMN IF NOT EXISTS approved_change_total numeric(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_contract_total numeric(12, 2);

-- Migrate address -> property_address_line_1
UPDATE public.jobs SET property_address_line_1 = address WHERE address IS NOT NULL;
-- Migrate price -> original_contract_price and current_contract_total
UPDATE public.jobs
SET original_contract_price = price,
    current_contract_total = price
WHERE price IS NOT NULL AND original_contract_price IS NULL;

ALTER TABLE public.jobs DROP COLUMN IF EXISTS address;
ALTER TABLE public.jobs DROP COLUMN IF EXISTS price;

-- =============================================================================
-- 3. JOB_UPDATES: new category values
-- =============================================================================

ALTER TABLE public.job_updates DROP CONSTRAINT IF EXISTS job_updates_category_check;
-- Migrate existing category values before applying new constraint
UPDATE public.job_updates SET category = 'progress' WHERE category = 'during';
UPDATE public.job_updates SET category = 'completion' WHERE category = 'after';
ALTER TABLE public.job_updates
  ADD CONSTRAINT job_updates_category_check
  CHECK (category IN ('before', 'progress', 'materials', 'issue', 'completion', 'other'));

-- =============================================================================
-- 4. JOB_UPDATE_ATTACHMENTS: expand with metadata
-- =============================================================================

ALTER TABLE public.job_update_attachments
  ADD COLUMN IF NOT EXISTS job_id uuid REFERENCES public.jobs(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS file_type text,
  ADD COLUMN IF NOT EXISTS original_file_name text,
  ADD COLUMN IF NOT EXISTS mime_type text,
  ADD COLUMN IF NOT EXISTS thumbnail_path text,
  ADD COLUMN IF NOT EXISTS uploaded_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS captured_at timestamptz,
  ADD COLUMN IF NOT EXISTS sort_order int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Populate job_id from job_update
UPDATE public.job_update_attachments a
SET job_id = ju.job_id
FROM public.job_updates ju
WHERE a.job_update_id = ju.id AND a.job_id IS NULL;

-- Populate original_file_name from file_name
UPDATE public.job_update_attachments
SET original_file_name = file_name
WHERE original_file_name IS NULL AND file_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_job_update_attachments_job_id ON public.job_update_attachments(job_id);

-- Trigger for updated_at on job_update_attachments
DROP TRIGGER IF EXISTS job_update_attachments_updated_at ON public.job_update_attachments;
CREATE TRIGGER job_update_attachments_updated_at
  BEFORE UPDATE ON public.job_update_attachments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 5. STORAGE_USAGE: add type-specific byte counters
-- =============================================================================

ALTER TABLE public.storage_usage
  ADD COLUMN IF NOT EXISTS photo_bytes_used bigint NOT NULL DEFAULT 0 CHECK (photo_bytes_used >= 0),
  ADD COLUMN IF NOT EXISTS video_bytes_used bigint NOT NULL DEFAULT 0 CHECK (video_bytes_used >= 0),
  ADD COLUMN IF NOT EXISTS document_bytes_used bigint NOT NULL DEFAULT 0 CHECK (document_bytes_used >= 0);
