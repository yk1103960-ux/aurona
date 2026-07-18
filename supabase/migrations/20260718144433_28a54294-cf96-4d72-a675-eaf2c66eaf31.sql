
-- ============ ROLES ============
CREATE TYPE public.app_role AS ENUM ('admin', 'customer');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  business_name TEXT,
  gstin TEXT,
  account_type TEXT DEFAULT 'retail',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile write" ON public.profiles FOR ALL TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Auto-create profile & default customer role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.raw_user_meta_data->>'phone');
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'customer') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ CATALOG ============
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  parent_group TEXT NOT NULL, -- 'led-lighting' | 'fans' | 'home-appliances'
  icon TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read categories" ON public.categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin manage categories" ON public.categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  brand TEXT NOT NULL DEFAULT 'Aurona',
  short_description TEXT,
  description TEXT,
  mrp NUMERIC(10,2) NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  unit TEXT NOT NULL DEFAULT 'Pc',
  stock INT NOT NULL DEFAULT 100,
  rating NUMERIC(2,1) NOT NULL DEFAULT 4.5,
  review_count INT NOT NULL DEFAULT 0,
  wattage TEXT,
  size TEXT,
  color_temp TEXT,
  material TEXT,
  warranty TEXT DEFAULT '1 Year',
  is_featured BOOLEAN NOT NULL DEFAULT false,
  is_bestseller BOOLEAN NOT NULL DEFAULT false,
  is_new BOOLEAN NOT NULL DEFAULT false,
  is_sale BOOLEAN NOT NULL DEFAULT false,
  image_seed TEXT, -- used to render gradient card
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.products TO anon, authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read products" ON public.products FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin manage products" ON public.products FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX products_category_idx ON public.products(category_id);
CREATE INDEX products_name_idx ON public.products USING gin (to_tsvector('english', name || ' ' || COALESCE(short_description,'')));

-- ============ CART ============
CREATE TABLE public.cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cart_items TO authenticated;
GRANT ALL ON public.cart_items TO service_role;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own cart" ON public.cart_items FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.wishlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wishlist_items TO authenticated;
GRANT ALL ON public.wishlist_items TO service_role;
ALTER TABLE public.wishlist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own wishlist" ON public.wishlist_items FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ ORDERS ============
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL UNIQUE DEFAULT ('AUR' || to_char(now(), 'YYMMDD') || lpad(floor(random()*100000)::text, 5, '0')),
  status TEXT NOT NULL DEFAULT 'placed', -- placed|confirmed|packed|shipped|out_for_delivery|delivered|cancelled
  subtotal NUMERIC(10,2) NOT NULL,
  discount NUMERIC(10,2) NOT NULL DEFAULT 0,
  shipping NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'cod',
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  pincode TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own orders read" ON public.orders FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own orders create" ON public.orders FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admin manage orders" ON public.orders FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  quantity INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own order items read" ON public.order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid()));
CREATE POLICY "own order items insert" ON public.order_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid()));

-- ============ SEED CATEGORIES ============
INSERT INTO public.categories (slug, name, parent_group, icon, sort_order) VALUES
  ('interior-lights',  'Interior Lights',  'led-lighting', 'Lightbulb', 1),
  ('concealed-lights', 'Concealed Lights', 'led-lighting', 'CircleDot', 2),
  ('panel-lights',     'Panel Lights',     'led-lighting', 'LayoutGrid', 3),
  ('tube-lights',      'Tube Lights',      'led-lighting', 'Minus', 4),
  ('street-lights',    'Street Lights',    'led-lighting', 'Lamp', 5),
  ('flood-lights',     'Flood Lights',     'led-lighting', 'Zap', 6),
  ('led-bulbs',        'LED Bulbs',        'led-lighting', 'Lightbulb', 7),
  ('mirror-lights',    'Mirror Lights',    'led-lighting', 'Mirror', 8),
  ('ceiling-fans',     'Ceiling Fans',     'fans', 'Fan', 9),
  ('table-fans',       'Table Fans',       'fans', 'Fan', 10),
  ('exhaust-fans',     'Exhaust Fans',     'fans', 'Fan', 11),
  ('heaters',          'Heaters',          'home-appliances', 'Flame', 12);

