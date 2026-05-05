/*
  # Chat System

  Adds real-time in-app chat between a listing owner and an interested user.

  ## New Tables
  - `chat_rooms`
    - `id` (uuid, pk)
    - `listing_id` (uuid → listings)
    - `owner_id` (uuid → auth.users) — the listing owner
    - `other_user_id` (uuid → auth.users) — the interested party
    - `created_at`
    - UNIQUE(listing_id, other_user_id) — one room per (listing, interested user) pair

  - `chat_messages`
    - `id` (uuid, pk)
    - `room_id` (uuid → chat_rooms)
    - `sender_id` (uuid → auth.users)
    - `content` (text, non-empty)
    - `created_at`
    - Index on (room_id, created_at) for efficient message loading

  ## New Function
  - `open_chat_room(p_listing_id uuid, p_other_user_id uuid) → json`
      SECURITY DEFINER, called by the listing owner to open a room when accepting
      a barter offer, or auto-created when a reservation is confirmed.
      Returns `{ room_id }`.

  ## Security
  - RLS enabled on both tables
  - chat_rooms: only owner_id or other_user_id may SELECT/INSERT/DELETE
  - chat_messages: only the two participants may SELECT; only the sender may INSERT
  - open_chat_room: REVOKE from PUBLIC, GRANT to authenticated
*/

-- ─── chat_rooms ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.chat_rooms (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id     uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  owner_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  other_user_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_id, other_user_id)
);

ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view their chat rooms"
  ON public.chat_rooms FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id OR auth.uid() = other_user_id);

CREATE POLICY "Participants can create chat rooms"
  ON public.chat_rooms FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id OR auth.uid() = other_user_id);

CREATE POLICY "Participants can delete their chat rooms"
  ON public.chat_rooms FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id OR auth.uid() = other_user_id);

-- ─── chat_messages ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id    uuid NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  sender_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content    text NOT NULL CHECK (char_length(trim(content)) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_messages_room_created
  ON public.chat_messages (room_id, created_at);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can read messages in their rooms"
  ON public.chat_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_rooms cr
      WHERE cr.id = room_id
        AND (cr.owner_id = auth.uid() OR cr.other_user_id = auth.uid())
    )
  );

CREATE POLICY "Participants can send messages in their rooms"
  ON public.chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.chat_rooms cr
      WHERE cr.id = room_id
        AND (cr.owner_id = auth.uid() OR cr.other_user_id = auth.uid())
    )
  );

-- ─── open_chat_room RPC ──────────────────────────────────────────────────────
-- Called by the listing owner to open (or return existing) chat room with a
-- specific user. Used when accepting a barter offer.

CREATE OR REPLACE FUNCTION public.open_chat_room(
  p_listing_id   uuid,
  p_other_user_id uuid
)
  RETURNS json
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_caller_id  uuid;
  v_listing    public.listings%ROWTYPE;
  v_room_id    uuid;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_listing FROM public.listings WHERE id = p_listing_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'reason', 'listing_not_found');
  END IF;

  -- Only the listing owner may call this function
  IF v_listing.user_id != v_caller_id THEN
    RETURN json_build_object('success', false, 'reason', 'not_owner');
  END IF;

  -- Cannot open a room with yourself
  IF p_other_user_id = v_caller_id THEN
    RETURN json_build_object('success', false, 'reason', 'self_chat');
  END IF;

  -- Upsert: return existing room or create new one
  INSERT INTO public.chat_rooms (listing_id, owner_id, other_user_id)
  VALUES (p_listing_id, v_caller_id, p_other_user_id)
  ON CONFLICT (listing_id, other_user_id) DO NOTHING;

  SELECT id INTO v_room_id
  FROM public.chat_rooms
  WHERE listing_id = p_listing_id AND other_user_id = p_other_user_id;

  RETURN json_build_object('success', true, 'room_id', v_room_id);
END;
$$;

REVOKE ALL ON FUNCTION public.open_chat_room(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.open_chat_room(uuid, uuid) TO authenticated;

-- ─── open_chat_room_as_interested RPC ────────────────────────────────────────
-- Called by the interested user (claimer / reserver) to open their chat room
-- with the listing owner. Only succeeds if a chat_room already exists where
-- they are other_user_id (owner must have opened it first via accept).

CREATE OR REPLACE FUNCTION public.get_my_chat_room(
  p_listing_id uuid
)
  RETURNS json
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_caller_id uuid;
  v_room_id   uuid;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT id INTO v_room_id
  FROM public.chat_rooms
  WHERE listing_id = p_listing_id
    AND (owner_id = v_caller_id OR other_user_id = v_caller_id);

  IF v_room_id IS NULL THEN
    RETURN json_build_object('found', false);
  END IF;

  RETURN json_build_object('found', true, 'room_id', v_room_id);
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_chat_room(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_chat_room(uuid) TO authenticated;
