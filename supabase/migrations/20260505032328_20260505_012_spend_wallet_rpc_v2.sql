/*
  # spend_wallet RPC (replace)

  Drops and recreates spend_wallet with correct return type (json).
  Previous version had a different return type.
*/

DROP FUNCTION IF EXISTS public.spend_wallet(uuid, numeric, text);

CREATE FUNCTION public.spend_wallet(
  p_user_id uuid,
  p_amount   numeric,
  p_desc     text
)
  RETURNS json
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_caller_id uuid;
  v_balance   numeric;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF v_caller_id <> p_user_id THEN
    RETURN json_build_object('success', false, 'reason', 'unauthorized');
  END IF;

  IF p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'reason', 'invalid_amount');
  END IF;

  SELECT wallet_balance INTO v_balance
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'reason', 'profile_not_found');
  END IF;

  IF v_balance < p_amount THEN
    RETURN json_build_object('success', false, 'reason', 'insufficient_balance');
  END IF;

  UPDATE public.profiles
  SET wallet_balance = wallet_balance - p_amount,
      boost_count    = boost_count + 1
  WHERE id = p_user_id;

  INSERT INTO public.wallet_transactions (user_id, amount, type, description)
  VALUES (p_user_id, -p_amount, 'debit', p_desc);

  RETURN json_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.spend_wallet(uuid, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.spend_wallet(uuid, numeric, text) TO authenticated;
