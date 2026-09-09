CREATE OR REPLACE FUNCTION public.admin_delete_product_family_permanent(_family_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _family public.product_families;
  _legacy_id uuid;
  _variant_ids uuid[];
  _skus text[];
BEGIN
  SELECT * INTO _family FROM public.product_families WHERE id = _family_id FOR UPDATE;
  IF _family.id IS NULL THEN
    RAISE EXCEPTION 'Product family not found';
  END IF;
  _legacy_id := _family.legacy_product_id;

  SELECT COALESCE(array_agg(id), '{}'::uuid[]), COALESCE(array_agg(sku), '{}'::text[])
    INTO _variant_ids, _skus
  FROM public.product_variants WHERE family_id = _family_id;

  -- Preserve order history: snapshot product data onto order lines before FKs are nulled.
  UPDATE public.order_items oi
     SET product_snapshot = COALESCE(
           oi.product_snapshot,
           jsonb_build_object(
             'family_id', _family_id,
             'product_id', oi.product_id,
             'variant_id', oi.variant_id,
             'name', COALESCE(oi.product_name, _family.name),
             'sku', COALESCE(oi.sku, _family.main_sku),
             'brand', _family.brand,
             'slug', _family.slug,
             'price', oi.price,
             'attributes', oi.variant_attributes,
             'deleted_at', now()
           )
         ),
         product_name = COALESCE(oi.product_name, _family.name),
         sku = COALESCE(oi.sku, _family.main_sku)
   WHERE (_legacy_id IS NOT NULL AND oi.product_id = _legacy_id)
      OR (oi.variant_id = ANY(_variant_ids));

  -- Restrictive references must be cleared explicitly.
  DELETE FROM public.inventory_ledger WHERE variant_id = ANY(_variant_ids);
  DELETE FROM public.admin_import_items
   WHERE family_id = _family_id
      OR (_legacy_id IS NOT NULL AND product_id = _legacy_id);

  DELETE FROM public.product_reviews
   WHERE family_id = _family_id
      OR (_legacy_id IS NOT NULL AND product_id = _legacy_id);

  DELETE FROM public.product_related_families
   WHERE family_id = _family_id OR related_family_id = _family_id;
  DELETE FROM public.product_images WHERE family_id = _family_id;
  DELETE FROM public.product_variant_axes WHERE family_id = _family_id;
  DELETE FROM public.product_variants WHERE family_id = _family_id;
  DELETE FROM public.product_families WHERE id = _family_id;

  IF _legacy_id IS NOT NULL THEN
    DELETE FROM public.cart_items WHERE product_id = _legacy_id;
    DELETE FROM public.wishlist_items WHERE product_id = _legacy_id;
    DELETE FROM public.product_images WHERE product_id = _legacy_id;
    DELETE FROM public.products WHERE id = _legacy_id;
  END IF;

  RETURN jsonb_build_object(
    'family_id', _family_id,
    'legacy_product_id', _legacy_id,
    'name', _family.name,
    'main_sku', _family.main_sku,
    'released_skus', _skus
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_product_family_permanent(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_product_family_permanent(uuid) TO service_role;