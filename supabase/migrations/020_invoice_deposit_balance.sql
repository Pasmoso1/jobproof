-- Invoice: persist deposit credit and balance due for signed-work billing

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS deposit_credited numeric(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_due numeric(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS agreed_work_subtotal numeric(12, 2);

COMMENT ON COLUMN public.invoices.agreed_work_subtotal IS 'Pre-tax amount from signed contract + signed change orders (job.current_contract_total at issue time).';
COMMENT ON COLUMN public.invoices.deposit_credited IS 'Deposit applied against invoice total (subtotal + tax).';
COMMENT ON COLUMN public.invoices.balance_due IS 'Amount owed after deposit: total - deposit_credited.';
