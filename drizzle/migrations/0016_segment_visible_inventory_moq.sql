CREATE OR REPLACE FUNCTION public.get_visible_inventory(_skus text[])
RETURNS TABLE(sku text, stock integer, reserved_stock integer, pack_size integer, moq integer, role text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH r AS (SELECT public.current_pricing_role() AS role)
  SELECT v.sku,
    (CASE r.role WHEN 'retailer' THEN COALESCE(v.retailer_stock, v.stock) WHEN 'distributor' THEN COALESCE(v.distributor_stock, v.stock) ELSE v.stock END)::integer,
    (CASE r.role WHEN 'retailer' THEN COALESCE(v.retailer_reserved_stock, 0) WHEN 'distributor' THEN COALESCE(v.distributor_reserved_stock, 0) ELSE COALESCE(v.reserved_stock, 0) END)::integer,
    GREATEST(1, CASE r.role WHEN 'retailer' THEN COALESCE(v.retailer_pack_size, v.pack_size, 1) WHEN 'distributor' THEN COALESCE(v.distributor_pack_size, v.pack_size, 1) ELSE COALESCE(v.pack_size, 1) END)::integer,
    GREATEST(1, CASE r.role WHEN 'retailer' THEN COALESCE(v.retailer_moq, v.moq, 1) WHEN 'distributor' THEN COALESCE(v.distributor_moq, v.moq, 1) ELSE COALESCE(v.moq, 1) END)::integer,
    r.role
  FROM public.product_variants v CROSS JOIN r
  WHERE v.sku = ANY(_skus) AND v.archived_at IS NULL AND v.is_active;
$$;
GRANT EXECUTE ON FUNCTION public.get_visible_inventory(text[]) TO anon, authenticated, service_role;