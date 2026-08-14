-- Canonical Partner Program types: creator | marketing | organization
-- Backward-compatible: existing rows are remapped; no new partner tables.

COMMENT ON COLUMN partners.partner_type IS
  'Partner type within the JobProof Partner Program: creator, marketing, or organization. Independent of partner_level (founding/standard).';

COMMENT ON COLUMN partner_applications.partner_type IS
  'Requested partner type: creator, marketing, or organization.';

-- Existing organization partners stay organization.
-- Existing individual / influencer / other types default to creator.
-- marketing is preserved if already present.
UPDATE partners
SET partner_type = 'creator'
WHERE partner_type IS DISTINCT FROM 'organization'
  AND partner_type IS DISTINCT FROM 'marketing'
  AND partner_type IS DISTINCT FROM 'creator';

UPDATE partner_applications
SET partner_type = 'creator'
WHERE partner_type IS DISTINCT FROM 'organization'
  AND partner_type IS DISTINCT FROM 'marketing'
  AND partner_type IS DISTINCT FROM 'creator';

-- Structured type-specific application answers (platforms, promotion method, etc.)
ALTER TABLE partner_applications
  ADD COLUMN IF NOT EXISTS profile_details jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS partners_partner_type_idx
  ON partners (partner_type);

CREATE INDEX IF NOT EXISTS partner_applications_partner_type_idx
  ON partner_applications (partner_type);
