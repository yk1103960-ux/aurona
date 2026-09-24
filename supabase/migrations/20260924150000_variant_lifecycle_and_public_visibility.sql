-- Product/variant lifecycle safety and public visibility hardening.

DROP POLICY IF EXISTS "Public read families" ON public.product_families;
CREATE POLICY "Public read families" ON public.product_families
  FOR SELECT TO anon, authenticated
  USING (
    public.current_pricing_role() = 'admin'
    OR (
      is_published
      AND archived_at IS NULL
      AND public.role_can_view(visible_customer, visible_retailer, visible_distributor)
    )
  );

DROP POLICY IF EXISTS "public read products" ON public.products;
CREATE POLICY "public read products" ON public.products
  FOR SELECT TO anon, authenticated
  USING (
    public.current_pricing_role() = 'admin'
    OR (
      is_published
      AND archived_at IS NULL
      AND public.role_can_view(visible_customer, visible_retailer, visible_distributor)
    )
  );

CREATE OR REPLACE FUNCTION public.admin_set_product_variant_state(
  _variant_id uuid,
  _action text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _variant public.product_variants;
BEGIN
  IF _action NOT IN ('archive', 'restore') THEN
    RAISE EXCEPTION 'Unsupported variant action';
  END IF;

  SELECT * INTO _variant
  FROM public.product_variants
  WHERE id = _variant_id
  FOR UPDATE;

  IF _variant.id IS NULL THEN
    RAISE EXCEPTION 'Product variant not found';
  END IF;

  UPDATE public.product_variants
     SET is_active = (_action = 'restore'),
         archived_at = CASE WHEN _action = 'archive' THEN now() ELSE NULL END,
         updated_at = now()
   WHERE id = _variant_id;

  RETURN jsonb_build_object(
    'variant_id', _variant_id,
    'family_id', _variant.family_id,
    'sku', _variant.sku,
    'action', _action
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_product_variant_permanent(_variant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _variant public.product_variants;
BEGIN
  SELECT * INTO _variant
  FROM public.product_variants
  WHERE id = _variant_id
  FOR UPDATE;

  IF _variant.id IS NULL THEN
    RAISE EXCEPTION 'Product variant not found';
  END IF;
  IF _variant.archived_at IS NULL THEN
    RAISE EXCEPTION 'Archive this variant before deleting it permanently';
  END IF;

  -- Preserve historical order facts before the existing ON DELETE SET NULL FK runs.
  UPDATE public.order_items oi
     SET product_snapshot = COALESCE(
           oi.product_snapshot,
           jsonb_build_object(
             'family_id', _variant.family_id,
             'variant_id', _variant.id,
             'sku', COALESCE(oi.sku, _variant.sku),
             'price', oi.price,
             'attributes', COALESCE(oi.variant_attributes, _variant.attributes),
             'deleted_at', now()
           )
         ),
         sku = COALESCE(oi.sku, _variant.sku)
   WHERE oi.variant_id = _variant_id;

  DELETE FROM public.inventory_ledger WHERE variant_id = _variant_id;
  DELETE FROM public.variant_program_commissions WHERE variant_id = _variant_id;
  DELETE FROM public.product_images
   WHERE family_id = _variant.family_id AND variant_sku = _variant.sku;
  DELETE FROM public.product_variants WHERE id = _variant_id;

  RETURN jsonb_build_object(
    'variant_id', _variant_id,
    'family_id', _variant.family_id,
    'sku', _variant.sku
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_product_variant_state(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_delete_product_variant_permanent(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_product_variant_state(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_delete_product_variant_permanent(uuid) TO service_role;