-- ============ SEED PRODUCTS ============
INSERT INTO public.products (slug, sku, name, category_id, short_description, description, mrp, price, wattage, size, color_temp, material, warranty, is_featured, is_bestseller, is_new, is_sale, image_seed) VALUES
  ('nexa-concealed-light', 'AUR-NEXA-CON-01', 'NEXA Concealed Light', (SELECT id FROM public.categories WHERE slug='concealed-lights'), 'Premium recessed LED with anti-glare optics', 'The NEXA Concealed Light delivers uniform, glare-free illumination with premium optics and a slim architectural profile ideal for modern interiors.', 600, 200, '12W', '4 inch', '3000K/4000K/6500K', 'Aluminium + PC', '2 Years', true, true, false, true, 'amber'),
  ('zio-concealed-light',  'AUR-ZIO-CON-02',  'ZIO Concealed Light',  (SELECT id FROM public.categories WHERE slug='concealed-lights'), 'Slim profile deep-recessed LED', 'ZIO features a deep-recessed housing for a clean ceiling look with excellent thermal management.', 550, 220, '10W', '3.5 inch', '4000K', 'Aluminium', '2 Years', true, true, false, true, 'warm'),
  ('happy-concealed-light','AUR-HAPPY-CON-03','HAPPY Concealed Light',(SELECT id FROM public.categories WHERE slug='concealed-lights'), 'Value engineered concealed LED', 'HAPPY brings dependable performance for everyday interiors at an unbeatable price.', 500, 190, '9W', '3 inch', '6500K', 'PC + Aluminium', '1 Year', true, false, false, true, 'cool'),
  ('cob-concealed-light',  'AUR-COB-CON-04',  'COB Concealed Light',  (SELECT id FROM public.categories WHERE slug='concealed-lights'), 'High-CRI COB spotlight',   'COB spotlight with 90+ CRI, perfect for accenting art, retail displays and premium residences.', 750, 275, '15W', '4 inch', '3000K', 'Die-cast Aluminium', '2 Years', true, true, true, true, 'gold'),
  ('joy-concealed-light',  'AUR-JOY-CON-05',  'JOY Concealed Light',  (SELECT id FROM public.categories WHERE slug='concealed-lights'), 'Modern surface concealed LED', 'JOY offers a modern rimless design with wide beam angle.', 480, 210, '9W', '3 inch', '4000K', 'Aluminium', '1 Year', false, false, true, true, 'amber'),
  ('razer-concealed-light','AUR-RAZ-CON-06',  'RAZER Concealed Light',(SELECT id FROM public.categories WHERE slug='concealed-lights'), 'Precision optic downlight', 'RAZER precision optic delivers a razor-sharp beam for architectural highlights.', 900, 349, '18W', '5 inch', '3000K/4000K', 'Aluminium', '3 Years', true, false, true, true, 'gold'),

  ('aurona-tube-light-20w','AUR-TUBE-20',    'Aurona T5 LED Tube 20W', (SELECT id FROM public.categories WHERE slug='tube-lights'), '4-foot linear LED with instant on', 'Energy-efficient linear LED with instant on, high lumen output and flicker-free driver.', 450, 249, '20W', '4 ft', '6500K', 'Aluminium + PC', '2 Years', true, true, false, true, 'cool'),
  ('aurona-batten-22w',    'AUR-BAT-22',     'Aurona Batten 22W',      (SELECT id FROM public.categories WHERE slug='tube-lights'), 'Slim wall/ceiling batten', 'Sleek batten for kitchens, corridors and workspaces.', 520, 289, '22W', '4 ft', '6500K', 'Aluminium', '2 Years', false, false, false, true, 'cool'),

  ('panel-square-12w', 'AUR-PNL-SQ-12',  'Square LED Panel 12W', (SELECT id FROM public.categories WHERE slug='panel-lights'), 'Edge-lit slim square panel', 'Ultra-slim edge-lit panel for suspended ceilings and drop-ceiling grids.', 700, 349, '12W', '6 inch', '4000K', 'Aluminium + PC', '2 Years', true, false, true, true, 'amber'),
  ('panel-round-18w',  'AUR-PNL-RD-18',  'Round LED Panel 18W',  (SELECT id FROM public.categories WHERE slug='panel-lights'), 'Round surface mount panel', 'Uniform illumination with driver-included compact design.', 900, 449, '18W', '8 inch', '6500K', 'Aluminium', '2 Years', false, true, false, true, 'cool'),

  ('street-light-50w', 'AUR-STR-50', 'Aurona Street Light 50W', (SELECT id FROM public.categories WHERE slug='street-lights'), 'IP66 highway grade street light', 'Corrosion-resistant IP66 housing with wide beam and surge protection.', 3500, 1899, '50W', 'Large', '5700K', 'Die-cast Aluminium', '3 Years', true, true, false, true, 'gold'),
  ('street-light-100w','AUR-STR-100','Aurona Street Light 100W',(SELECT id FROM public.categories WHERE slug='street-lights'), 'High-output arterial street LED', 'High-output LED for arterial roads and industrial yards.', 6500, 3499, '100W', 'XL', '5700K', 'Die-cast Aluminium', '3 Years', false, false, true, true, 'gold'),

  ('flood-30w',  'AUR-FLD-30',  'Aurona Flood Light 30W',  (SELECT id FROM public.categories WHERE slug='flood-lights'), 'Slim outdoor flood', 'Slim, weatherproof flood for facades, gardens and signage.', 1400, 799,  '30W',  'Medium', '6500K', 'Aluminium', '2 Years', true, false, true, true, 'cool'),
  ('flood-100w', 'AUR-FLD-100', 'Aurona Flood Light 100W', (SELECT id FROM public.categories WHERE slug='flood-lights'), 'Stadium grade flood', 'High-output flood for grounds, warehouses and construction sites.', 4200, 2499, '100W', 'Large', '6500K', 'Aluminium', '3 Years', false, true, false, true, 'gold'),

  ('bulb-9w',  'AUR-BULB-9',  'Aurona LED Bulb 9W',  (SELECT id FROM public.categories WHERE slug='led-bulbs'), 'Everyday B22 LED bulb', 'Reliable everyday LED with instant-on and long life.', 180, 79,  '9W',  'B22', '6500K', 'PC', '1 Year', true, true, false, true, 'cool'),
  ('bulb-15w', 'AUR-BULB-15', 'Aurona LED Bulb 15W', (SELECT id FROM public.categories WHERE slug='led-bulbs'), 'Bright high-lumen bulb', 'High-lumen bulb for large rooms and shops.', 260, 129, '15W', 'B22', '6500K', 'PC', '1 Year', false, false, true, true, 'warm'),

  ('mirror-light-slim',  'AUR-MIR-SLIM',  'Slim Mirror Light',   (SELECT id FROM public.categories WHERE slug='mirror-lights'), 'Bathroom mirror LED strip', 'Modern IP44 mirror light with warm/cool switching.', 1200, 649, '12W', '600mm', '3000K/6500K', 'Aluminium', '2 Years', true, false, true, true, 'warm'),

  ('interior-cove-strip','AUR-INT-STRIP', 'Aurona Cove LED Strip 5m', (SELECT id FROM public.categories WHERE slug='interior-lights'), 'Cuttable 5m LED cove strip', '24V high-density cove strip with adhesive backing for architectural coves and false ceilings.', 1500, 799, '48W', '5m', '3000K', 'PCB + PVC', '2 Years', true, true, false, true, 'gold'),

  ('ceiling-fan-1200',   'AUR-CFN-1200',  'Aurona Breeze 1200mm Ceiling Fan', (SELECT id FROM public.categories WHERE slug='ceiling-fans'), 'BLDC 5-star energy rated ceiling fan', 'BLDC motor, remote controlled, 5-star rated energy saving ceiling fan.', 3800, 2499, '28W', '1200mm', NULL, 'ABS + Steel', '2 Years', true, true, true, true, 'cool'),
  ('ceiling-fan-decor',  'AUR-CFN-DECOR', 'Aurona Decor Ceiling Fan', (SELECT id FROM public.categories WHERE slug='ceiling-fans'), 'Underlight decorative ceiling fan', 'Premium decorative ceiling fan with integrated underlight.', 5500, 3299, '32W', '1200mm', NULL, 'Metal + ABS', '2 Years', false, false, true, true, 'amber'),

  ('table-fan-400',      'AUR-TFN-400',   'Aurona 400mm Table Fan', (SELECT id FROM public.categories WHERE slug='table-fans'), 'High-speed 3-blade table fan', 'High-air-delivery table fan with 3 speeds and stable weighted base.', 2200, 1399, '55W', '400mm', NULL, 'ABS + Steel', '1 Year', false, true, false, true, 'cool'),

  ('exhaust-fan-200',    'AUR-EXH-200',   'Aurona Exhaust Fan 200mm', (SELECT id FROM public.categories WHERE slug='exhaust-fans'), 'Kitchen/bathroom exhaust fan', 'Powerful exhaust for kitchens and bathrooms with quiet operation.', 1500, 849, '40W', '200mm', NULL, 'ABS', '1 Year', false, false, false, true, 'cool'),

  ('heater-room-2000',   'AUR-HTR-2000',  'Aurona Room Heater 2000W', (SELECT id FROM public.categories WHERE slug='heaters'), 'Fan-forced room heater', 'Dual-mode fan-forced room heater with tip-over and overheat protection.', 2800, 1699, '2000W', 'Standard', NULL, 'Metal', '1 Year', true, false, true, true, 'amber'),
  ('heater-halogen',     'AUR-HTR-HAL',   'Aurona Halogen Heater', (SELECT id FROM public.categories WHERE slug='heaters'), 'Instant warmth halogen heater', 'Three-rod halogen heater with oscillation for instant, targeted warmth.', 2200, 1299, '1200W', 'Standard', NULL, 'Metal + PC', '1 Year', false, true, false, true, 'warm');

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
