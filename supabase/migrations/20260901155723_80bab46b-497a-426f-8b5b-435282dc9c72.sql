ALTER VIEW public.public_product_variants SET (security_invoker = off);
GRANT SELECT ON public.public_product_variants TO anon, authenticated;
GRANT ALL ON public.public_product_variants TO service_role;