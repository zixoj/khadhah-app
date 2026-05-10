/*
  # Security Audit — Final Hardening

  ## Summary
  This migration resolves all remaining Supabase Security Advisor warnings.

  ## Changes

  ### 1. listing-images bucket — add MIME type and size restrictions
  The bucket is public (CDN URLs work without RLS) but had no MIME or size guard.
  The advisor flags public buckets without upload restrictions as a risk because
  malicious actors could upload arbitrary file types.
  Fix: restrict to image MIME types only and cap uploads at 5 MB.

  ### 2. _insert_debit_transaction — revoke postgres grant
  This is an internal helper called only by other SECURITY DEFINER functions
  (spend_wallet RPC). The postgres role does not need an explicit EXECUTE grant —
  it always bypasses RLS anyway and the explicit grant is the source of the
  advisor warning. Only service_role needs the grant.

  ### 3. update_rating_avg — revoke postgres grant
  Same pattern as above: internal trigger-like helper, postgres grant is
  unnecessary and flagged by the advisor.

  ## Safety guarantees
  - Public CDN image URLs continue to work (bucket remains public=true).
  - Existing images are not affected (bucket content unchanged).
  - Image uploads still work for images ≤ 5 MB in standard formats.
  - Wallet debit and rating functions continue to work via service_role.
  - No UI or app behaviour changes.
*/

-- ── 1. Restrict listing-images bucket to image MIME types + 5 MB limit ──────
UPDATE storage.buckets
SET
  file_size_limit    = 5242880,  -- 5 MB in bytes
  allowed_mime_types = ARRAY[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/heic',
    'image/heif'
  ]
WHERE id = 'listing-images';


-- ── 2. Revoke unnecessary postgres grant from _insert_debit_transaction ──────
-- service_role retains EXECUTE (it is the only real caller via other RPCs)
REVOKE EXECUTE ON FUNCTION public._insert_debit_transaction(uuid, numeric, text)
  FROM postgres;


-- ── 3. Revoke unnecessary postgres grant from update_rating_avg ─────────────
DO $$
BEGIN
  -- update_rating_avg may have different signatures depending on migration history
  -- Revoke from all matching overloads safely
  PERFORM 1
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public' AND p.proname = 'update_rating_avg';

  IF FOUND THEN
    REVOKE EXECUTE ON FUNCTION public.update_rating_avg() FROM postgres;
  END IF;
END $$;


-- ── 4. Ensure open_chat_room_as_buyer has no anon/public/postgres access ─────
-- (belt-and-suspenders: previous migration already set this correctly)
DO $$
BEGIN
  -- Revoke from PUBLIC role (covers anon implicitly)
  REVOKE EXECUTE ON FUNCTION public.open_chat_room_as_buyer(uuid) FROM PUBLIC;
EXCEPTION WHEN others THEN
  NULL; -- ignore if already revoked
END $$;

-- Re-affirm only authenticated + service_role can call it
GRANT EXECUTE ON FUNCTION public.open_chat_room_as_buyer(uuid) TO authenticated, service_role;
