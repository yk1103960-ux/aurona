CREATE TABLE public.integrations (
  provider text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'not_connected',
  config_public jsonb NOT NULL DEFAULT '{}'::jsonb,
  config_secret_ciphertext text,
  secret_masked text,
  last_tested_at timestamptz,
  last_test_message text,
  last_sync_at timestamptz,
  last_sync_summary jsonb,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.integrations TO service_role;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read integrations" ON public.integrations FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_integrations_updated_at BEFORE UPDATE ON public.integrations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.newsletter_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  source text NOT NULL DEFAULT 'footer',
  unsubscribed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.newsletter_subscribers TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.newsletter_subscribers TO authenticated;
GRANT ALL ON public.newsletter_subscribers TO service_role;
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can subscribe" ON public.newsletter_subscribers FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Admins can view subscribers" ON public.newsletter_subscribers FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins can manage subscribers" ON public.newsletter_subscribers FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.tax_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  hsn_code text,
  gst_percent numeric NOT NULL DEFAULT 18,
  applies_to text NOT NULL DEFAULT 'all',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tax_rules TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tax_rules TO authenticated;
GRANT ALL ON public.tax_rules TO service_role;
ALTER TABLE public.tax_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tax rules are public" ON public.tax_rules FOR SELECT USING (true);
CREATE POLICY "Admins manage tax rules" ON public.tax_rules FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.shipping_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  pincode_prefixes text[] NOT NULL DEFAULT '{}',
  states text[] NOT NULL DEFAULT '{}',
  flat_rate numeric NOT NULL DEFAULT 0,
  free_above numeric,
  min_days integer NOT NULL DEFAULT 3,
  max_days integer NOT NULL DEFAULT 7,
  cod_allowed boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.shipping_zones TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipping_zones TO authenticated;
GRANT ALL ON public.shipping_zones TO service_role;
ALTER TABLE public.shipping_zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Shipping zones are public" ON public.shipping_zones FOR SELECT USING (true);
CREATE POLICY "Admins manage shipping zones" ON public.shipping_zones FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.tax_rules (name, hsn_code, gst_percent, applies_to) VALUES
 ('LED Lighting (HSN 9405)', '9405', 12, 'lighting'),
 ('Fans & Appliances (HSN 8414)', '8414', 18, 'appliances'),
 ('Default GST', NULL, 18, 'all');

INSERT INTO public.shipping_zones (name, states, flat_rate, free_above, min_days, max_days, cod_allowed, sort_order) VALUES
 ('Zone A — Metro', ARRAY['Maharashtra','Delhi','Karnataka','Telangana','Tamil Nadu','Gujarat'], 49, 999, 2, 4, true, 1),
 ('Zone B — Rest of India', ARRAY[]::text[], 89, 1499, 4, 7, true, 2),
 ('Zone C — North East & Islands', ARRAY['Assam','Manipur','Meghalaya','Mizoram','Nagaland','Tripura','Sikkim','Arunachal Pradesh','Andaman and Nicobar Islands','Lakshadweep'], 149, 2999, 6, 12, false, 3);