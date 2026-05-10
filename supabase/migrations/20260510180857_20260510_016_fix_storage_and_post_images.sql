/*
  # Fix storage bucket visibility and post_images policies

  1. Changes
    - Make `listing-images` bucket public so uploaded images render correctly
    - Drop the broken post_images INSERT policy (references nonexistent `posts` table)
    - Re-create correct post_images RLS policies referencing `listings` table
    - Add SELECT, INSERT, DELETE policies for post_images

  2. Security
    - Authenticated users can view all post images
    - Only listing owners can insert/delete their images (verified via listings.user_id)
*/

-- Make the listing-images bucket public so getPublicUrl works
UPDATE storage.buckets SET public = true WHERE id = 'listing-images';

-- ── post_images policies ─────────────────────────────────────────────────────

-- Drop existing broken policies
DROP POLICY IF EXISTS "Authenticated users can view post images" ON public.post_images;
DROP POLICY IF EXISTS "Post owner can insert images" ON public.post_images;
DROP POLICY IF EXISTS "Post owner can delete images" ON public.post_images;

-- Re-enable RLS (safe no-op if already enabled)
ALTER TABLE public.post_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view post images"
  ON public.post_images FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Listing owner can insert post images"
  ON public.post_images FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.listings
      WHERE listings.id = post_images.post_id
        AND listings.user_id = auth.uid()
    )
  );

CREATE POLICY "Listing owner can delete post images"
  ON public.post_images FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.listings
      WHERE listings.id = post_images.post_id
        AND listings.user_id = auth.uid()
    )
  );
