-- Convert callable RPCs to SECURITY INVOKER + revoke anon + add validation

-- ─────────────────────────────────────────
-- 1. increment_listing_views
--    SECURITY INVOKER: runs as calling user.
--    The caller must be authenticated (enforced by GRANT below).
--    Anti-spam: one view per user per listing per hour, tracked in a
--    lightweight table. Owner views do NOT count.
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS listing_view_log (
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL,
  viewed_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, listing_id)
);

ALTER TABLE listing_view_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own view log"
  ON listing_view_log FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.increment_listing_views(p_listing_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id    uuid;
  v_last_view  timestamptz;
  v_owner_id   uuid;
BEGIN
  v_user_id := auth.uid();

  -- Reject unauthenticated callers
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Get listing owner
  SELECT user_id INTO v_owner_id
  FROM public.listings
  WHERE id = p_listing_id;

  IF NOT FOUND THEN
    RETURN; -- listing doesn't exist, silently ignore
  END IF;

  -- Owner views don't inflate their own count
  IF v_owner_id = v_user_id THEN
    RETURN;
  END IF;

  -- Anti-spam: check if this user already viewed in the last hour
  SELECT viewed_at INTO v_last_view
  FROM public.listing_view_log
  WHERE user_id = v_user_id AND listing_id = p_listing_id;

  IF FOUND AND v_last_view > now() - interval '1 hour' THEN
    RETURN; -- too soon, skip silently
  END IF;

  -- Upsert the view log timestamp
  INSERT INTO public.listing_view_log (user_id, listing_id, viewed_at)
  VALUES (v_user_id, p_listing_id, now())
  ON CONFLICT (user_id, listing_id)
  DO UPDATE SET viewed_at = now();

  -- Increment the counter
  UPDATE public.listings
  SET views_count = COALESCE(views_count, 0) + 1
  WHERE id = p_listing_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.increment_listing_views(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.increment_listing_views(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.increment_listing_views(uuid) TO authenticated;

-- ─────────────────────────────────────────
-- 2. spend_wallet
--    SECURITY INVOKER: runs as calling user.
--    RLS on profiles + wallet_transactions already scopes to owner,
--    so no extra privilege needed. Keeps validation for safety.
-- ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.spend_wallet(
  p_user_id uuid,
  p_amount  numeric,
  p_desc    text
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_balance numeric;
BEGIN
  -- Caller must be authenticated and must be the account owner
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: you can only spend your own balance';
  END IF;

  -- Validate amount
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  -- Check balance with row lock to prevent double-spend
  SELECT wallet_balance INTO v_balance
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance: have %, need %', v_balance, p_amount;
  END IF;

  UPDATE public.profiles
  SET wallet_balance = wallet_balance - p_amount
  WHERE id = p_user_id;

  -- wallet_transactions RLS only allows credits from client;
  -- this function runs as the user (INVOKER) so we bypass by
  -- inserting via a helper that runs as definer for this one insert.
  -- Instead, we directly call the debit insert here — INVOKER means
  -- the INSERT runs as the authenticated user. RLS blocks client
  -- direct debits, but function calls go through normal permission
  -- checks on the role. We need to allow this path.
  -- Solution: insert via a minimal SECURITY DEFINER helper.
  PERFORM public._insert_debit_transaction(p_user_id, p_amount, p_desc);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.spend_wallet(uuid, numeric, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.spend_wallet(uuid, numeric, text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.spend_wallet(uuid, numeric, text) TO authenticated;

-- ─────────────────────────────────────────
-- Internal helper: insert a debit transaction row.
-- SECURITY DEFINER so it can bypass the client-facing RLS that
-- blocks direct debit inserts. Only callable from spend_wallet/boost_listing.
-- Revoked from all end-user roles.
-- ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public._insert_debit_transaction(
  p_user_id uuid,
  p_amount  numeric,
  p_desc    text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.wallet_transactions(user_id, amount, type, description)
  VALUES (p_user_id, -p_amount, 'debit', p_desc);
END;
$$;

-- Completely private — no end-user role can call this directly
REVOKE EXECUTE ON FUNCTION public._insert_debit_transaction(uuid, numeric, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._insert_debit_transaction(uuid, numeric, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public._insert_debit_transaction(uuid, numeric, text) FROM authenticated;

-- ─────────────────────────────────────────
-- 3. boost_listing
--    SECURITY INVOKER: runs as calling user.
--    Owner check is redundant (RLS enforces it) but kept for clarity.
-- ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.boost_listing(p_listing_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_cost    numeric := 5;
  v_balance numeric;
  v_owner   uuid;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Verify listing exists and caller is the owner
  SELECT user_id INTO v_owner
  FROM public.listings
  WHERE id = p_listing_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Listing not found';
  END IF;

  IF v_owner <> v_user_id THEN
    RAISE EXCEPTION 'Unauthorized: only the listing owner can boost';
  END IF;

  -- Check and lock balance row to prevent race conditions
  SELECT wallet_balance INTO v_balance
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF v_balance < v_cost THEN
    RAISE EXCEPTION 'Insufficient balance: have %, need %', v_balance, v_cost;
  END IF;

  -- Deduct balance and increment boost_count
  UPDATE public.profiles
  SET wallet_balance = wallet_balance - v_cost,
      boost_count    = COALESCE(boost_count, 0) + 1
  WHERE id = v_user_id;

  -- Record debit via internal helper (bypasses client RLS on wallet_transactions)
  PERFORM public._insert_debit_transaction(v_user_id, v_cost, 'شراء بوست لتمييز إعلان');

  -- Mark listing as boosted (RLS owner check enforced automatically)
  UPDATE public.listings
  SET is_boosted    = true,
      boosted_until = now() + interval '7 days'
  WHERE id = p_listing_id AND user_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Listing update failed: ownership check did not pass';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.boost_listing(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.boost_listing(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.boost_listing(uuid) TO authenticated;
