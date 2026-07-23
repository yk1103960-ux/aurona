DELETE FROM public.product_families WHERE category_id IN (SELECT id FROM public.categories WHERE slug='mirror-lights');
DELETE FROM public.products WHERE category_id IN (SELECT id FROM public.categories WHERE slug='mirror-lights');
DELETE FROM public.categories WHERE slug='mirror-lights';