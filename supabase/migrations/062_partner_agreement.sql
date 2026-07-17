-- Versioned Partner Program Agreement acceptance.
-- Columns remain nullable so legacy/imported records are visible to admins
-- without being suspended automatically.

ALTER TABLE partner_applications
  ADD COLUMN IF NOT EXISTS agreement_version text,
  ADD COLUMN IF NOT EXISTS agreement_accepted_at timestamptz;

ALTER TABLE partners
  ADD COLUMN IF NOT EXISTS agreement_version text,
  ADD COLUMN IF NOT EXISTS agreement_accepted_at timestamptz;

COMMENT ON COLUMN partner_applications.agreement_version IS
  'Version of the Partner Program Agreement accepted when the application was submitted.';
COMMENT ON COLUMN partner_applications.agreement_accepted_at IS
  'Timestamp when the applicant accepted the versioned Partner Program Agreement.';
COMMENT ON COLUMN partners.agreement_version IS
  'Accepted agreement version copied from the approved application.';
COMMENT ON COLUMN partners.agreement_accepted_at IS
  'Agreement acceptance timestamp copied from the approved application.';
