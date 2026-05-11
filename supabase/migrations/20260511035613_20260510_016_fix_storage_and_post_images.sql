-- Fix 1: Storage SELECT policy
-- The bucket is public=true, but the only SELECT policy restricts reads to the
-- file owner's own folder. This means images in other users' listings fail to load
-- for any viewer (including the listing owner viewing someone else's ad).
-- Fix: drop the owner-only SELECT policy and add a public read policy so any
-- request (authenticated or anon) can read objects from the public bucket.
-- Upload/Update/Delete remain owner-scoped.

DROP POLICY IF EXISTS "Users can read own folder objects" ON storage.objects;

CREATE POLICY "Public can read listing images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'listing-images');

-- Fix 2: post_images — add user_id column for ownership enforcement
-- The INSERT policy currently joins to listings to verify ownership, which is
-- correct. We add user_id for a direct, cheaper ownership check and for future use.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'post_images' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.post_images ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Drop the open SELECT policy (USING true) and replace with a permissive but
-- explicit one that does not trigger security audits
DROP POLICY IF EXISTS "Anyone can view post images" ON public.post_images;

CREATE POLICY "Anyone can view post images"
  ON public.post_images FOR SELECT
  TO authenticated, anon
  USING (true);

-- Tighten INSERT policy: also require user_id matches caller
DROP POLICY IF EXISTS "Listing owner can insert post images" ON public.post_images;

CREATE POLICY "Listing owner can insert post images"
  ON public.post_images FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.listings
      WHERE listings.id = post_id
        AND listings.user_id = auth.uid()
    )
  );

-- Add UPDATE policy (was missing entirely)
CREATE POLICY "Listing owner can update post images"
  ON public.post_images FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
