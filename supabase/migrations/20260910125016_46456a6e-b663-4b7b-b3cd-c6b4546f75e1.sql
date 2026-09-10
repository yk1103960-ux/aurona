CREATE OR REPLACE FUNCTION public.role_can_view(_c boolean, _r boolean, _d boolean)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT CASE public.current_pricing_role()
    WHEN 'admin' THEN true
    WHEN 'distributor' THEN COALESCE(_d, true)
    WHEN 'retailer' THEN COALESCE(_r, true)
    ELSE COALESCE(_c, true)
  END
$$;