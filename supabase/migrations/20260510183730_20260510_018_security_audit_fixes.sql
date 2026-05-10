/*
  # Security Audit Fixes

  ## Issues addressed

  ### 1. Storage bucket — broad SELECT/list policy
  The policy "Authenticated users can view listing images" uses USING (bucket_id = 'listing-images')
  with no path constraint. This allows any authenticated user to enumerate (list) ALL files in the
  bucket, which is a data-exposure risk.

  Fix: Drop the broad SELECT policy. The bucket is already marked `public = true`, so Supabase
  generates public URLs that work without any RLS check — images continue to display in listings.
  Authenticated users who need to access their own files can do so via the owner-scoped policies.
  We add a narrower SELECT policy that allows reading only specific objects in a user's own folder,
  to support any signed-URL / authenticated read flows.

  ### 2. open_chat_room_as_buyer — SECURITY DEFINER hardening
  - Add check: listing must exist AND have status 'available' or 'reserved_temp'
    (cannot open chat on taken/closed listings).
  - Revoke EXECUTE from postgres (superuser always bypasses RLS anyway, but the explicit grant
    is unnecessary and triggers the audit warning).
  - Re-grant only to `authenticated`.
  - search_path is already set to 'public, pg_temp' — keep it.

  ## Safety guarantees
  - Public image URLs (storage.objects public bucket) continue to work — no RLS needed for those.
  - Users can still upload to their own folder (INSERT policy unchanged).
  - Chat initiation from "تواصل مباشر" continues to work for available listings.
  - Taken/fully-reserved listings will return {success: false, reason: 'listing_unavailable'}.
*/

-- ── 1. Drop the broad SELECT policy on listing-images ────────────────────────
DROP POLICY IF EXISTS "Authenticated users can view listing images" ON storage.objects;

-- Replace with a narrow policy: users can only SELECT objects within their own folder.
-- Public bucket URLs bypass RLS entirely, so this does not break image display.
CREATE POLICY "Users can read own folder objects"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'listing-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );


-- ── 2. Harden open_chat_room_as_buyer ────────────────────────────────────────

-- Revoke from postgres (audit noise; superuser doesn't need an explicit grant)
REVOKE EXECUTE ON FUNCTION public.open_chat_room_as_buyer(uuid) FROM postgres;

-- Re-create with added listing-status guard
CREATE OR REPLACE FUNCTION public.open_chat_room_as_buyer(p_listing_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id  uuid;
  v_listing    public.listings%ROWTYPE;
  v_room_id    uuid;
BEGIN
  -- 1. Must be authenticated
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- 2. Listing must exist and be active
  SELECT * INTO v_listing
  FROM public.listings
  WHERE id = p_listing_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'reason', 'listing_not_found');
  END IF;

  IF v_listing.status NOT IN ('available', 'reserved_temp') THEN
    RETURN json_build_object('success', false, 'reason', 'listing_unavailable');
  END IF;

  -- 3. Cannot chat with yourself
  IF v_listing.user_id = v_caller_id THEN
    RETURN json_build_object('success', false, 'reason', 'self_chat');
  END IF;

  -- 4. Upsert chat room (idempotent)
  INSERT INTO public.chat_rooms (listing_id, owner_id, other_user_id)
  VALUES (p_listing_id, v_listing.user_id, v_caller_id)
  ON CONFLICT (listing_id, other_user_id) DO NOTHING;

  SELECT id INTO v_room_id
  FROM public.chat_rooms
  WHERE listing_id = p_listing_id
    AND other_user_id = v_caller_id;

  RETURN json_build_object('success', true, 'room_id', v_room_id);
END;
$$;

-- Ensure only authenticated users can call this function
REVOKE ALL ON FUNCTION public.open_chat_room_as_buyer(uuid) FROM PUBLIC, anon, postgres;
GRANT EXECUTE ON FUNCTION public.open_chat_room_as_buyer(uuid) TO authenticated;
