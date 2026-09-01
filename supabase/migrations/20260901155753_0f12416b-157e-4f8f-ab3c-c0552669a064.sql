ALTER VIEW public.public_product_variants SET (security_invoker = on);

GRANT SELECT (
  id, family_id, sku, attributes, mrp, price, discount_pct, moq, stock,
  weight_g, pack_size, pack_weight_g, dim_l, dim_w, dim_h,
  pack_l, pack_w, pack_h, image_seed, sort_order, created_at, is_active
) ON public.product_variants TO anon, authenticated;

DROP POLICY IF EXISTS "Public can read active variant listing data" ON public.product_variants;
CREATE POLICY "Public can read active variant listing data"
  ON public.product_variants FOR SELECT
  USING (true);