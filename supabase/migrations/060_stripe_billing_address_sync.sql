-- Stripe Tax: track JobProof → Stripe Customer billing address sync status.
-- Does not store tax amounts (Stripe remains the ledger).

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_billing_address_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_billing_address_sync_error text;

COMMENT ON COLUMN profiles.stripe_billing_address_synced_at IS
  'Last successful push of business/billing address to Stripe Customer for subscription tax.';
COMMENT ON COLUMN profiles.stripe_billing_address_sync_error IS
  'Last Stripe Customer address sync error message (non-sensitive); cleared on success.';
