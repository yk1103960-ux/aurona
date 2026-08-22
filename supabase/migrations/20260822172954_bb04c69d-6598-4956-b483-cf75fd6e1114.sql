-- 1) Column-level protection of wholesale pricing on product_variants
REVOKE SELECT ON public.product_variants FROM anon;
REVOKE SELECT ON public.product_variants FROM authenticated;

GRANT SELECT (
  id, family_id, sku, attributes, mrp, price, discount_pct, moq, stock,
  weight_g, pack_size, pack_weight_g, dim_l, dim_w, dim_h,
  pack_l, pack_w, pack_h, image_seed, sort_order, created_at
) ON public.product_variants TO anon;

GRANT SELECT (
  id, family_id, sku, attributes, mrp, price, discount_pct, moq, stock,
  weight_g, pack_size, pack_weight_g, dim_l, dim_w, dim_h,
  pack_l, pack_w, pack_h, image_seed, sort_order, created_at
) ON public.product_variants TO authenticated;

GRANT ALL ON public.product_variants TO service_role;

-- 2) Prevent duplicate in-flight partner applications per user + type
CREATE UNIQUE INDEX IF NOT EXISTS partner_applications_active_unique
  ON public.partner_applications (user_id, partner_type)
  WHERE user_id IS NOT NULL AND status IN ('pending','under_review');