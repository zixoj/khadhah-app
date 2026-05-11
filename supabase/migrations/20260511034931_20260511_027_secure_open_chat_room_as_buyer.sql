-- Secure open_chat_room_as_buyer: switch from SECURITY DEFINER to SECURITY INVOKER.
--
-- Previously SECURITY DEFINER was needed because the buyer inserting a chat_room
-- must set owner_id = listing.user_id (not themselves), which failed the old INSERT
-- policy. We solve this by:
--   1. Adding a dedicated, tightly-scoped buyer INSERT policy on chat_rooms.
--   2. Rewriting the function as SECURITY INVOKER with full validation inside.
--   3. Revoking PUBLIC/anon access; only authenticated callers may execute.

-- Drop the old permissive INSERT policy (owner OR other_user allows self-promotion abuse)
DROP POLICY IF EXISTS "Participants can create chat rooms" ON public.chat_rooms;

-- Tighter replacement policies:
-- Owner can create a room for their own listing (they are the owner_id).
CREATE POLICY "Listing owner can open a chat room"
  ON public.chat_rooms FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = owner_id
    AND EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = listing_id
        AND l.user_id = auth.uid()
        AND l.status IN ('available', 'reserved_temp')
        AND l.is_hidden = false
    )
  );

-- Buyer can open a room where they are other_user_id and owner_id is
-- the real listing owner (verified in the sub-select).
CREATE POLICY "Buyer can open a chat room for a listing"
  ON public.chat_rooms FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = other_user_id
    AND auth.uid() <> owner_id
    AND EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = listing_id
        AND l.user_id = owner_id
        AND l.status IN ('available', 'reserved_temp')
        AND l.is_hidden = false
    )
  );

-- Recreate the function as SECURITY INVOKER with full validation.
-- Runs with the caller's privileges; the buyer INSERT policy above allows the write.
CREATE OR REPLACE FUNCTION public.open_chat_room_as_buyer(p_listing_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id  uuid;
  v_listing    public.listings%ROWTYPE;
  v_room_id    uuid;
BEGIN
  -- 1. Caller must be authenticated
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: caller is not authenticated';
  END IF;

  -- 2. Listing must exist; fetch with RLS (SECURITY INVOKER respects caller's RLS)
  SELECT * INTO v_listing
  FROM public.listings
  WHERE id = p_listing_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'reason', 'listing_not_found');
  END IF;

  -- 3. Listing must be active and visible
  IF v_listing.status NOT IN ('available', 'reserved_temp') THEN
    RETURN json_build_object('success', false, 'reason', 'listing_unavailable');
  END IF;

  IF v_listing.is_hidden THEN
    RETURN json_build_object('success', false, 'reason', 'listing_not_found');
  END IF;

  -- 4. Prevent self-chat
  IF v_listing.user_id = v_caller_id THEN
    RETURN json_build_object('success', false, 'reason', 'unauthorized');
  END IF;

  -- 5. Check for existing room (duplicate protection)
  SELECT id INTO v_room_id
  FROM public.chat_rooms
  WHERE listing_id = p_listing_id
    AND other_user_id = v_caller_id;

  IF FOUND THEN
    RETURN json_build_object('success', true, 'room_id', v_room_id, 'reason', 'existing_room');
  END IF;

  -- 6. Create the chat room; RLS buyer policy validates ownership/status server-side
  INSERT INTO public.chat_rooms (listing_id, owner_id, other_user_id)
  VALUES (p_listing_id, v_listing.user_id, v_caller_id)
  RETURNING id INTO v_room_id;

  RETURN json_build_object('success', true, 'room_id', v_room_id, 'reason', 'created');

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'reason', 'error', 'detail', SQLERRM);
END;
$$;

-- Revoke public/anon, grant only authenticated
REVOKE ALL ON FUNCTION public.open_chat_room_as_buyer(uuid) FROM PUBLIC, anon, postgres;
GRANT EXECUTE ON FUNCTION public.open_chat_room_as_buyer(uuid) TO authenticated;
