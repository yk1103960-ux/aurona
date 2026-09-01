-- Public-safe variant metadata view (excludes wholesale pricing columns)
CREATE OR REPLACE VIEW public.public_product_variants AS
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

-- Ensure the view can be read by service role and the PostgREST/Supabase API
ALTER VIEW public.public_product_variants OWNER TO postgres;

-- Public grants on the safe view only
GRANT SELECT ON public.public_product_variants TO anon;
GRANT SELECT ON public.public_product_variants TO authenticated;
GRANT ALL ON public.public_product_variants TO service_role;

-- Remove the overly permissive public policy on the underlying table
DROP POLICY IF EXISTS "Public read variants" ON public.product_variants;