GRANT SELECT (
  id, family_id, sku, attributes, mrp, price, discount_pct, moq, stock,
  weight_g, pack_size, pack_weight_g, dim_l, dim_w, dim_h, pack_l, pack_w,
  pack_h, image_seed, sort_order, created_at, is_active, archived_at,
  available_customer, available_retailer, available_distributor,
  retailer_pack_weight_g, retailer_pack_l, retailer_pack_w, retailer_pack_h,
  distributor_pack_weight_g, distributor_pack_l, distributor_pack_w, distributor_pack_h
) ON public.product_variants TO anon, authenticated;
GRANT ALL ON public.product_variants TO service_role;