-- 1) Public listing source exposes only shopper-safe columns and bypasses RLS.
DROP VIEW IF EXISTS public.public_product_variants;
CREATE VIEW public.public_product_variants
WITH (security_invoker = off, security_barrier = true) AS
SELECT id, family_id, sku, attributes, mrp, price, discount_pct, moq, stock,
       weight_g, pack_size, pack_weight_g, dim_l, dim_w, dim_h,
       pack_l, pack_w, pack_h, image_seed, sort_order, created_at, is_active
FROM public.product_variants
WHERE archived_at IS NULL;

GRANT SELECT ON public.public_product_variants TO anon, authenticated;
GRANT ALL ON public.public_product_variants TO service_role;

-- 2) Remove the wide-open SELECT policy on the base table; only admins/staff read raw variants.
DROP POLICY IF EXISTS "Public can read active variant listing data" ON public.product_variants;
REVOKE SELECT ON public.product_variants FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_variants TO authenticated;
GRANT ALL ON public.product_variants TO service_role;

-- 3) Permission helper must not be callable by anonymous visitors.
REVOKE ALL ON FUNCTION public.has_admin_permission(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_admin_permission(uuid, text) TO authenticated, service_role;

-- 4) Drop the temporary restore helper table.
DROP TABLE IF EXISTS public.tmp_stock_restore;