-- JobProof Phase 3 Revisions: Change orders as signed amendments, invoice_line_items, etc.

-- =============================================================================
-- 1. REVISE CHANGE_ORDERS table
-- =============================================================================

-- Drop old trigger first
DROP TRIGGER IF EXISTS change_orders_apply_to_job ON public.change_orders;

-- Add new columns (migrate existing data)
ALTER TABLE public.change_orders
  ADD COLUMN IF NOT EXISTS change_title text,
  ADD COLUMN IF NOT EXISTS change_description text,
  ADD COLUMN IF NOT EXISTS reason_for_change text,
  ADD COLUMN IF NOT EXISTS original_contract_price numeric(12, 2),
  ADD COLUMN IF NOT EXISTS change_amount numeric(12, 2),
  ADD COLUMN IF NOT EXISTS revised_total_price numeric(12, 2),
  ADD COLUMN IF NOT EXISTS new_estimated_completion_date date,
  ADD COLUMN IF NOT EXISTS pdf_path text,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS signing_method text CHECK (signing_method IN ('device', 'remote')),
  ADD COLUMN IF NOT EXISTS signer_name text,
  ADD COLUMN IF NOT EXISTS signer_email text,
  ADD COLUMN IF NOT EXISTS signer_phone text,
  ADD COLUMN IF NOT EXISTS signature_image_path text,
  ADD COLUMN IF NOT EXISTS signed_ip_address text,
  ADD COLUMN IF NOT EXISTS signed_user_agent text,
  ADD COLUMN IF NOT EXISTS consent_checkbox_boolean boolean;

-- Migrate description -> change_description, amount -> change_amount
UPDATE public.change_orders SET change_description = description WHERE change_description IS NULL AND description IS NOT NULL;
UPDATE public.change_orders SET change_amount = amount WHERE change_amount IS NULL AND amount IS NOT NULL;
UPDATE public.change_orders SET change_title = COALESCE(LEFT(description, 80), 'Change order') WHERE change_title IS NULL AND description IS NOT NULL;

-- Drop old constraint and add new status values
ALTER TABLE public.change_orders DROP CONSTRAINT IF EXISTS change_orders_status_check;
ALTER TABLE public.change_orders ADD CONSTRAINT change_orders_status_check
  CHECK (status IN ('draft', 'sent', 'signed', 'declined'));

-- Migrate status: approved -> signed, rejected -> declined, pending -> sent (or draft)
UPDATE public.change_orders SET status = 'signed' WHERE status = 'approved';
UPDATE public.change_orders SET status = 'declined' WHERE status = 'rejected';
UPDATE public.change_orders SET status = 'draft' WHERE status = 'pending';

-- Drop old columns
ALTER TABLE public.change_orders DROP COLUMN IF EXISTS approved_at;
ALTER TABLE public.change_orders DROP COLUMN IF EXISTS approved_by_customer_name;
ALTER TABLE public.change_orders DROP COLUMN IF EXISTS description;
ALTER TABLE public.change_orders DROP COLUMN IF EXISTS amount;

-- Set default for new rows
ALTER TABLE public.change_orders ALTER COLUMN status SET DEFAULT 'draft';

