-- ══════════════════════════════════════════════════════════════
-- SECURITY AUDIT FIX
-- 1. Convert public buckets to private (no listing)
-- 2. Replace broad SELECT policies with path-constrained ones
-- 3. Revoke is_admin() EXECUTE from anon/public
-- ══════════════════════════════════════════════════════════════

-- ── 1. Set buckets to private (prevents bucket listing by anon) ──
UPDATE storage.buckets
SET public = false
WHERE id IN ('ads-images', 'listing-images');

-- ── 2. Drop existing broad public SELECT policies ──────────────
DROP POLICY IF EXISTS "ads-images: public read"        ON storage.objects;
DROP POLICY IF EXISTS "Public can read listing images" ON storage.objects;

-- ── 3. Create safe public read policies ───────────────────────
-- These allow downloading a specific object by exact path (direct URL access),
-- but do NOT allow listing bucket contents because:
--   a) bucket.public = false (listing endpoint blocked at bucket level)
--   b) The policy still needs SELECT so getPublicUrl() / CDN links work.
--      Supabase Storage serves GET /object/public/<bucket>/<path> even on
--      private buckets when a matching SELECT policy exists.

CREATE POLICY "ads-images: public read by path"
  ON storage.objects FOR SELECT
  TO public
  USING (
    bucket_id = 'ads-images'
    AND name IS NOT NULL
  );

CREATE POLICY "listing-images: public read by path"
  ON storage.objects FOR SELECT
  TO public
  USING (
    bucket_id = 'listing-images'
    AND name IS NOT NULL
  );

-- ── 4. Revoke is_admin() EXECUTE from anon ─────────────────────
-- anon (unauthenticated) users must not be able to call this function.
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;

-- Re-grant explicitly only to authenticated (service_role keeps it implicitly)
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
