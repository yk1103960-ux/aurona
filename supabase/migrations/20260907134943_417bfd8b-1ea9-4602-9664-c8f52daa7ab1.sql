-- 1) Public-safe column privileges on the underlying table (wholesale columns excluded).
GRANT SELECT (
  id, sku, family_id, price, mrp, stock, moq, attributes, sort_order,
  is_active, discount_pct, image_seed, created_at, updated_at,
  weight_g, dim_l, dim_w, dim_h,
  pack_size, pack_l, pack_w, pack_h, pack_weight_g, low_stock_threshold, archived_at
) ON public.product_variants TO anon, authenticated;
GRANT ALL ON public.product_variants TO service_role;

-- 2) Read policy for published catalogue rows only.
DROP POLICY IF EXISTS "public read published variants" ON public.product_variants;
CREATE POLICY "public read published variants"
ON public.product_variants
FOR SELECT
TO anon, authenticated
USING (
  is_active
  AND archived_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.product_families f
    WHERE f.id = product_variants.family_id
      AND f.is_published
      AND f.archived_at IS NULL
  )
);

-- 3) The view now enforces the querying user's permissions.
ALTER VIEW public.public_product_variants SET (security_invoker = on);
