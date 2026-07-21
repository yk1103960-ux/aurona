
CREATE TABLE public.product_families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  main_sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  brand TEXT NOT NULL DEFAULT 'Aurona',
  short_description TEXT,
  description TEXT,
  image_seed TEXT,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  is_bestseller BOOLEAN NOT NULL DEFAULT false,
  is_new BOOLEAN NOT NULL DEFAULT false,
  is_sale BOOLEAN NOT NULL DEFAULT false,
  min_price NUMERIC(10,2),
  max_price NUMERIC(10,2),
  min_mrp NUMERIC(10,2),
  max_mrp NUMERIC(10,2),
  total_stock INTEGER NOT NULL DEFAULT 0,
  rating NUMERIC(2,1) NOT NULL DEFAULT 4.6,
  review_count INTEGER NOT NULL DEFAULT 0,
  warranty TEXT,
  material TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.product_families TO anon, authenticated;
GRANT ALL ON public.product_families TO service_role;
ALTER TABLE public.product_families ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read families" ON public.product_families FOR SELECT USING (true);

CREATE TABLE public.product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.product_families(id) ON DELETE CASCADE,
  sku TEXT NOT NULL UNIQUE,
  attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  mrp NUMERIC(10,2) NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  discount_pct NUMERIC(5,2),
  retailer_price NUMERIC(10,2),
  retailer_moq INTEGER,
  distributor_price NUMERIC(10,2),
  distributor_moq INTEGER,
  moq INTEGER NOT NULL DEFAULT 1,
  stock INTEGER NOT NULL DEFAULT 25,
  weight_g NUMERIC(10,2),
  pack_size INTEGER,
  pack_weight_g NUMERIC(10,2),
  dim_l NUMERIC(8,2), dim_w NUMERIC(8,2), dim_h NUMERIC(8,2),
  pack_l NUMERIC(8,2), pack_w NUMERIC(8,2), pack_h NUMERIC(8,2),
  image_seed TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.product_variants(family_id);
CREATE INDEX ON public.product_variants USING gin (attributes);
GRANT SELECT ON public.product_variants TO anon, authenticated;
GRANT ALL ON public.product_variants TO service_role;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read variants" ON public.product_variants FOR SELECT USING (true);

CREATE TABLE public.product_variant_axes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.product_families(id) ON DELETE CASCADE,
  axis_key TEXT NOT NULL,
  label TEXT NOT NULL,
  values JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE(family_id, axis_key)
);
GRANT SELECT ON public.product_variant_axes TO anon, authenticated;
GRANT ALL ON public.product_variant_axes TO service_role;
ALTER TABLE public.product_variant_axes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read variant axes" ON public.product_variant_axes FOR SELECT USING (true);

CREATE TRIGGER trg_family_updated BEFORE UPDATE ON public.product_families
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
