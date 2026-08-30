REVOKE ALL ON FUNCTION public.my_role_status() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.my_role_status() FROM anon;
GRANT EXECUTE ON FUNCTION public.my_role_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_role_status() TO service_role;