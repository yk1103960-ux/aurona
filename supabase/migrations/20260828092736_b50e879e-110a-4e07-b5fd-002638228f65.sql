
CREATE TEMP TABLE _ship_defaults(slug text primary key, w numeric, l numeric, b numeric, h numeric);
INSERT INTO _ship_defaults(slug, w, l, b, h) VALUES
  ('led-bulbs', 120, 8, 8, 14),
  ('panel-lights', 400, 25, 25, 5),
  ('concealed-lights', 250, 13, 13, 9),
  ('interior-lights', 300, 16, 16, 10),
  ('decorative-lights', 350, 20, 20, 12),
  ('deep-lights', 260, 13, 13, 11),
  ('tube-lights', 300, 125, 8, 8),
  ('street-lights', 1500, 40, 25, 10),
  ('flood-lights', 1200, 30, 25, 8),
  ('outdoor-lights', 800, 25, 20, 15),
  ('ceiling-fans', 5000, 60, 30, 15),
  ('table-fans', 4000, 45, 40, 25),
  ('pedestal-fans', 8000, 70, 45, 25),
  ('exhaust-fans', 2000, 30, 30, 20),
  ('water-geysers', 9000, 45, 45, 50),
  ('room-heaters', 3500, 40, 35, 25),
  ('immersion-heaters', 900, 50, 12, 12),
  ('madhani', 1200, 40, 15, 15);

UPDATE public.products p
SET weight_g = COALESCE(p.weight_g, d.w, 500),
    dim_l    = COALESCE(p.dim_l, d.l, 20),
    dim_w    = COALESCE(p.dim_w, d.b, 15),
    dim_h    = COALESCE(p.dim_h, d.h, 10)
FROM public.categories c
LEFT JOIN _ship_defaults d ON d.slug = c.slug
WHERE p.category_id = c.id
  AND (p.weight_g IS NULL OR p.dim_l IS NULL OR p.dim_w IS NULL OR p.dim_h IS NULL);

UPDATE public.products p
SET weight_g = COALESCE(p.weight_g, 500),
    dim_l    = COALESCE(p.dim_l, 20),
    dim_w    = COALESCE(p.dim_w, 15),
    dim_h    = COALESCE(p.dim_h, 10)
WHERE p.weight_g IS NULL OR p.dim_l IS NULL OR p.dim_w IS NULL OR p.dim_h IS NULL;

UPDATE public.product_variants v
SET weight_g = COALESCE(v.weight_g, d.w, 500),
    dim_l    = COALESCE(v.dim_l, d.l, 20),
    dim_w    = COALESCE(v.dim_w, d.b, 15),
    dim_h    = COALESCE(v.dim_h, d.h, 10)
FROM public.product_families f
LEFT JOIN public.categories c ON c.id = f.category_id
LEFT JOIN _ship_defaults d ON d.slug = c.slug
WHERE v.family_id = f.id
  AND (v.weight_g IS NULL OR v.dim_l IS NULL OR v.dim_w IS NULL OR v.dim_h IS NULL);

UPDATE public.product_variants v
SET weight_g = COALESCE(v.weight_g, 500),
    dim_l    = COALESCE(v.dim_l, 20),
    dim_w    = COALESCE(v.dim_w, 15),
    dim_h    = COALESCE(v.dim_h, 10)
WHERE v.weight_g IS NULL OR v.dim_l IS NULL OR v.dim_w IS NULL OR v.dim_h IS NULL;

INSERT INTO public.site_settings(key, value)
VALUES ('shipping_default_weight_g', '300')
ON CONFLICT (key) DO NOTHING;
