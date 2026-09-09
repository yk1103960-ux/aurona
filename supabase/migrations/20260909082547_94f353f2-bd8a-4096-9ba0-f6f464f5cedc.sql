REVOKE SELECT (retailer_price, retailer_moq, distributor_price, distributor_moq)
  ON public.product_variants FROM anon;
REVOKE SELECT (retailer_price, retailer_moq, distributor_price, distributor_moq)
  ON public.product_variants FROM authenticated;