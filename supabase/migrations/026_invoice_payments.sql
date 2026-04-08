-- Contractor-recorded payments toward invoices (partial or full). Deposit is not stored as a payment row.

CREATE TABLE public.invoice_payments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount numeric(12, 2) NOT NULL,
  paid_on date NOT NULL,
  payment_method text NOT NULL CHECK (payment_method IN ('e_transfer', 'cash', 'cheque', 'card', 'other')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invoice_payments_amount_positive CHECK (amount > 0)
);

CREATE INDEX idx_invoice_payments_invoice_id ON public.invoice_payments(invoice_id);
CREATE INDEX idx_invoice_payments_profile_id ON public.invoice_payments(profile_id);

ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'partially_paid'));

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS amount_paid_total numeric(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS last_payment_at timestamptz;

COMMENT ON COLUMN public.invoices.amount_paid_total IS 'Sum of contractor-recorded payments (excludes deposit_credited).';
COMMENT ON COLUMN public.invoices.balance_due IS 'Remaining balance owed: total - deposit_credited - amount_paid_total.';

-- Legacy rows marked paid: assume full balance was satisfied.
UPDATE public.invoices
SET
  amount_paid_total = GREATEST(0, total - COALESCE(deposit_credited, 0)),
  balance_due = 0
WHERE status = 'paid';

ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own invoice payments"
  ON public.invoice_payments FOR ALL
  USING (
    profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  )
  WITH CHECK (
    profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );
