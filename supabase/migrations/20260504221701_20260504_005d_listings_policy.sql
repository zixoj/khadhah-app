-- Listings: replace permissive update policy with owner-scoped one
-- Views increment moved to a secure RPC

DROP POLICY IF EXISTS "Users can update own listings" ON listings;

CREATE POLICY "Owners can update own listings"
  ON listings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
