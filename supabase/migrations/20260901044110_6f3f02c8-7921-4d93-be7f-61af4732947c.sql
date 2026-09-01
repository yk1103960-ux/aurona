DROP VIEW IF EXISTS public.public_product_variants;

CREATE OR REPLACE VIEW public.public_product_variants
WITH (security_invoker = true)
AS
SELECT
  id,
  family_id,
  sku,
  attributes,
  mrp,
  price,
  discount_pct,
  moq,
  stock,
  weight_g,
  pack_size,
  pack_weight_g,
  dim_l,
  dim_w,
  dim_h,
  pack_l,
  pack_w,
  pack_h,
  image_seed,
  sort_order,
  created_at
FROM public.product_variants;

GRANT SELECT ON public.public_product_variants TO anon;
GRANT SELECT ON public.public_product_variants TO authenticated;
GRANT ALL ON public.public_product_variants TO service_role;