GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_variants TO authenticated;
GRANT ALL ON public.product_variants TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_families TO authenticated;
GRANT ALL ON public.product_families TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_variant_axes TO authenticated;
GRANT ALL ON public.product_variant_axes TO service_role;

CREATE POLICY "admin manage product variants" ON public.product_variants
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));

CREATE POLICY "admin manage product families" ON public.product_families
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));

CREATE POLICY "admin manage product variant axes" ON public.product_variant_axes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));