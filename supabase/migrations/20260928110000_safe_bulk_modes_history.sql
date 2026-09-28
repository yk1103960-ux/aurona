BEGIN;

DO $$ BEGIN
  IF to_regprocedure('public.admin_import_dynamic_products_v3(jsonb,uuid)') IS NULL THEN
    RAISE EXCEPTION 'Apply the existing dynamic import v3 migration before safe bulk modes/history';
  END IF;
END $$;

-- This audit table deliberately has no foreign keys to catalog tables. Removing
-- an audit record cannot cascade to a product, variant, SKU or stock record.
CREATE TABLE public.admin_bulk_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL CHECK (action IN ('CREATE', 'UPDATE')),
  file_name text NOT NULL,
  category_name text,
  products_processed integer NOT NULL DEFAULT 0,
  successful integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  skipped integer NOT NULL DEFAULT 0,
  status text NOT NULL CHECK (status IN ('completed', 'partial', 'failed')),
  details jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid,
  actor_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);
CREATE INDEX admin_bulk_history_created_at_idx ON public.admin_bulk_history(created_at DESC);
ALTER TABLE public.admin_bulk_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_bulk_history FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_bulk_history TO service_role;

-- Use a new entry point; do not change legacy imports or their migrations.
-- Each Main SKU is imported in a subtransaction. A failing product rolls back
-- all its variants, while other product groups can succeed independently.
CREATE FUNCTION public.admin_import_dynamic_products_safe_v1(
  _rows jsonb, _actor_user_id uuid, _mode text, _file_name text, _category text, _actor_email text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  mode_value text := upper(btrim(COALESCE(_mode, '')));
  product_group record;
  item jsonb;
  sku_value text;
  family_id_value uuid;
  variant_id_value uuid;
  before_values jsonb;
  after_values jsonb;
  import_result jsonb;
  history_details jsonb := '[]'::jsonb;
  success_count integer := 0;
  fail_count integer := 0;
  skip_count integer := 0;
  processed_count integer := 0;
  history_id_value uuid;
  error_message text;
  seen_combinations jsonb;
  buyer_type text;
BEGIN
  IF mode_value NOT IN ('CREATE', 'UPDATE') THEN
    RAISE EXCEPTION 'Select Create Products or Update Products';
  END IF;
  IF _rows IS NULL OR jsonb_typeof(_rows) <> 'array'
     OR jsonb_array_length(_rows) NOT BETWEEN 1 AND 2000 THEN
    RAISE EXCEPTION 'Import must contain 1 to 2000 rows';
  END IF;
  IF COALESCE(length(btrim(_file_name)), 0) > 255 THEN
    RAISE EXCEPTION 'File name is too long';
  END IF;

  -- Lock the batch to serialize imports through this entry point. Catalog
  -- uniqueness constraints remain the final guard against other writers.
  PERFORM pg_advisory_xact_lock(551872941);
  FOR product_group IN
    SELECT upper(btrim(value->>'main_sku')) AS main_sku,
           jsonb_agg(value ORDER BY ordinality) AS group_rows
    FROM jsonb_array_elements(_rows) WITH ORDINALITY AS entries(value, ordinality)
    GROUP BY upper(btrim(value->>'main_sku'))
    ORDER BY upper(btrim(value->>'main_sku'))
  LOOP
    processed_count := processed_count + 1;
    sku_value := product_group.main_sku;
    BEGIN
      IF sku_value IS NULL OR sku_value = '' THEN
        RAISE EXCEPTION 'Main SKU is required';
      END IF;
      SELECT f.id INTO family_id_value
      FROM public.product_families f WHERE upper(f.main_sku) = sku_value
      LIMIT 1 FOR UPDATE;
      IF mode_value = 'CREATE' AND family_id_value IS NOT NULL THEN
        RAISE EXCEPTION 'Product already exists. Please use Update Products to modify this product. Main SKU: %', sku_value;
      ELSIF mode_value = 'UPDATE' AND family_id_value IS NULL THEN
        RAISE EXCEPTION 'Product does not exist. Please use Create Products first. Main SKU: %', sku_value;
      END IF;
      IF mode_value = 'CREATE' AND EXISTS (
        SELECT 1 FROM public.product_variants v WHERE upper(v.sku) = sku_value
      ) THEN
        RAISE EXCEPTION 'Main SKU % already exists as a Variant SKU. Use a new SKU.', sku_value;
      END IF;
      IF mode_value = 'CREATE' AND EXISTS (
        SELECT 1 FROM public.product_families f JOIN public.categories c ON c.id = f.category_id
        WHERE lower(btrim(f.name)) = lower(btrim(product_group.group_rows->0->>'product_name'))
          AND lower(btrim(c.name)) = lower(btrim(product_group.group_rows->0->>'category_name'))
      ) THEN
        RAISE EXCEPTION 'Product already exists. Please use Update Products to modify this product. Name: %',
          product_group.group_rows->0->>'product_name';
      END IF;

      before_values := '[]'::jsonb;
      seen_combinations := '[]'::jsonb;
      FOR item IN SELECT value FROM jsonb_array_elements(product_group.group_rows) LOOP
        IF lower(btrim(COALESCE(item->>'function', ''))) <> lower(mode_value) THEN
          RAISE EXCEPTION 'Excel row %: Function must be % for this operation', item->>'excel_row', mode_value;
        END IF;
        IF mode_value = 'CREATE' AND (
          NULLIF(btrim(item->>'family_id'), '') IS NOT NULL OR
          NULLIF(btrim(item->>'variant_id'), '') IS NOT NULL
        ) THEN
          RAISE EXCEPTION 'Excel row %: Create Products cannot use existing family_id or variant_id', item->>'excel_row';
        END IF;
        IF mode_value = 'UPDATE' AND NULLIF(btrim(item->>'family_id'), '') IS NOT NULL
           AND item->>'family_id' <> family_id_value::text THEN
          RAISE EXCEPTION 'Excel row %: family_id does not match Main SKU', item->>'excel_row';
        END IF;
        IF NULLIF(btrim(item->>'variant_sku'), '') IS NULL THEN
          RAISE EXCEPTION 'Excel row %: Variant SKU is required', item->>'excel_row';
        END IF;
        FOREACH buyer_type IN ARRAY ARRAY['customer', 'retailer', 'distributor'] LOOP
          IF NULLIF(btrim(item->>(buyer_type || '_pack_weight_g')), '') IS NOT NULL
             OR NULLIF(btrim(item->>(buyer_type || '_pack_l')), '') IS NOT NULL
             OR NULLIF(btrim(item->>(buyer_type || '_pack_w')), '') IS NOT NULL
             OR NULLIF(btrim(item->>(buyer_type || '_pack_h')), '') IS NOT NULL THEN
            IF COALESCE(NULLIF(item->>(buyer_type || '_pack_weight_g'), '')::numeric, 0) <= 0
               OR COALESCE(NULLIF(item->>(buyer_type || '_pack_l'), '')::numeric, 0) <= 0
               OR COALESCE(NULLIF(item->>(buyer_type || '_pack_w'), '')::numeric, 0) <= 0
               OR COALESCE(NULLIF(item->>(buyer_type || '_pack_h'), '')::numeric, 0) <= 0 THEN
              RAISE EXCEPTION 'Excel row %: % packaging requires Weight, Length, Width and Height', item->>'excel_row', buyer_type;
            END IF;
          END IF;
        END LOOP;
        IF jsonb_typeof(item->'attributes') = 'object' AND item->'attributes' <> '{}'::jsonb THEN
          IF seen_combinations @> jsonb_build_array(item->'attributes') THEN
            RAISE EXCEPTION 'Excel row %: duplicate variation combination for Main SKU %', item->>'excel_row', sku_value;
          END IF;
          seen_combinations := seen_combinations || jsonb_build_array(item->'attributes');
        END IF;
        SELECT v.id INTO variant_id_value FROM public.product_variants v
        WHERE upper(v.sku) = upper(btrim(item->>'variant_sku')) LIMIT 1 FOR UPDATE;
        IF mode_value = 'CREATE' AND variant_id_value IS NOT NULL THEN
          RAISE EXCEPTION 'Excel row %: Variant SKU % already exists. Use Update Products.', item->>'excel_row', item->>'variant_sku';
        ELSIF mode_value = 'UPDATE' AND variant_id_value IS NULL THEN
          RAISE EXCEPTION 'Excel row %: Variant SKU % does not exist. Use Create Products first.', item->>'excel_row', item->>'variant_sku';
        END IF;
        IF mode_value = 'CREATE' AND EXISTS (
          SELECT 1 FROM public.product_families f WHERE upper(f.main_sku) = upper(btrim(item->>'variant_sku'))
        ) THEN
          RAISE EXCEPTION 'Excel row %: Variant SKU % already exists as a Main SKU', item->>'excel_row', item->>'variant_sku';
        END IF;
        IF mode_value = 'UPDATE' AND NULLIF(btrim(item->>'variant_id'), '') IS NOT NULL
           AND item->>'variant_id' <> variant_id_value::text THEN
          RAISE EXCEPTION 'Excel row %: variant_id does not match Variant SKU', item->>'excel_row';
        END IF;
        IF mode_value = 'UPDATE' THEN
          IF NOT EXISTS (SELECT 1 FROM public.product_variants WHERE id = variant_id_value AND family_id = family_id_value) THEN
            RAISE EXCEPTION 'Excel row %: Variant SKU % belongs to another product', item->>'excel_row', item->>'variant_sku';
          END IF;
          IF jsonb_array_length(COALESCE(item->'variation_axes', '[]'::jsonb)) > 0
             AND EXISTS (
               SELECT 1 FROM public.product_variants v
               WHERE v.family_id = family_id_value AND v.id <> variant_id_value
                 AND NOT EXISTS (
                   SELECT 1 FROM jsonb_array_elements(item->'variation_axes') axis
                   WHERE lower(btrim(COALESCE(v.attributes->>(axis->>'name'),
                         v.attributes->>lower(regexp_replace(axis->>'name','[^a-zA-Z0-9]+','_','g')), '')))
                         <> lower(btrim(axis->>'value'))
                 )
             ) THEN
            RAISE EXCEPTION 'Excel row %: variation combination already exists for another variant', item->>'excel_row';
          END IF;
          before_values := before_values || jsonb_build_array(jsonb_build_object(
            'excel_row', item->>'excel_row', 'variant_sku', item->>'variant_sku',
            'family', (SELECT to_jsonb(f) FROM public.product_families f WHERE f.id = family_id_value),
            'variant', (SELECT to_jsonb(v) FROM public.product_variants v WHERE v.id = variant_id_value)
          ));
        END IF;
      END LOOP;
      IF (SELECT count(DISTINCT upper(btrim(value->>'variant_sku')))
          FROM jsonb_array_elements(product_group.group_rows)) <> jsonb_array_length(product_group.group_rows) THEN
        RAISE EXCEPTION 'Duplicate Variant SKU in the uploaded rows for Main SKU %', sku_value;
      END IF;

      -- v3 owns the existing field mapping, pricing and commission logic.
      -- All checks above execute before it can touch this product.
      import_result := public.admin_import_dynamic_products_v3(product_group.group_rows, _actor_user_id);
      after_values := '[]'::jsonb;
      FOR item IN SELECT value FROM jsonb_array_elements(product_group.group_rows) LOOP
        after_values := after_values || jsonb_build_array(jsonb_build_object(
          'excel_row', item->>'excel_row', 'variant_sku', item->>'variant_sku',
          'family', (SELECT to_jsonb(f) FROM public.product_families f WHERE upper(f.main_sku) = sku_value LIMIT 1),
          'variant', (SELECT to_jsonb(v) FROM public.product_variants v WHERE upper(v.sku) = upper(btrim(item->>'variant_sku')) LIMIT 1)
        ));
      END LOOP;
      success_count := success_count + 1;
      history_details := history_details || jsonb_build_array(jsonb_build_object(
        'main_sku', sku_value, 'product_name', product_group.group_rows->0->>'product_name',
        'rows', product_group.group_rows, 'outcome', 'success',
        'before', before_values, 'after', after_values, 'import_result', import_result
      ));
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS error_message = MESSAGE_TEXT;
      IF error_message LIKE 'Product already exists.%' OR error_message LIKE 'Product does not exist.%'
         OR error_message LIKE '%Variant SKU % already exists.%' THEN
        skip_count := skip_count + 1;
      ELSE
        fail_count := fail_count + 1;
      END IF;
      history_details := history_details || jsonb_build_array(jsonb_build_object(
        'main_sku', sku_value, 'product_name', product_group.group_rows->0->>'product_name',
        'rows', product_group.group_rows,
        'outcome', CASE WHEN error_message LIKE 'Product already exists.%' OR error_message LIKE 'Product does not exist.%'
                        OR error_message LIKE '%Variant SKU % already exists.%' THEN 'skipped' ELSE 'failed' END,
        'error', error_message
      ));
    END;
  END LOOP;

  IF success_count > 0 THEN
    INSERT INTO public.admin_bulk_history(
      action, file_name, category_name, products_processed, successful,
      failed, skipped, status, details, created_by, actor_email
    ) VALUES (
      mode_value, COALESCE(NULLIF(btrim(_file_name), ''), 'Online entry'),
      NULLIF(btrim(_category), ''), processed_count, success_count,
      fail_count, skip_count, CASE WHEN fail_count + skip_count > 0 THEN 'partial' ELSE 'completed' END,
      history_details, _actor_user_id, _actor_email
    ) RETURNING id INTO history_id_value;
  END IF;
  RETURN jsonb_build_object(
    'history_id', history_id_value, 'action', mode_value, 'products_processed', processed_count,
    'successful', success_count, 'failed', fail_count, 'skipped', skip_count, 'details', history_details
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_import_dynamic_products_safe_v1(jsonb,uuid,text,text,text,text)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_import_dynamic_products_safe_v1(jsonb,uuid,text,text,text,text) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
