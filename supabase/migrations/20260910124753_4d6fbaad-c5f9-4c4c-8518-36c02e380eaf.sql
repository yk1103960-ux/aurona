ALTER TABLE public.product_families
  ADD COLUMN IF NOT EXISTS visible_customer boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS visible_retailer boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS visible_distributor boolean NOT NULL DEFAULT true;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS visible_customer boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS visible_retailer boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS visible_distributor boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.role_can_view(_c boolean, _r boolean, _d boolean)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE public.current_pricing_role()
    WHEN 'admin' THEN true
    WHEN 'distributor' THEN COALESCE(_d, true)
    WHEN 'retailer' THEN COALESCE(_r, true)
    ELSE COALESCE(_c, true)
  END
$$;

GRANT EXECUTE ON FUNCTION public.role_can_view(boolean, boolean, boolean) TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "Public read families" ON public.product_families;
CREATE POLICY "Public read families" ON public.product_families
  FOR SELECT TO anon, authenticated
  USING (public.role_can_view(visible_customer, visible_retailer, visible_distributor));

DROP POLICY IF EXISTS "public read products" ON public.products;
CREATE POLICY "public read products" ON public.products
  FOR SELECT TO anon, authenticated
  USING (public.role_can_view(visible_customer, visible_retailer, visible_distributor));

DROP POLICY IF EXISTS "public read published variants" ON public.product_variants;
CREATE POLICY "public read published variants" ON public.product_variants
  FOR SELECT TO anon, authenticated
  USING (
    is_active AND archived_at IS NULL AND EXISTS (
      SELECT 1 FROM public.product_families f
      WHERE f.id = product_variants.family_id
        AND f.is_published
        AND f.archived_at IS NULL
        AND public.role_can_view(f.visible_customer, f.visible_retailer, f.visible_distributor)
    )
  );

CREATE OR REPLACE FUNCTION public.admin_set_family_visibility(
  _family_id uuid, _product_id uuid, _c boolean, _r boolean, _d boolean
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.product_families
     SET visible_customer = COALESCE(_c, true),
         visible_retailer = COALESCE(_r, true),
         visible_distributor = COALESCE(_d, true)
   WHERE id = _family_id;
  IF _product_id IS NOT NULL THEN
    UPDATE public.products
       SET visible_customer = COALESCE(_c, true),
           visible_retailer = COALESCE(_r, true),
           visible_distributor = COALESCE(_d, true)
     WHERE id = _product_id;
  END IF;
END; $$;

REVOKE ALL ON FUNCTION public.admin_set_family_visibility(uuid, uuid, boolean, boolean, boolean) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_family_visibility(uuid, uuid, boolean, boolean, boolean) TO service_role;