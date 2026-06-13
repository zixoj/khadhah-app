-- Backfill: listings with dual_mode=true but no clear type should stay as their
-- original type. We keep the type column as the single source of truth.
-- Existing listings with type='free' and dual_mode=true: leave type='free' (they
-- will only appear in خذها going forward).
-- Existing listings with type='exchange' and dual_mode=true: leave type='exchange'
-- (they will only appear in بدّل going forward).
-- This migration just ensures dual_mode doesn't drive queries anymore.

-- For any listings that somehow have null type, default to 'free'
UPDATE listings
SET type = 'free'
WHERE type IS NULL;

-- Ensure type column has a NOT NULL constraint and valid values
-- (it already should, but be explicit)
ALTER TABLE listings
  ALTER COLUMN type SET NOT NULL,
  ALTER COLUMN type SET DEFAULT 'free';

-- Add a check constraint so only valid values can be inserted
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'listings_type_check'
  ) THEN
    ALTER TABLE listings
      ADD CONSTRAINT listings_type_check
      CHECK (type IN ('exchange', 'free'));
  END IF;
END $$;
