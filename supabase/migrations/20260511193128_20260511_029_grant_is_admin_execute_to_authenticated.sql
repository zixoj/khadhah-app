/*
  # Grant EXECUTE on is_admin() to authenticated and anon roles

  ## Problem
  The is_admin() function only has EXECUTE granted to service_role.
  14 RLS policies call is_admin() — including policies on listings, profiles,
  chat_rooms, chat_messages, and report tables. When an authenticated user
  performs ANY operation that evaluates one of these policies, Postgres throws
  "permission denied for function is_admin" before the policy can return a result.

  This blocks normal users from:
  - Uploading images (storage triggers listing/profile policy evaluation)
  - Creating ads
  - Reading listings
  - Viewing profiles

  ## Fix
  Grant EXECUTE on is_admin() to authenticated and anon.
  The function is already SECURITY DEFINER so it runs as the definer (postgres),
  not as the caller — there is no privilege escalation risk. It simply returns
  true/false based on the caller's uid.

  ## Security
  - is_admin() remains SECURITY DEFINER — safe
  - Normal users calling is_admin() will always get FALSE (unless they are admin)
  - Admin-only RLS policies are still enforced correctly
  - No admin protection is removed
*/

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon;
