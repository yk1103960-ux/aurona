-- Populate the catalog option library from existing authoritative family data.
-- This migration is additive and idempotent. It does not alter products,
-- variants, prices, inventory, orders, or existing catalog option records.

INSERT INTO public.catalog_options (kind, name, code, details, sort_order, active)
SELECT DISTINCT
  'brand',
  btrim(f.brand),
  NULL,
  '{}'::jsonb,
  0,
  true
FROM public.product_families f
WHERE NULLIF(btrim(f.brand), '') IS NOT NULL
ON CONFLICT (kind, name) DO NOTHING;

INSERT INTO public.catalog_options (kind, name, code, details, sort_order, active)
SELECT DISTINCT
  'warranty',
  btrim(f.warranty),
  NULL,
  '{}'::jsonb,
  0,
  true
FROM public.product_families f
WHERE NULLIF(btrim(f.warranty), '') IS NOT NULL
ON CONFLICT (kind, name) DO NOTHING;

INSERT INTO public.catalog_options (kind, name, code, details, sort_order, active)
SELECT DISTINCT ON (btrim(a.label))
  'attribute',
  btrim(a.label),
  a.axis_key,
  '{}'::jsonb,
  a.sort_order,
  true
FROM public.product_variant_axes a
WHERE NULLIF(btrim(a.label), '') IS NOT NULL
ORDER BY btrim(a.label), a.sort_order, a.axis_key
ON CONFLICT (kind, name) DO NOTHING;

INSERT INTO public.catalog_options (kind, name, code, details, sort_order, active)
SELECT DISTINCT
  'colour',
  btrim(value.item #>> '{}'),
  NULL,
  '{}'::jsonb,
  0,
  true
FROM public.product_variant_axes a
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(a.values) = 'array' THEN a.values ELSE '[]'::jsonb END
) AS value(item)
WHERE (lower(a.axis_key) IN ('color', 'colour', 'color_temp', 'colour_temperature')
    OR lower(a.label) LIKE '%color%'
    OR lower(a.label) LIKE '%colour%')
  AND NULLIF(btrim(value.item #>> '{}'), '') IS NOT NULL
ON CONFLICT (kind, name) DO NOTHING;
