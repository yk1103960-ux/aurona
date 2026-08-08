-- 1) Product-level affiliate configuration
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS affiliate_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS affiliate_commission_kind text NOT NULL DEFAULT 'inherit',
  ADD COLUMN IF NOT EXISTS affiliate_commission_value numeric,
  ADD COLUMN IF NOT EXISTS affiliate_max_commission numeric,
  ADD COLUMN IF NOT EXISTS affiliate_starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS affiliate_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS weight_g numeric,
  ADD COLUMN IF NOT EXISTS dim_l numeric,
  ADD COLUMN IF NOT EXISTS dim_w numeric,
  ADD COLUMN IF NOT EXISTS dim_h numeric;

DO $$ BEGIN
  ALTER TABLE public.products
    ADD CONSTRAINT products_affiliate_commission_kind_chk
    CHECK (affiliate_commission_kind IN ('inherit','percentage','fixed'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Referral remembers the product that drove the click
ALTER TABLE public.affiliate_referrals
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id) ON DELETE SET NULL;

-- 3) Per-item commission breakdown
CREATE TABLE IF NOT EXISTS public.affiliate_commission_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_id uuid NOT NULL REFERENCES public.affiliate_commissions(id) ON DELETE CASCADE,
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  eligible_amount numeric NOT NULL DEFAULT 0,
  commission_kind text NOT NULL DEFAULT 'percentage',
  commission_value numeric NOT NULL DEFAULT 0,
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS affiliate_commission_items_unique
  ON public.affiliate_commission_items(commission_id, product_id, unit_price);
CREATE INDEX IF NOT EXISTS affiliate_commission_items_aff_idx
  ON public.affiliate_commission_items(affiliate_id);

GRANT SELECT ON public.affiliate_commission_items TO authenticated;
GRANT ALL ON public.affiliate_commission_items TO service_role;
ALTER TABLE public.affiliate_commission_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Affiliates read own commission items"
  ON public.affiliate_commission_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.affiliates a
    WHERE a.id = affiliate_commission_items.affiliate_id AND a.user_id = auth.uid()
  ));

CREATE POLICY "Admins read commission items"
  ON public.affiliate_commission_items FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 4) Product affiliate link clicks
CREATE TABLE IF NOT EXISTS public.affiliate_product_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  visitor_id text,
  user_id uuid,
  source text,
  landing_path text,
  referrer text,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS affiliate_product_clicks_aff_idx
  ON public.affiliate_product_clicks(affiliate_id, product_id);
CREATE INDEX IF NOT EXISTS affiliate_product_clicks_dedupe_idx
  ON public.affiliate_product_clicks(affiliate_id, product_id, visitor_id, created_at);

GRANT SELECT ON public.affiliate_product_clicks TO authenticated;
GRANT ALL ON public.affiliate_product_clicks TO service_role;
ALTER TABLE public.affiliate_product_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Affiliates read own clicks"
  ON public.affiliate_product_clicks FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.affiliates a
    WHERE a.id = affiliate_product_clicks.affiliate_id AND a.user_id = auth.uid()
  ));

CREATE POLICY "Admins read clicks"
  ON public.affiliate_product_clicks FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_affiliate_commission_items_updated_at
  BEFORE UPDATE ON public.affiliate_commission_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) Configurable delivery / COD rules
INSERT INTO public.site_settings (key, value) VALUES
  ('free_shipping_above', '999'),
  ('shipping_flat_rate', '79'),
  ('shipping_default_weight_g', '500'),
  ('cod_fee', '0')
ON CONFLICT (key) DO NOTHING;