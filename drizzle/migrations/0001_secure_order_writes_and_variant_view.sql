DROP POLICY IF EXISTS "own orders create" ON public.orders;
DROP POLICY IF EXISTS "own order items insert" ON public.order_items;
DROP POLICY IF EXISTS "own redemptions insert" ON public.coupon_redemptions;

REVOKE INSERT ON public.orders FROM anon, authenticated;
REVOKE INSERT ON public.order_items FROM anon, authenticated;
REVOKE INSERT ON public.coupon_redemptions FROM anon, authenticated;
GRANT ALL ON public.orders TO service_role;
GRANT ALL ON public.order_items TO service_role;
GRANT ALL ON public.coupon_redemptions TO service_role;

ALTER VIEW public.public_product_variants SET (security_invoker = true);