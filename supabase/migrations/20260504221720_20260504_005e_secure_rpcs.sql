-- Secure RPCs: increment_listing_views, spend_wallet, boost_listing
-- All use SECURITY DEFINER with fixed search_path

-- 1. Increment views safely (any authenticated user, no owner check needed)
CREATE OR REPLACE FUNCTION public.increment_listing_views(p_listing_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.listings
  SET views_count = COALESCE(views_count, 0) + 1
  WHERE id = p_listing_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.increment_listing_views(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.increment_listing_views(uuid) TO authenticated;

-- 2. Debit wallet + log transaction atomically (owner-verified server-side)
CREATE OR REPLACE FUNCTION public.spend_wallet(
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
  IF auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF (SELECT wallet_balance FROM public.profiles WHERE id = p_user_id) < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  UPDATE public.profiles
  SET wallet_balance = wallet_balance - p_amount
  WHERE id = p_user_id;

  INSERT INTO public.wallet_transactions(user_id, amount, type, description)
  VALUES (p_user_id, -p_amount, 'debit', p_desc);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.spend_wallet(uuid, numeric, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.spend_wallet(uuid, numeric, text) TO authenticated;

-- 3. Boost listing: debit wallet + mark listing boosted atomically
CREATE OR REPLACE FUNCTION public.boost_listing(p_listing_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_cost    numeric := 5;
BEGIN
  v_user_id := auth.uid();

  IF (SELECT wallet_balance FROM public.profiles WHERE id = v_user_id) < v_cost THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  UPDATE public.profiles
  SET wallet_balance = wallet_balance - v_cost,
      boost_count    = COALESCE(boost_count, 0) + 1
  WHERE id = v_user_id;

  INSERT INTO public.wallet_transactions(user_id, amount, type, description)
  VALUES (v_user_id, -v_cost, 'debit', 'شراء بوست لتمييز إعلان');

  UPDATE public.listings
  SET is_boosted    = true,
      boosted_until = now() + interval '7 days'
  WHERE id = p_listing_id AND user_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Listing not found or not owned by caller';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.boost_listing(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.boost_listing(uuid) TO authenticated;