-- =============================================================================
-- 2. CHANGE_ORDER_SIGNING_TOKENS table
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.change_order_signing_tokens (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  change_order_id uuid NOT NULL REFERENCES public.change_orders(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_change_order_signing_tokens_token ON public.change_order_signing_tokens(token);
CREATE INDEX IF NOT EXISTS idx_change_order_signing_tokens_change_order_id ON public.change_order_signing_tokens(change_order_id);

ALTER TABLE public.change_order_signing_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage change order tokens for own change orders" ON public.change_order_signing_tokens;
CREATE POLICY "Users can manage change order tokens for own change orders"
  ON public.change_order_signing_tokens FOR ALL
  USING (
    change_order_id IN (
      SELECT co.id FROM public.change_orders co
      JOIN public.profiles p ON co.profile_id = p.id
      WHERE p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    change_order_id IN (
      SELECT co.id FROM public.change_orders co
      JOIN public.profiles p ON co.profile_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

-- =============================================================================
-- 3. Trigger: update job totals only when change order is SIGNED
-- =============================================================================

CREATE OR REPLACE FUNCTION public.apply_change_order_to_job()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'signed' AND (OLD.status IS NULL OR OLD.status != 'signed') THEN
    UPDATE public.jobs j
    SET approved_change_total = COALESCE(j.approved_change_total, 0) + COALESCE(NEW.change_amount, 0),
        current_contract_total = COALESCE(j.original_contract_price, 0) + COALESCE(j.approved_change_total, 0) + COALESCE(NEW.change_amount, 0),
        updated_at = now()
    WHERE j.id = NEW.job_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER change_orders_apply_to_job
  AFTER INSERT OR UPDATE OF status ON public.change_orders
  FOR EACH ROW EXECUTE FUNCTION public.apply_change_order_to_job();

-- =============================================================================
-- 3b. Trigger: prevent edits to signed change orders (except pdf_path/delivery)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.prevent_signed_change_order_edit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'signed' THEN
    -- Allow only pdf_path or signature_image_path to be populated (delivery-related)
    IF (OLD.pdf_path IS NULL AND NEW.pdf_path IS NOT NULL)
       OR (OLD.signature_image_path IS NULL AND NEW.signature_image_path IS NOT NULL) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Cannot modify a signed change order. Signed amendments are immutable.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS change_orders_prevent_signed_edit ON public.change_orders;
CREATE TRIGGER change_orders_prevent_signed_edit
  BEFORE UPDATE ON public.change_orders
  FOR EACH ROW
  WHEN (OLD.status = 'signed')
  EXECUTE FUNCTION public.prevent_signed_change_order_edit();

-- =============================================================================
-- 4. RPC: get change order by signing token
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_change_order_by_signing_token(p_token text)
RETURNS TABLE (
  change_order_id uuid,
  job_id uuid,
  change_title text,
  change_description text,
  reason_for_change text,
  original_contract_price numeric,
  change_amount numeric,
  revised_total_price numeric,
  job_title text,
  customer_name text,
  expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    co.id,
    co.job_id,
    co.change_title,
    co.change_description,
    co.reason_for_change,
    co.original_contract_price,
    co.change_amount,
    co.revised_total_price,
    j.title,
    cust.full_name,
    t.expires_at
  FROM public.change_order_signing_tokens t
  JOIN public.change_orders co ON co.id = t.change_order_id
  JOIN public.jobs j ON j.id = co.job_id
  JOIN public.customers cust ON cust.id = j.customer_id
  WHERE t.token = p_token
    AND t.used_at IS NULL
    AND t.expires_at > now()
    AND co.status = 'sent';
END;
$$;

-- =============================================================================
-- 5. RPC: sign change order remotely
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sign_change_order_remote(
  p_token text,
  p_signer_name text,
  p_signer_email text,
  p_signer_phone text DEFAULT NULL,
  p_consent_checkbox boolean DEFAULT false,
  p_signed_ip_address text DEFAULT NULL,
  p_signed_user_agent text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_token_id uuid;
  v_change_order_id uuid;
  v_job_id uuid;
BEGIN
  SELECT t.id, t.change_order_id INTO v_token_id, v_change_order_id
  FROM public.change_order_signing_tokens t
  JOIN public.change_orders co ON co.id = t.change_order_id
  WHERE t.token = p_token
    AND t.used_at IS NULL
    AND t.expires_at > now()
    AND co.status = 'sent';

  IF v_token_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired signing link');
  END IF;

  SELECT job_id INTO v_job_id FROM public.change_orders WHERE id = v_change_order_id;

  UPDATE public.change_orders
  SET status = 'signed',
      signed_at = now(),
      signer_name = p_signer_name,
      signer_email = p_signer_email,
      signer_phone = p_signer_phone,
      signing_method = 'remote',
      signed_ip_address = p_signed_ip_address,
      signed_user_agent = p_signed_user_agent,
      consent_checkbox_boolean = p_consent_checkbox
  WHERE id = v_change_order_id;

  UPDATE public.change_order_signing_tokens
  SET used_at = now()
  WHERE id = v_token_id;

  RETURN jsonb_build_object('success', true, 'change_order_id', v_change_order_id);
END;
$$;

-- =============================================================================
-- 6. RPC: sign change order on device
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sign_change_order_device(
  p_change_order_id uuid,
  p_signer_name text,
  p_signer_email text,
  p_signer_phone text DEFAULT NULL,
  p_consent_checkbox boolean DEFAULT false,
  p_signed_ip_address text DEFAULT NULL,
  p_signed_user_agent text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_job_id uuid;
  v_profile_id uuid;
BEGIN
  SELECT job_id, profile_id INTO v_job_id, v_profile_id
  FROM public.change_orders
  WHERE id = p_change_order_id
    AND status = 'sent';

  IF v_job_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Change order not found or not ready for signing');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = v_profile_id
    AND p.user_id = auth.uid()
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  UPDATE public.change_orders
  SET status = 'signed',
      signed_at = now(),
      signer_name = p_signer_name,
      signer_email = p_signer_email,
      signer_phone = p_signer_phone,
      signing_method = 'device',
      signed_ip_address = p_signed_ip_address,
      signed_user_agent = p_signed_user_agent,
      consent_checkbox_boolean = p_consent_checkbox
  WHERE id = p_change_order_id;

  RETURN jsonb_build_object('success', true, 'change_order_id', p_change_order_id);
END;
$$;

-- =============================================================================
-- 7. INVOICE_LINE_ITEMS table
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.invoice_line_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  amount numeric(12, 2) NOT NULL,
  quantity numeric(12, 2) NOT NULL DEFAULT 1,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice_id ON public.invoice_line_items(invoice_id);

ALTER TABLE public.invoice_line_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage invoice line items for own invoices" ON public.invoice_line_items;
CREATE POLICY "Users can manage invoice line items for own invoices"
  ON public.invoice_line_items FOR ALL
  USING (
    invoice_id IN (
      SELECT i.id FROM public.invoices i
      JOIN public.profiles p ON i.profile_id = p.id
      WHERE p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    invoice_id IN (
      SELECT i.id FROM public.invoices i
      JOIN public.profiles p ON i.profile_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

-- =============================================================================
-- 8. Migrate existing invoice line_items jsonb to invoice_line_items (optional)
-- =============================================================================

-- Function to migrate: call from app or run manually for existing invoices
-- INSERT INTO invoice_line_items (invoice_id, description, amount, quantity, sort_order)
-- SELECT i.id, (elem->>'description')::text, (elem->>'amount')::numeric, COALESCE((elem->>'quantity')::numeric, 1), ord
-- FROM invoices i, jsonb_array_elements(i.line_items) WITH ORDINALITY arr(elem, ord)
-- WHERE jsonb_array_length(i.line_items) > 0;
