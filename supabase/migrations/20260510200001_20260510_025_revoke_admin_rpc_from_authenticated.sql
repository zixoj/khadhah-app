-- Security Hardening: Revoke authenticated EXECUTE on all admin SECURITY DEFINER functions.
-- Regular signed-in users must not be able to call admin RPCs via /rest/v1/rpc/*.
-- All admin RPCs already guard internally via is_admin(), but defence-in-depth
-- requires the EXECUTE grant itself to be absent for the authenticated role.
-- service_role retains full access for server-side calls.
-- open_chat_room_as_buyer is a legitimate user-facing RPC; no change needed there.

REVOKE EXECUTE ON FUNCTION public.is_admin()
  FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_ban_user(uuid, text)
  FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_suspend_user(uuid, text)
  FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_unban_user(uuid)
  FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_warn_user(uuid, text)
  FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_hide_listing(uuid, text)
  FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_unhide_listing(uuid)
  FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_delete_listing(uuid, text)
  FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_resolve_report(uuid, text, text)
  FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_update_delivery_status(uuid, text)
  FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_clear_force_password()
  FROM authenticated;

-- Ensure service_role retains access
GRANT EXECUTE ON FUNCTION public.is_admin() TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_ban_user(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_suspend_user(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_unban_user(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_warn_user(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_hide_listing(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_unhide_listing(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_delete_listing(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_resolve_report(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_update_delivery_status(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_clear_force_password() TO service_role;
