-- Add new categories
INSERT INTO public.categories (slug, name, parent_group, icon, sort_order) VALUES ('pedestal-fans','Pedestal Fans','fans','Fan',13) ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.categories (slug, name, parent_group, icon, sort_order) VALUES ('immersion-heaters','Immersion Heaters','home-appliances','Flame',14) ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.categories (slug, name, parent_group, icon, sort_order) VALUES ('water-geysers','Water Geysers','home-appliances','Flame',15) ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.categories (slug, name, parent_group, icon, sort_order) VALUES ('madhani','Madhani (Butter Churners)','home-appliances','Zap',16) ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.categories (slug, name, parent_group, icon, sort_order) VALUES ('deep-lights','Deep Lights','led-lighting','CircleDot',17) ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.categories (slug, name, parent_group, icon, sort_order) VALUES ('outdoor-lights','Outdoor Lights','led-lighting','Lamp',18) ON CONFLICT (slug) DO NOTHING;

-- Add variations column
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS variations jsonb DEFAULT '[]'::jsonb;

-- Clear old seed products
DELETE FROM public.cart_items;
DELETE FROM public.wishlist_items;
DELETE FROM public.order_items;
DELETE FROM public.products;