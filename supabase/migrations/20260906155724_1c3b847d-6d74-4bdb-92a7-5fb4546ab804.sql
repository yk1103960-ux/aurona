REVOKE ALL ON FUNCTION public.refresh_product_family(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_product_family(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.trg_refresh_product_family() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trg_refresh_product_family() TO service_role;