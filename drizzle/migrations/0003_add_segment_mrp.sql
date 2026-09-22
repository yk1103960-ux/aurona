ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS retailer_mrp numeric,
  ADD COLUMN IF NOT EXISTS distributor_mrp numeric;

CREATE OR REPLACE FUNCTION public.get_visible_prices(_skus text[])
 RETURNS TABLE(sku text, mrp numeric, price numeric, role text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r text; dist_visible text; BEGIN
  r := public.current_pricing_role();
  IF r = 'distributor' THEN
    SELECT value INTO dist_visible FROM public.site_settings WHERE key='distributor_price_visible';
    IF COALESCE(dist_visible,'true') = 'true' THEN
      RETURN QUERY SELECT v.sku, COALESCE(v.distributor_mrp, v.mrp), COALESCE(v.distributor_price, v.retailer_price, v.price), r
        FROM public.product_variants v WHERE v.sku = ANY(_skus);
    ELSE
      RETURN QUERY SELECT v.sku, COALESCE(v.distributor_mrp, v.mrp), NULL::numeric, r
        FROM public.product_variants v WHERE v.sku = ANY(_skus);
    END IF;
  ELSIF r = 'retailer' THEN
    RETURN QUERY SELECT v.sku, COALESCE(v.retailer_mrp, v.mrp), COALESCE(v.retailer_price, v.price), r
      FROM public.product_variants v WHERE v.sku = ANY(_skus);
  ELSE
    RETURN QUERY SELECT v.sku, v.mrp, v.price, r
      FROM public.product_variants v WHERE v.sku = ANY(_skus);
  END IF;
END; $function$;