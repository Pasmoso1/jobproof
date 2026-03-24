-- How the change order was first sent for approval (for list/detail clarity)
ALTER TABLE public.change_orders
  ADD COLUMN IF NOT EXISTS sent_delivery_method text;

ALTER TABLE public.change_orders DROP CONSTRAINT IF EXISTS change_orders_sent_delivery_method_check;
ALTER TABLE public.change_orders ADD CONSTRAINT change_orders_sent_delivery_method_check
  CHECK (sent_delivery_method IS NULL OR sent_delivery_method IN ('email', 'device'));

COMMENT ON COLUMN public.change_orders.sent_delivery_method IS 'email | device — set when status becomes sent';

-- Block content edits while awaiting approval; allow withdraw (sent→draft), sign, decline
CREATE OR REPLACE FUNCTION public.prevent_change_order_sent_content_edit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'sent' THEN
    IF NEW.status IN ('draft', 'signed', 'declined') THEN
      RETURN NEW;
    END IF;
    IF NEW.status = 'sent' THEN
      IF (
        NEW.change_title IS DISTINCT FROM OLD.change_title OR
        NEW.change_description IS DISTINCT FROM OLD.change_description OR
        NEW.reason_for_change IS DISTINCT FROM OLD.reason_for_change OR
        NEW.original_contract_price IS DISTINCT FROM OLD.original_contract_price OR
        NEW.change_amount IS DISTINCT FROM OLD.change_amount OR
        NEW.revised_total_price IS DISTINCT FROM OLD.revised_total_price OR
        NEW.new_estimated_start_date IS DISTINCT FROM OLD.new_estimated_start_date OR
        NEW.new_estimated_completion_date IS DISTINCT FROM OLD.new_estimated_completion_date OR
        NEW.sent_delivery_method IS DISTINCT FROM OLD.sent_delivery_method OR
        NEW.sent_at IS DISTINCT FROM OLD.sent_at OR
        NEW.job_id IS DISTINCT FROM OLD.job_id OR
        NEW.profile_id IS DISTINCT FROM OLD.profile_id
      ) THEN
        RAISE EXCEPTION 'Cannot edit a change order that was sent for approval. Move it back to draft first.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS change_orders_prevent_sent_content_edit ON public.change_orders;
CREATE TRIGGER change_orders_prevent_sent_content_edit
  BEFORE UPDATE ON public.change_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_change_order_sent_content_edit();

