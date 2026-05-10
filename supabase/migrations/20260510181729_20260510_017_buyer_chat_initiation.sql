/*
  # Buyer Chat Initiation

  ## Problem
  The existing `open_chat_room` RPC only allows the **listing owner** to create a chat room.
  Buyers have no way to initiate a direct-contact conversation.

  ## Changes
  1. New RPC `open_chat_room_as_buyer(p_listing_id uuid)` — called by the non-owner (buyer).
     - Creates a chat room where owner_id = listing.user_id, other_user_id = caller.
     - Idempotent: returns existing room if one already exists for this listing+buyer pair.
     - Blocks self-chat (owner cannot chat with themselves via this RPC).
     - Returns {success, room_id, reason}.
  2. Allow authenticated users to INSERT into chat_rooms (the RPC runs as SECURITY DEFINER
     so direct INSERT policy is still restricted — we add a permissive policy scoped to the
     buyer pattern as a fallback for direct inserts from the RPC).

  ## Security
  - Caller must be authenticated.
  - Caller must not be the listing owner.
  - Owner of the listing is always set as owner_id in the chat room.
*/

-- ── 1. New RPC: open_chat_room_as_buyer ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.open_chat_room_as_buyer(p_listing_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id  uuid;
  v_owner_id   uuid;
  v_room_id    uuid;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Get listing owner
  SELECT user_id INTO v_owner_id FROM public.listings WHERE id = p_listing_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'reason', 'listing_not_found');
  END IF;

  -- Prevent self-chat
  IF v_owner_id = v_caller_id THEN
    RETURN json_build_object('success', false, 'reason', 'self_chat');
  END IF;

  -- Upsert: create room if not exists, keyed on (listing_id, other_user_id)
  INSERT INTO public.chat_rooms (listing_id, owner_id, other_user_id)
  VALUES (p_listing_id, v_owner_id, v_caller_id)
  ON CONFLICT (listing_id, other_user_id) DO NOTHING;

  SELECT id INTO v_room_id
  FROM public.chat_rooms
  WHERE listing_id = p_listing_id
    AND other_user_id = v_caller_id;

  RETURN json_build_object('success', true, 'room_id', v_room_id);
END;
$$;

REVOKE ALL ON FUNCTION public.open_chat_room_as_buyer(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_chat_room_as_buyer(uuid) TO authenticated;
