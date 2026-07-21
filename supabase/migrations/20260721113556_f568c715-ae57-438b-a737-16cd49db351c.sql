
DO $$ BEGIN
  CREATE TYPE public.partner_type AS ENUM (
    'retailer','distributor','sales','reseller','referral','affiliate',
    'corporate','government','architect','contractor','oem','builder','career'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.application_status AS ENUM ('pending','under_review','approved','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.partner_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  partner_type public.partner_type NOT NULL,
  status public.application_status NOT NULL DEFAULT 'pending',
  full_name TEXT NOT NULL,
  business_name TEXT,
  owner_name TEXT,
  mobile TEXT NOT NULL,
  email TEXT NOT NULL,
  gstin TEXT,
  pan TEXT,
  cin TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,
  business_type TEXT,
  years_in_business TEXT,
  expected_monthly_purchase TEXT,
  product_categories TEXT[],
  distribution_area TEXT,
  warehouse_capacity TEXT,
  sales_team_size TEXT,
  existing_brands TEXT,
  monthly_purchase_volume TEXT,
  gst_certificate_url TEXT,
  shop_license_url TEXT,
  trade_license_url TEXT,
  company_registration_url TEXT,
  extra JSONB DEFAULT '{}'::jsonb,
  admin_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.partner_applications TO authenticated;
GRANT INSERT ON public.partner_applications TO anon;
GRANT ALL ON public.partner_applications TO service_role;
ALTER TABLE public.partner_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone submit application" ON public.partner_applications
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "own applications" ON public.partner_applications
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "staff view applications" ON public.partner_applications
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY "staff update applications" ON public.partner_applications
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE TRIGGER trg_partner_applications_updated BEFORE UPDATE ON public.partner_applications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  family_id UUID REFERENCES public.product_families(id) ON DELETE CASCADE,
  variant_sku TEXT,
  image_url TEXT NOT NULL,
  alt_text TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.product_images TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.product_images TO authenticated;
GRANT ALL ON public.product_images TO service_role;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read product images" ON public.product_images
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin manage product images" ON public.product_images
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE INDEX IF NOT EXISTS idx_product_images_product ON public.product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_product_images_family ON public.product_images(family_id);
CREATE INDEX IF NOT EXISTS idx_product_images_sku ON public.product_images(variant_sku);

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number TEXT UNIQUE NOT NULL DEFAULT ('TKT-' || to_char(now(),'YYMMDD') || '-' || upper(substr(md5(random()::text),1,6))),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  subject TEXT NOT NULL,
  category TEXT,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'normal',
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.support_tickets TO authenticated;
GRANT INSERT ON public.support_tickets TO anon;
GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone create ticket" ON public.support_tickets
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "own tickets" ON public.support_tickets
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "staff view tickets" ON public.support_tickets
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY "staff update tickets" ON public.support_tickets
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE TRIGGER trg_support_tickets_updated BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.site_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.site_settings TO authenticated;
GRANT ALL ON public.site_settings TO service_role;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read settings" ON public.site_settings
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin manage settings" ON public.site_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.site_settings(key,value) VALUES
  ('support_phone','+91 96025 70026'),
  ('support_email','support@auronalighting.com'),
  ('notification_email','info@auronalighting.com'),
  ('notification_mobile','+91 96025 70026'),
  ('social_facebook','https://facebook.com/auronalighting'),
  ('social_instagram','https://instagram.com/auronalighting'),
  ('social_linkedin','https://linkedin.com/company/auronalighting'),
  ('social_youtube','https://youtube.com/@auronalighting'),
  ('social_twitter','https://twitter.com/auronalighting'),
  ('social_whatsapp','https://wa.me/919602570026'),
  ('business_hours','Mon-Sat 9:30 AM – 6:30 PM IST'),
  ('address_line','Aurona Lighting Industries, Jaipur, Rajasthan, India')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.recently_viewed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_slug TEXT NOT NULL,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_slug)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recently_viewed TO authenticated;
GRANT ALL ON public.recently_viewed TO service_role;
ALTER TABLE public.recently_viewed ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own recently viewed" ON public.recently_viewed
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_recently_viewed_user ON public.recently_viewed(user_id, viewed_at DESC);

CREATE TABLE IF NOT EXISTS public.addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  line1 TEXT NOT NULL,
  line2 TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  pincode TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.addresses TO authenticated;
GRANT ALL ON public.addresses TO service_role;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own addresses" ON public.addresses
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER trg_addresses_updated BEFORE UPDATE ON public.addresses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
