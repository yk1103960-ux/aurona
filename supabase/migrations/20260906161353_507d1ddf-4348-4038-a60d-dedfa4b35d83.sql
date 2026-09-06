REVOKE ALL ON FUNCTION public.affiliate_sync_order() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_return_event() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.affiliate_sync_order() TO service_role;
GRANT EXECUTE ON FUNCTION public.log_return_event() TO service_role;

REVOKE ALL ON FUNCTION public.approve_partner(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_partner(uuid, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.redeem_coupon(uuid, uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_coupon(uuid, uuid, numeric) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.affiliate_balance(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.affiliate_balance(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_mfa_enrolled(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_mfa_enrolled(uuid) TO authenticated, service_role;