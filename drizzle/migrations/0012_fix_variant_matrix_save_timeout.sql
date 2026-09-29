CREATE OR REPLACE FUNCTION public.refresh_product_family(_family_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  f public.product_families%ROWTYPE;
BEGIN
  -- Matrix saves update many variants in one transaction. Defer the expensive
  -- family/product projection until the matrix routine finishes all row work.
  IF current_setting('aurona.variant_matrix_save', true) = 'on' THEN
    RETURN;
  END IF;

  UPDATE public.product_families
  SET min_price = s.min_price,
      max_price = s.max_price,
      min_mrp = s.min_mrp,
      max_mrp = s.max_mrp,
      total_stock = s.total_stock,
      updated_at = now()
  FROM (
    SELECT min(price) AS min_price, max(price) AS max_price,
           min(mrp) AS min_mrp, max(mrp) AS max_mrp,
           COALESCE(sum(GREATEST(stock, 0)), 0)::integer AS total_stock
    FROM public.product_variants
    WHERE family_id = _family_id AND is_active AND archived_at IS NULL
  ) s
  WHERE id = _family_id
  RETURNING * INTO f;

  IF f.legacy_product_id IS NOT NULL THEN
    UPDATE public.products
    SET slug = f.slug, sku = f.main_sku, name = f.name,
        category_id = f.category_id, brand = f.brand,
        short_description = f.short_description, description = f.description,
        mrp = COALESCE(f.min_mrp, 0), price = COALESCE(f.min_price, 0),
        stock = f.total_stock, unit = f.unit, rating = f.rating,
        review_count = f.review_count, wattage = f.wattage, size = f.size,
        color_temp = f.color_temp, material = f.material,
        warranty = f.warranty, is_featured = f.is_featured,
        is_bestseller = f.is_bestseller, is_new = f.is_new,
        is_sale = f.is_sale, image_seed = f.image_seed,
        is_published = f.is_published AND f.archived_at IS NULL,
        model = f.model, body_type = f.body_type,
        features = f.features, specifications = f.specifications,
        affiliate_enabled = f.affiliate_enabled,
        affiliate_commission_kind = f.affiliate_commission_kind,
        affiliate_commission_value = f.affiliate_commission_value,
        affiliate_max_commission = f.affiliate_max_commission,
        weight_g = f.weight_g, dim_l = f.dim_l,
        dim_h = f.dim_h, archived_at = f.archived_at
    WHERE id = f.legacy_product_id;
  END IF;

  UPDATE public.products p
  SET mrp = v.mrp, price = v.price, stock = v.stock,
      is_published = f.is_published AND f.archived_at IS NULL
        AND v.is_active AND v.archived_at IS NULL,
      weight_g = v.weight_g, dim_l = v.dim_l,
      dim_w = v.dim_w, dim_h = v.dim_h
  FROM public.product_variants v
  WHERE v.family_id = _family_id AND p.sku = v.sku;
END; $$;

REVOKE ALL ON FUNCTION public.refresh_product_family(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_product_family(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_save_variant_matrix_v3(
  _family_id uuid, _variants jsonb, _axes jsonb, _actor_user_id uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  item jsonb; axis jsonb; current_variant public.product_variants%ROWTYPE;
  current_family public.product_families%ROWTYPE;
  safe_variants jsonb := '[]'::jsonb; adjustments jsonb := '[]'::jsonb;
  desired integer; expected integer; field_name text; normalized_sku text;
BEGIN
  -- Suppress trigger and nested refresh work until the whole matrix is saved.
  PERFORM set_config('aurona.variant_matrix_save', 'on', true);

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
    IF EXISTS (
      SELECT 1 FROM public.product_variants
      WHERE upper(btrim(sku)) = normalized_sku
        AND id IS DISTINCT FROM NULLIF(item->>'id','')::uuid
    ) THEN
      RAISE EXCEPTION 'SKU % already exists; existing SKUs are never adopted by name', normalized_sku;
    END IF;
    FOREACH field_name IN ARRAY ARRAY[
      'mrp','price','retailer_price','distributor_price','retailer_mrp','distributor_mrp',
      'weight_g','dim_l','dim_w','dim_h','pack_weight_g','pack_l','pack_w','pack_h',
      'retailer_pack_weight_g','retailer_pack_l','retailer_pack_w','retailer_pack_h',
      'distributor_pack_weight_g','distributor_pack_l','distributor_pack_w','distributor_pack_h'
    ] LOOP
      IF (item->>field_name)::numeric < 0 THEN
        RAISE EXCEPTION '% cannot be negative for SKU %', field_name, normalized_sku;
      END IF;
    END LOOP;
    IF COALESCE((item->>'is_active')::boolean,false) THEN
      IF NULLIF(item->>'price','') IS NULL OR NULLIF(item->>'mrp','') IS NULL THEN
        RAISE EXCEPTION 'Enter customer price and MRP before activating SKU %', normalized_sku;
      END IF;
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
      SELECT * INTO current_variant
      FROM public.product_variants
      WHERE id = (item->>'id')::uuid AND family_id = _family_id AND archived_at IS NULL;
      IF NOT FOUND THEN RAISE EXCEPTION 'Variant does not belong to this family'; END IF;
      IF normalized_sku <> current_variant.sku THEN
        RAISE EXCEPTION 'Saved SKU % cannot be renamed in a matrix save; its existing references must be migrated explicitly', current_variant.sku;
      END IF;
      expected := NULLIF(item->>'expected_stock','')::integer;
      IF expected IS NOT NULL AND desired <> expected THEN
        IF current_variant.stock <> expected THEN
          RAISE EXCEPTION 'Stock changed for SKU %. Reload before adjusting inventory.', normalized_sku;
        END IF;
        adjustments := adjustments || jsonb_build_array(jsonb_build_object('sku',normalized_sku,'delta',desired-expected));
      ELSIF expected IS NULL AND desired <> current_variant.stock THEN
        RAISE EXCEPTION 'Reload SKU % before changing stock, or use SKU Inventory', normalized_sku;
      END IF;
      safe_variants := safe_variants || jsonb_build_array(item || jsonb_build_object('stock',current_variant.stock));
    END IF;
  END LOOP;

  PERFORM public.admin_save_variant_matrix_v2(_family_id,safe_variants,_axes,_actor_user_id);

  -- Persist all buyer-channel fields in one set-based update instead of one
  -- request per SKU. The deferred refresh guard keeps this update inexpensive.
  UPDATE public.product_variants v
  SET retailer_mrp = item.retailer_mrp,
      retailer_price = item.retailer_price,
      retailer_discount_pct = item.retailer_discount_pct,
      retailer_stock = COALESCE(item.retailer_stock, 0),
      retailer_pack_size = item.retailer_pack_size,
      retailer_pack_weight_g = COALESCE(item.retailer_pack_weight_g, item.pack_weight_g),
      retailer_pack_l = COALESCE(item.retailer_pack_l, item.pack_l),
      retailer_pack_w = COALESCE(item.retailer_pack_w, item.pack_w),
      retailer_pack_h = COALESCE(item.retailer_pack_h, item.pack_h),
      distributor_mrp = item.distributor_mrp,
      distributor_price = item.distributor_price,
      distributor_discount_pct = item.distributor_discount_pct,
      distributor_stock = COALESCE(item.distributor_stock, 0),
      distributor_pack_size = item.distributor_pack_size,
      distributor_pack_weight_g = COALESCE(item.distributor_pack_weight_g, item.pack_weight_g),
      distributor_pack_l = COALESCE(item.distributor_pack_l, item.pack_l),
      distributor_pack_w = COALESCE(item.distributor_pack_w, item.pack_w),
      distributor_pack_h = COALESCE(item.distributor_pack_h, item.pack_h),
      available_customer = COALESCE(item.available_customer, v.available_customer),
      available_retailer = COALESCE(item.available_retailer, v.available_retailer),
      available_distributor = COALESCE(item.available_distributor, v.available_distributor),
      updated_at = now()
  FROM jsonb_to_recordset(safe_variants) AS item(
    sku text,
    retailer_mrp numeric, retailer_price numeric, retailer_discount_pct numeric,
    retailer_stock integer, retailer_pack_size integer,
    retailer_pack_weight_g numeric, retailer_pack_l numeric,
    retailer_pack_w numeric, retailer_pack_h numeric,
    distributor_mrp numeric, distributor_price numeric, distributor_discount_pct numeric,
    distributor_stock integer, distributor_pack_size integer,
    distributor_pack_weight_g numeric, distributor_pack_l numeric,
    distributor_pack_w numeric, distributor_pack_h numeric,
    pack_weight_g numeric, pack_l numeric, pack_w numeric, pack_h numeric,
    available_customer boolean, available_retailer boolean, available_distributor boolean
  )
  WHERE v.family_id = _family_id
    AND upper(btrim(v.sku)) = upper(btrim(item.sku))
    AND v.archived_at IS NULL;

  IF jsonb_array_length(_axes) > 0 AND EXISTS (
    SELECT 1 FROM (
      SELECT v.id,
        (SELECT jsonb_object_agg(a->>'axis_key',v.attributes->>(a->>'axis_key'))
         FROM jsonb_array_elements(_axes) a) AS combination
      FROM public.product_variants v
      WHERE v.family_id=_family_id AND v.is_active AND v.archived_at IS NULL
    ) combinations GROUP BY combination HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Two active SKUs have the same option combination. Resolve the duplicate before saving.';
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(adjustments) LOOP
    IF (item->>'delta')::integer <> 0 THEN
      SELECT * INTO current_variant
      FROM public.product_variants
      WHERE family_id = _family_id AND sku = item->>'sku';
      PERFORM public.admin_adjust_inventory(
        current_variant.id, (item->>'delta')::integer,
        'Variant editor adjustment', _actor_user_id
      );
    END IF;
  END LOOP;

  SELECT * INTO current_family FROM public.product_families WHERE id = _family_id;
  FOR current_variant IN
    SELECT * FROM public.product_variants
    WHERE family_id = _family_id AND archived_at IS NULL
  LOOP
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

  -- Re-enable the projection only for the final, single family refresh.
  PERFORM set_config('aurona.variant_matrix_save', 'off', true);
  PERFORM public.refresh_product_family(_family_id);
END; $$;

REVOKE ALL ON FUNCTION public.admin_save_variant_matrix_v3(uuid,jsonb,jsonb,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_save_variant_matrix_v3(uuid,jsonb,jsonb,uuid) TO service_role;
NOTIFY pgrst, 'reload schema';