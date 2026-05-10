/*
  # Allow admin role in profiles

  ## Summary
  Expands the profiles_role_check constraint to include 'admin'.
  This is required to insert the default admin account profile row.

  ## Security
  - The app signup flow already blocks 'admin' role selection at the code level.
  - The constraint expansion here does NOT weaken security — it only permits
    the role to be set from the backend/database, which is the intended path.
*/

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('advertiser', 'delivery_agent', 'admin'));
