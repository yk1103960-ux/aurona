-- READ ONLY. Run on an authorized database; export product data only (no customers/secrets).
BEGIN TRANSACTION READ ONLY;
-- Identity mapping: absence is a blocker, never a reason to invent a family.
SELECT p.id AS legacy_id,p.sku,p.slug,p.name,f.id AS family_id,f.main_sku,
       v.id AS variant_id,v.attributes,p.wattage,p.color_temp,p.size,p.specifications
FROM public.products p
LEFT JOIN public.product_variants v ON v.sku=p.sku
LEFT JOIN public.product_families f ON f.id=v.family_id
ORDER BY p.sku;
-- Actual family axes and SKU details (role prices kept in admin-only export).
SELECT f.id,f.name,f.main_sku,c.name AS category,a.axis_key,a.label,a.values
FROM public.product_families f LEFT JOIN public.categories c ON c.id=f.category_id
LEFT JOIN public.product_variant_axes a ON a.family_id=f.id ORDER BY f.name,a.sort_order;
-- Normalized collisions, including archived identities.
SELECT upper(btrim(sku)) AS normalized_sku,count(*),array_agg(id)
FROM public.product_variants GROUP BY upper(btrim(sku)) HAVING count(*)>1;
-- Legacy cart compatibility: a generated variant without products.id is not ready to sell.
SELECT v.id,v.family_id,v.sku FROM public.product_variants v
LEFT JOIN public.products p ON p.sku=v.sku WHERE p.id IS NULL;
-- Values missing from declared axes; do not guess replacements.
SELECT v.family_id,v.sku,a.axis_key,a.label,v.attributes->>a.axis_key AS actual_value
FROM public.product_variants v JOIN public.product_variant_axes a ON a.family_id=v.family_id
WHERE NOT COALESCE(a.values ? (v.attributes->>a.axis_key),false);
-- Orphan image associations.
SELECT i.id,i.family_id,i.variant_sku FROM public.product_images i
LEFT JOIN public.product_variants v ON v.sku=i.variant_sku AND v.family_id=i.family_id
WHERE i.variant_sku IS NOT NULL AND v.id IS NULL;
ROLLBACK;
