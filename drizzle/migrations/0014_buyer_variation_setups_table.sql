CREATE TABLE IF NOT EXISTS public.product_variant_buyer_setups (
  family_id uuid NOT NULL REFERENCES public.product_families(id) ON DELETE CASCADE,
  buyer_type text NOT NULL CHECK (buyer_type IN ('retailer', 'distributor')),
  axes jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(axes) = 'array'),
  variant_skus text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (family_id, buyer_type)
);
REVOKE ALL ON public.product_variant_buyer_setups FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_variant_buyer_setups TO service_role;
ALTER TABLE public.product_variant_buyer_setups ENABLE ROW LEVEL SECURITY;

INSERT INTO public.product_variant_buyer_setups(family_id, buyer_type, axes, variant_skus)
SELECT f.id, buyer.buyer_type,
  COALESCE((SELECT jsonb_agg(jsonb_build_object('id', a.id, 'axis_key', a.axis_key, 'label', a.label,
    'values', a.values, 'sort_order', a.sort_order) ORDER BY a.sort_order)
    FROM public.product_variant_axes a WHERE a.family_id = f.id), '[]'::jsonb),
  COALESCE((SELECT array_agg(v.sku ORDER BY v.sort_order) FROM public.product_variants v
    WHERE v.family_id = f.id AND v.archived_at IS NULL AND
      CASE buyer.buyer_type WHEN 'retailer' THEN v.available_retailer IS DISTINCT FROM false
        ELSE v.available_distributor IS DISTINCT FROM false END), '{}'::text[])
FROM public.product_families f
CROSS JOIN (VALUES ('retailer'), ('distributor')) AS buyer(buyer_type)
ON CONFLICT (family_id, buyer_type) DO NOTHING;

NOTIFY pgrst, 'reload schema';