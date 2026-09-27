BEGIN;

-- Preserve the existing atomic v1 import and complete the fields that exist in
-- the 70-column Product Master template but were not persisted by v1.
CREATE OR REPLACE FUNCTION public.admin_import_dynamic_products_v2(
  _rows jsonb,
  _actor_user_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item jsonb;
  result jsonb;
  fam_id uuid;
  requested_main_sku text;
  requested_variant_sku text;
  extra_attrs jsonb;
BEGIN
  result := public.admin_import_dynamic_products_v1(_rows, _actor_user_id);

  FOR item IN
    SELECT value FROM jsonb_array_elements(COALESCE(_rows, '[]'::jsonb))
  LOOP
    requested_main_sku := upper(btrim(item->>'main_sku'));
    requested_variant_sku := upper(btrim(item->>'variant_sku'));

    SELECT id INTO fam_id
    FROM public.product_families
    WHERE main_sku = requested_main_sku
    LIMIT 1;

    IF fam_id IS NULL THEN
      RAISE EXCEPTION 'Imported family % could not be reloaded', requested_main_sku;
    END IF;

    IF NULLIF(item->>'attributes_json', '') IS NULL THEN
      extra_attrs := '{}'::jsonb;
    ELSE
      extra_attrs := (item->>'attributes_json')::jsonb;
      IF jsonb_typeof(extra_attrs) <> 'object' THEN
        RAISE EXCEPTION 'attributes_json must be a JSON object at Excel row %', item->>'excel_row';
      END IF;
    END IF;

    UPDATE public.product_variants
    SET
      barcode = COALESCE(NULLIF(btrim(item->>'barcode'), ''), barcode),
      retailer_discount_pct = COALESCE(NULLIF(item->>'retailer_discount', '')::numeric, retailer_discount_pct),
      distributor_discount_pct = COALESCE(NULLIF(item->>'distributor_discount', '')::numeric, distributor_discount_pct),
      is_active = CASE
        WHEN NULLIF(btrim(item->>'active_status'), '') IS NULL THEN is_active
        ELSE lower(btrim(item->>'active_status')) IN ('true','active','yes','1')
      END,
      attributes = extra_attrs || COALESCE(item->'attributes', '{}'::jsonb),
      updated_at = now()
    WHERE family_id = fam_id
      AND upper(sku) = requested_variant_sku;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Imported variant % could not be reloaded', requested_variant_sku;
    END IF;

    IF NULLIF(btrim(item->>'features'), '') IS NOT NULL THEN
      UPDATE public.product_families
      SET
        features = to_jsonb(
          regexp_split_to_array(
            regexp_replace(item->>'features', E'\r', '', 'g'),
            E'\n+'
          )
        ),
        updated_at = now()
      WHERE id = fam_id;
    END IF;

    PERFORM public.refresh_product_family(fam_id);
  END LOOP;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_import_dynamic_products_v2(jsonb, uuid)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_import_dynamic_products_v2(jsonb, uuid)
TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
