CREATE OR REPLACE FUNCTION public.admin_save_variant_matrix_v3(_family_id uuid, _variants jsonb, _axes jsonb, _actor_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  item jsonb; axis jsonb; current_variant public.product_variants%ROWTYPE;
  current_family public.product_families%ROWTYPE;
  safe_variants jsonb := '[]'::jsonb; adjustments jsonb := '[]'::jsonb;
  desired integer; expected integer; field_name text; normalized_sku text;
BEGIN
  PERFORM 1 FROM public.product_families WHERE id = _family_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Product family not found'; END IF;
  PERFORM 1 FROM public.product_variants WHERE family_id = _family_id ORDER BY id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(_variants) x GROUP BY upper(btrim(x->>'sku')) HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Duplicate SKU in submitted variants';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(_variants) x WHERE NULLIF(x->>'id','') IS NOT NULL GROUP BY x->>'id' HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'A variant was submitted more than once';
  END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(_variants) LOOP
    normalized_sku := upper(btrim(item->>'sku'));
    IF normalized_sku IS NULL OR normalized_sku = '' THEN RAISE EXCEPTION 'Every variant requires a SKU'; END IF;
    IF EXISTS (SELECT 1 FROM public.product_variants WHERE upper(btrim(sku)) = normalized_sku AND id IS DISTINCT FROM NULLIF(item->>'id','')::uuid) THEN
      RAISE EXCEPTION 'SKU % already exists; existing SKUs are never adopted by name', normalized_sku;
    END IF;
    FOREACH field_name IN ARRAY ARRAY[
      'mrp','price','retailer_price','distributor_price','retailer_mrp','distributor_mrp','weight_g','dim_l','dim_w','dim_h',
      'pack_weight_g','pack_l','pack_w','pack_h',
      'retailer_pack_weight_g','retailer_pack_l','retailer_pack_w','retailer_pack_h',
      'distributor_pack_weight_g','distributor_pack_l','distributor_pack_w','distributor_pack_h'
    ] LOOP
      IF (item->>field_name)::numeric < 0 THEN RAISE EXCEPTION '% cannot be negative for SKU %', field_name, normalized_sku; END IF;
    END LOOP;
    IF COALESCE((item->>'is_active')::boolean,false) THEN
      IF NULLIF(item->>'price','') IS NULL OR NULLIF(item->>'mrp','') IS NULL THEN RAISE EXCEPTION 'Enter customer price and MRP before activating SKU %', normalized_sku; END IF;
      FOR axis IN SELECT value FROM jsonb_array_elements(_axes) LOOP
        IF NOT COALESCE((axis->'values') ? (item->'attributes'->>(axis->>'axis_key')),false) THEN
          RAISE EXCEPTION 'Select a valid % for active SKU %', axis->>'label', normalized_sku;
        END IF;
      END LOOP;
    END IF;
    desired := COALESCE((item->>'stock')::integer,0);
    IF desired < 0 THEN RAISE EXCEPTION 'Stock cannot be negative'; END IF;
    IF NULLIF(item->>'id','') IS NULL THEN
      adjustments := adjustments || jsonb_build_array(jsonb_build_object('sku',normalized_sku,'delta',desired));
      safe_variants := safe_variants || jsonb_build_array(item || jsonb_build_object('stock',0));
    ELSE
      SELECT * INTO current_variant FROM public.product_variants WHERE id = (item->>'id')::uuid AND family_id = _family_id AND archived_at IS NULL;
      IF NOT FOUND THEN RAISE EXCEPTION 'Variant does not belong to this family'; END IF;
      IF normalized_sku <> current_variant.sku THEN RAISE EXCEPTION 'Saved SKU % cannot be renamed in a matrix save; its existing references must be migrated explicitly', current_variant.sku; END IF;
      expected := NULLIF(item->>'expected_stock','')::integer;
      IF expected IS NOT NULL AND desired <> expected THEN
        IF current_variant.stock <> expected THEN RAISE EXCEPTION 'Stock changed for SKU %. Reload before adjusting inventory.', normalized_sku; END IF;
        adjustments := adjustments || jsonb_build_array(jsonb_build_object('sku',normalized_sku,'delta',desired-expected));
      ELSIF expected IS NULL AND desired <> current_variant.stock THEN
        RAISE EXCEPTION 'Reload SKU % before changing stock, or use SKU Inventory', normalized_sku;
      END IF;
      safe_variants := safe_variants || jsonb_build_array(item || jsonb_build_object('stock',current_variant.stock));
    END IF;
  END LOOP;
  PERFORM public.admin_save_variant_matrix_v2(_family_id,safe_variants,_axes,_actor_user_id);

  FOR item IN SELECT value FROM jsonb_array_elements(safe_variants) LOOP
    UPDATE public.product_variants
    SET
      retailer_mrp = NULLIF(item->>'retailer_mrp','')::numeric,
      distributor_mrp = NULLIF(item->>'distributor_mrp','')::numeric,
      retailer_pack_weight_g = COALESCE(NULLIF(item->>'retailer_pack_weight_g','')::numeric, NULLIF(item->>'pack_weight_g','')::numeric),
      retailer_pack_l = COALESCE(NULLIF(item->>'retailer_pack_l','')::numeric, NULLIF(item->>'pack_l','')::numeric),
      retailer_pack_w = COALESCE(NULLIF(item->>'retailer_pack_w','')::numeric, NULLIF(item->>'pack_w','')::numeric),
      retailer_pack_h = COALESCE(NULLIF(item->>'retailer_pack_h','')::numeric, NULLIF(item->>'pack_h','')::numeric),
      distributor_pack_weight_g = COALESCE(NULLIF(item->>'distributor_pack_weight_g','')::numeric, NULLIF(item->>'pack_weight_g','')::numeric),
      distributor_pack_l = COALESCE(NULLIF(item->>'distributor_pack_l','')::numeric, NULLIF(item->>'pack_l','')::numeric),
      distributor_pack_w = COALESCE(NULLIF(item->>'distributor_pack_w','')::numeric, NULLIF(item->>'pack_w','')::numeric),
      distributor_pack_h = COALESCE(NULLIF(item->>'distributor_pack_h','')::numeric, NULLIF(item->>'pack_h','')::numeric)
    WHERE family_id = _family_id AND upper(btrim(sku)) = upper(btrim(item->>'sku')) AND archived_at IS NULL;
  END LOOP;

  IF jsonb_array_length(_axes) > 0 AND EXISTS (
    SELECT 1 FROM (
      SELECT v.id, (SELECT jsonb_object_agg(a->>'axis_key',v.attributes->>(a->>'axis_key'))
                    FROM jsonb_array_elements(_axes) a) AS combination
      FROM public.product_variants v
      WHERE v.family_id=_family_id AND v.is_active AND v.archived_at IS NULL
    ) combinations GROUP BY combination HAVING count(*) > 1
  ) THEN RAISE EXCEPTION 'Two active SKUs have the same option combination. Resolve the duplicate before saving.'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(adjustments) LOOP
    IF (item->>'delta')::integer <> 0 THEN
      SELECT * INTO current_variant FROM public.product_variants WHERE family_id = _family_id AND sku = item->>'sku';
      PERFORM public.admin_adjust_inventory(current_variant.id,(item->>'delta')::integer,'Variant editor adjustment',_actor_user_id);
    END IF;
  END LOOP;
  SELECT * INTO current_family FROM public.product_families WHERE id = _family_id;
  FOR current_variant IN SELECT * FROM public.product_variants WHERE family_id = _family_id AND archived_at IS NULL LOOP
    INSERT INTO public.products(
      sku,slug,name,category_id,brand,short_description,description,mrp,price,stock,
      is_published,unit,wattage,size,color_temp,material,warranty,weight_g,dim_l,dim_w,dim_h,
      specifications,rating,review_count
    ) VALUES (
      current_variant.sku,current_family.slug || '--sku-' || current_variant.id::text,
      current_family.name,current_family.category_id,current_family.brand,
      current_family.short_description,current_family.description,current_variant.mrp,current_variant.price,current_variant.stock,
      current_family.is_published AND current_family.archived_at IS NULL AND current_variant.is_active,
      current_family.unit,current_variant.attributes->>'wattage',current_variant.attributes->>'size',
      current_variant.attributes->>'color_temp',current_family.material,current_family.warranty,
      current_variant.weight_g,current_variant.dim_l,current_variant.dim_w,current_variant.dim_h,
      COALESCE(current_family.specifications,'{}'::jsonb) || current_variant.attributes,
      current_family.rating,current_family.review_count
    ) ON CONFLICT (sku) DO NOTHING;
  END LOOP;
  PERFORM public.refresh_product_family(_family_id);
END; $function$;