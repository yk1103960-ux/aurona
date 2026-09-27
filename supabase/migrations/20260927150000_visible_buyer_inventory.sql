BEGIN;

-- Return only the inventory values appropriate for the caller's pricing role.
-- This keeps customer/retailer/distributor stock independent on storefronts.
CREATE OR REPLACE FUNCTION public.get_visible_inventory(_skus text[])
RETURNS TABLE (
  sku text,
  stock integer,
  reserved_stock integer,
  pack_size integer,
  moq integer,
  role text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH caller AS (
    SELECT public.current_pricing_role() AS role
  )
  SELECT
    v.sku,
    CASE caller.role
      WHEN 'retailer' THEN COALESCE(v.retailer_stock, 0)
      WHEN 'distributor' THEN COALESCE(v.distributor_stock, 0)
      ELSE COALESCE(v.stock, 0)
    END AS stock,
    CASE caller.role
      WHEN 'retailer' THEN COALESCE(v.retailer_reserved_stock, 0)
      WHEN 'distributor' THEN COALESCE(v.distributor_reserved_stock, 0)
      ELSE COALESCE(v.reserved_stock, 0)
    END AS reserved_stock,
    CASE caller.role
      WHEN 'retailer' THEN COALESCE(v.retailer_pack_size, v.pack_size, 1)
      WHEN 'distributor' THEN COALESCE(v.distributor_pack_size, v.pack_size, 1)
      ELSE COALESCE(v.pack_size, 1)
    END AS pack_size,
    CASE caller.role
      WHEN 'retailer' THEN COALESCE(v.retailer_moq, v.moq, 1)
      WHEN 'distributor' THEN COALESCE(v.distributor_moq, v.moq, 1)
      ELSE COALESCE(v.moq, 1)
    END AS moq,
    caller.role::text
  FROM public.product_variants v
  CROSS JOIN caller
  WHERE v.sku = ANY(_skus)
    AND v.is_active
    AND v.archived_at IS NULL
    AND (
      caller.role = 'admin'
      OR (caller.role = 'retailer' AND COALESCE(v.available_retailer, true))
      OR (caller.role = 'distributor' AND COALESCE(v.available_distributor, true))
      OR (caller.role NOT IN ('retailer','distributor','admin') AND COALESCE(v.available_customer, true))
    );
$$;

REVOKE ALL ON FUNCTION public.get_visible_inventory(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_visible_inventory(text[]) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
