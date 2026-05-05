/*
  # UX Features Migration

  Adds support for:
  1. listings.status — 'available' | 'reserved' | 'taken'
  2. listings.is_urgent — boolean flag, expires after 24h
  3. listings.dual_mode — item is both free AND barter-able
  4. listing_interests — tracks "أنا أبيه" claims (one per user per listing)
  5. barter_offers — exchange proposals with image + description
  6. listing_reports — abuse/spam reporting
  7. Index optimisations

  Security: RLS on all new tables, policies follow ownership rules.
*/

-- 1. Extend listings table
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'available',
  ADD COLUMN IF NOT EXISTS is_urgent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS urgent_until timestamptz,
  ADD COLUMN IF NOT EXISTS dual_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS interest_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reserved_by uuid REFERENCES auth.users(id);

-- 2. listing_interests — first-come-first-served claim
CREATE TABLE IF NOT EXISTS listing_interests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(listing_id, user_id)
);

ALTER TABLE listing_interests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view interests on listings"
  ON listing_interests FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own interest"
  ON listing_interests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own interest"
  ON listing_interests FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 3. barter_offers
CREATE TABLE IF NOT EXISTS barter_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  offerer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  offer_image_url text NOT NULL DEFAULT '',
  offer_description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE barter_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Listing owner and offerer can view offers"
  ON barter_offers FOR SELECT
  TO authenticated
  USING (
    auth.uid() = offerer_id
    OR auth.uid() = (SELECT user_id FROM listings WHERE id = listing_id)
  );

CREATE POLICY "Authenticated users can submit offers"
  ON barter_offers FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = offerer_id);

CREATE POLICY "Listing owner can update offer status"
  ON barter_offers FOR UPDATE
  TO authenticated
  USING (auth.uid() = (SELECT user_id FROM listings WHERE id = listing_id))
  WITH CHECK (auth.uid() = (SELECT user_id FROM listings WHERE id = listing_id));

-- 4. listing_reports
CREATE TABLE IF NOT EXISTS listing_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(listing_id, reporter_id)
);

ALTER TABLE listing_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own report"
  ON listing_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can view their own reports"
  ON listing_reports FOR SELECT
  TO authenticated
  USING (auth.uid() = reporter_id);

-- 5. RPC: claim a free listing (first-claim wins, atomic)
CREATE OR REPLACE FUNCTION claim_listing(p_listing_id uuid, p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_listing listings%ROWTYPE;
  v_interest_id uuid;
BEGIN
  SELECT * INTO v_listing FROM listings WHERE id = p_listing_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'reason', 'not_found');
  END IF;

  IF v_listing.status = 'taken' THEN
    RETURN json_build_object('success', false, 'reason', 'taken');
  END IF;

  -- Insert interest (idempotent via ON CONFLICT)
  INSERT INTO listing_interests (listing_id, user_id)
  VALUES (p_listing_id, p_user_id)
  ON CONFLICT (listing_id, user_id) DO NOTHING
  RETURNING id INTO v_interest_id;

  -- Update interest_count
  UPDATE listings
  SET interest_count = (SELECT COUNT(*) FROM listing_interests WHERE listing_id = p_listing_id),
      status = CASE
        WHEN status = 'available' THEN 'reserved'
        ELSE status
      END,
      reserved_by = CASE
        WHEN reserved_by IS NULL THEN p_user_id
        ELSE reserved_by
      END
  WHERE id = p_listing_id;

  RETURN json_build_object(
    'success', true,
    'is_first', v_interest_id IS NOT NULL,
    'reserved_by', (SELECT reserved_by FROM listings WHERE id = p_listing_id)
  );
END;
$$;

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_is_urgent ON listings(is_urgent);
CREATE INDEX IF NOT EXISTS idx_listing_interests_listing ON listing_interests(listing_id);
CREATE INDEX IF NOT EXISTS idx_barter_offers_listing ON barter_offers(listing_id);
