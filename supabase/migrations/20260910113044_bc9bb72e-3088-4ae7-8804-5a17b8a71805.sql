ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS available_customer boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS available_retailer boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS available_distributor boolean NOT NULL DEFAULT true;

GRANT SELECT (available_customer, available_retailer, available_distributor)
  ON public.product_variants TO anon, authenticated;
GRANT ALL ON public.product_variants TO service_role;

DROP VIEW IF EXISTS public.public_product_variants;
CREATE VIEW public.public_product_variants
WITH (security_invoker = on, security_barrier = true) AS
SELECT id, family_id, sku, attributes, mrp, price, discount_pct, moq, stock,
       weight_g, pack_size, pack_weight_g, dim_l, dim_w, dim_h,
       pack_l, pack_w, pack_h, image_seed, sort_order, created_at, is_active,
       available_customer, available_retailer, available_distributor
FROM public.product_variants
WHERE archived_at IS NULL;

GRANT SELECT ON public.public_product_variants TO anon, authenticated;
GRANT ALL ON public.public_product_variants TO service_role;

CREATE OR REPLACE FUNCTION public.admin_set_variant_segments(_family_id uuid, _segments jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE item jsonb;
BEGIN
  FOR item IN SELECT value FROM jsonb_array_elements(COALESCE(_segments, '[]'::jsonb)) LOOP
    UPDATE public.product_variants
    SET available_customer = COALESCE((item->>'available_customer')::boolean, available_customer),
        available_retailer = COALESCE((item->>'available_retailer')::boolean, available_retailer),
        available_distributor = COALESCE((item->>'available_distributor')::boolean, available_distributor),
        updated_at = now()
    WHERE family_id = _family_id
      AND upper(btrim(sku)) = upper(btrim(item->>'sku'));
  END LOOP;
END; $$;

REVOKE ALL ON FUNCTION public.admin_set_variant_segments(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_variant_segments(uuid, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.admin_set_variant_segments(uuid, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_variant_segments(uuid, jsonb) TO service_role;