-- 1) Careers / vacancies: closure date
ALTER TABLE public.career_programs ADD COLUMN IF NOT EXISTS closes_at timestamptz;

-- 2) Referral programs
CREATE TABLE IF NOT EXISTS public.referral_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  eligibility text,
  commission_kind text NOT NULL DEFAULT 'percentage',
  commission_value numeric NOT NULL DEFAULT 0,
  max_commission numeric,
  min_order_value numeric NOT NULL DEFAULT 0,
  terms text,
  closes_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  is_published boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT referral_programs_kind_chk CHECK (commission_kind IN ('percentage','fixed'))
);

GRANT SELECT ON public.referral_programs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.referral_programs TO authenticated;
GRANT ALL ON public.referral_programs TO service_role;

ALTER TABLE public.referral_programs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS referral_programs_public_read ON public.referral_programs;
CREATE POLICY referral_programs_public_read ON public.referral_programs
  FOR SELECT USING (is_published = true);

DROP POLICY IF EXISTS referral_programs_admin_all ON public.referral_programs;
CREATE POLICY referral_programs_admin_all ON public.referral_programs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_referral_programs_updated ON public.referral_programs;
CREATE TRIGGER trg_referral_programs_updated BEFORE UPDATE ON public.referral_programs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) Extra editable product fields
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS body_type text,
  ADD COLUMN IF NOT EXISTS pack_size integer,
  ADD COLUMN IF NOT EXISTS features jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS specifications jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.product_families
  ADD COLUMN IF NOT EXISTS body_type text,
  ADD COLUMN IF NOT EXISTS features jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS specifications jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- 4) Keep the public (price-safe) variant view in sync
CREATE OR REPLACE VIEW public.public_product_variants AS
  SELECT id, family_id, sku, attributes, mrp, price, discount_pct, moq, stock,
         weight_g, pack_size, pack_weight_g, dim_l, dim_w, dim_h,
         pack_l, pack_w, pack_h, image_seed, sort_order, created_at,
         is_active
  FROM public.product_variants;