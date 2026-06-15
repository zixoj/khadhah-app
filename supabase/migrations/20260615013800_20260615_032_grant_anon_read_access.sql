-- ══════════════════════════════════════════════════════════════
-- GUEST ACCESS FIX
-- Root cause: anon role has no table-level SELECT grants, so
-- every guest query fails with "permission denied" even though
-- RLS policies for anon exist.
-- ══════════════════════════════════════════════════════════════

-- ── Tables guests need to READ ──────────────────────────────────

-- Listings (core: browse بدّل and خذها sections + home feed)
GRANT SELECT ON public.listings TO anon;

-- Profiles (listing owner info shown on post-detail page)
GRANT SELECT ON public.profiles TO anon;

-- Post images (listing photo gallery on post-detail page)
GRANT SELECT ON public.post_images TO anon;

-- ── RPCs guests need to EXECUTE ─────────────────────────────────

-- search_listings: allows guests to search listings
GRANT EXECUTE ON FUNCTION public.search_listings TO anon;

-- ── Ensure anon RLS policies exist and are correct ──────────────

-- listings: anon can read non-hidden listings (policy already exists,
-- but verify with explicit DROP+CREATE to ensure correctness)
DROP POLICY IF EXISTS "Anon cannot see hidden listings" ON public.listings;
CREATE POLICY "anon_read_public_listings" ON public.listings
  FOR SELECT TO anon
  USING (is_hidden = false);

-- profiles: anon can read non-hidden profiles (needed for post detail owner card)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
      AND policyname = 'anon_read_public_profiles'
  ) THEN
    CREATE POLICY "anon_read_public_profiles" ON public.profiles
      FOR SELECT TO anon
      USING (is_hidden_from_public = false);
  END IF;
END $$;

-- post_images: anon can read any post image (images are public content)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'post_images'
      AND policyname = 'anon_read_post_images'
  ) THEN
    CREATE POLICY "anon_read_post_images" ON public.post_images
      FOR SELECT TO anon
      USING (true);
  END IF;
END $$;
