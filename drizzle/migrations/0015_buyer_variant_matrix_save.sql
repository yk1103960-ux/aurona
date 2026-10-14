CREATE OR REPLACE FUNCTION public.admin_save_buyer_variant_matrix_v1(
  _family_id uuid, _buyer_type text, _axes jsonb, _variants jsonb, _actor_user_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  item jsonb; axis jsonb; existing public.product_variants%ROWTYPE;
  current_family public.product_families%ROWTYPE;
  saved_skus text[] := '{}'; old_skus text[] := '{}'; normalized_sku text;
  incoming_id uuid; key text; keys text[] := '{}'; combination text;
  combinations text[] := '{}';
  actual_sku text; mapping jsonb := '{}'::jsonb;
BEGIN
  PERFORM set_config('aurona.variant_matrix_save','on',true);
  IF _buyer_type NOT IN ('retailer','distributor') THEN RAISE EXCEPTION 'Unsupported buyer type'; END IF;
  IF jsonb_typeof(_axes) IS DISTINCT FROM 'array' OR jsonb_array_length(_axes) > 20 THEN
    RAISE EXCEPTION 'Invalid variation options'; END IF;
  IF jsonb_typeof(_variants) IS DISTINCT FROM 'array' OR jsonb_array_length(_variants) > 500 THEN
    RAISE EXCEPTION 'Invalid variation rows'; END IF;
  PERFORM 1 FROM public.product_families WHERE id = _family_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Product family not found'; END IF;
  SELECT * INTO current_family FROM public.product_families WHERE id = _family_id;
  PERFORM 1 FROM public.product_variants WHERE family_id = _family_id ORDER BY id FOR UPDATE;
  SELECT variant_skus INTO old_skus FROM public.product_variant_buyer_setups
    WHERE family_id = _family_id AND buyer_type = _buyer_type FOR UPDATE;
  old_skus := COALESCE(old_skus, '{}'::text[]);

  FOR axis IN SELECT value FROM jsonb_array_elements(_axes) LOOP
    IF btrim(COALESCE(axis->>'axis_key','')) = '' OR btrim(COALESCE(axis->>'label','')) = ''
      OR jsonb_typeof(axis->'values') IS DISTINCT FROM 'array'
      OR jsonb_array_length(axis->'values') = 0 THEN RAISE EXCEPTION 'Every option needs a name and values'; END IF;
    key := lower(btrim(axis->>'axis_key'));
    IF key = ANY(keys) THEN RAISE EXCEPTION 'Duplicate variation option %', key; END IF;
    keys := array_append(keys, key);
  END LOOP;

  FOR item IN SELECT value FROM jsonb_array_elements(_variants) LOOP
    normalized_sku := upper(btrim(COALESCE(item->>'sku','')));
    IF normalized_sku = '' THEN RAISE EXCEPTION 'Every variant needs a SKU'; END IF;
    IF normalized_sku = ANY(saved_skus) THEN RAISE EXCEPTION 'Duplicate SKU %', normalized_sku; END IF;
    FOREACH key IN ARRAY keys LOOP
      IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(_axes) a
        WHERE lower(btrim(a->>'axis_key')) = key AND (a->'values') ? (item->'attributes'->>key)) THEN
        RAISE EXCEPTION 'Invalid or missing variation value for % in SKU %', key, normalized_sku;
      END IF;
    END LOOP;
    SELECT string_agg(lower(btrim(item->'attributes'->>selected_key)), chr(31)
      ORDER BY array_position(keys, selected_key)) INTO combination
      FROM unnest(keys) AS selected(selected_key);
    IF combination = ANY(combinations) THEN
      RAISE EXCEPTION 'Duplicate variation combination for SKU %', normalized_sku;
    END IF;
    combinations := array_append(combinations, combination);
    incoming_id := NULLIF(item->>'id','')::uuid;
    IF incoming_id IS NOT NULL THEN
      SELECT * INTO existing FROM public.product_variants
        WHERE id = incoming_id AND family_id = _family_id AND archived_at IS NULL;
      IF NOT FOUND OR upper(existing.sku) <> normalized_sku THEN
        RAISE EXCEPTION 'Saved SKU identity changed. Reload before saving %', normalized_sku; END IF;
      IF (existing.attributes - 'variant_label') IS DISTINCT FROM
         (COALESCE(item->'attributes','{}'::jsonb) - 'variant_label') THEN
        RAISE EXCEPTION 'Saved SKU % has different option values. Regenerate instead of changing its shared identity', normalized_sku;
      END IF;
    ELSE
      SELECT * INTO existing FROM public.product_variants
        WHERE family_id = _family_id AND archived_at IS NULL
          AND (attributes - 'variant_label') = (COALESCE(item->'attributes','{}'::jsonb) - 'variant_label')
        ORDER BY is_active DESC, created_at LIMIT 1;
      IF NOT FOUND THEN
        IF EXISTS (SELECT 1 FROM public.product_variants WHERE upper(sku) = normalized_sku) THEN
          RAISE EXCEPTION 'SKU % is already in use', normalized_sku; END IF;
        INSERT INTO public.product_variants(family_id, sku, attributes, mrp, price, stock, moq,
          sort_order, is_active, available_customer, available_retailer, available_distributor)
        VALUES (_family_id, normalized_sku, COALESCE(item->'attributes','{}'::jsonb),
          COALESCE((item->>'mrp')::numeric,0), COALESCE((item->>'price')::numeric,0), 0, 1,
          COALESCE((item->>'sort_order')::integer,0), COALESCE((item->>'is_active')::boolean,true),
          false, _buyer_type = 'retailer' AND COALESCE((item->>'is_active')::boolean,true),
          _buyer_type = 'distributor' AND COALESCE((item->>'is_active')::boolean,true)) RETURNING * INTO existing;
        INSERT INTO public.products(
          sku,slug,name,category_id,brand,short_description,description,mrp,price,stock,
          is_published,unit,wattage,size,color_temp,material,warranty,weight_g,dim_l,dim_w,dim_h,
          specifications,rating,review_count
        ) VALUES (
          existing.sku,current_family.slug || '--sku-' || existing.id::text,
          current_family.name,current_family.category_id,current_family.brand,
          current_family.short_description,current_family.description,existing.mrp,existing.price,existing.stock,
          current_family.is_published AND current_family.archived_at IS NULL AND existing.is_active,
          current_family.unit,existing.attributes->>'wattage',existing.attributes->>'size',
          existing.attributes->>'color_temp',current_family.material,current_family.warranty,
          existing.weight_g,existing.dim_l,existing.dim_w,existing.dim_h,
          COALESCE(current_family.specifications,'{}'::jsonb) || existing.attributes,
          current_family.rating,current_family.review_count
        ) ON CONFLICT (sku) DO NOTHING;
      END IF;
    END IF;
    actual_sku := existing.sku;
    IF actual_sku = ANY(saved_skus) THEN RAISE EXCEPTION 'Duplicate variation combination %', actual_sku; END IF;
    IF _buyer_type = 'retailer' THEN
      UPDATE public.product_variants SET
        retailer_mrp = (item->>'retailer_mrp')::numeric,
        retailer_price = (item->>'retailer_price')::numeric,
        retailer_discount_pct = (item->>'retailer_discount_pct')::numeric,
        retailer_moq = (item->>'retailer_moq')::integer,
        retailer_stock = COALESCE((item->>'retailer_stock')::integer, existing.retailer_stock),
        retailer_pack_size = (item->>'retailer_pack_size')::integer,
        retailer_pack_weight_g = (item->>'retailer_pack_weight_g')::numeric,
        retailer_pack_l = (item->>'retailer_pack_l')::numeric,
        retailer_pack_w = (item->>'retailer_pack_w')::numeric,
        retailer_pack_h = (item->>'retailer_pack_h')::numeric,
        available_retailer = COALESCE((item->>'is_active')::boolean,true),
        is_active = CASE WHEN available_customer IS FALSE AND available_distributor IS FALSE
          THEN COALESCE((item->>'is_active')::boolean,true) ELSE is_active END,
        updated_at = now()
      WHERE id = existing.id;
    ELSE
      UPDATE public.product_variants SET
        distributor_mrp = (item->>'distributor_mrp')::numeric,
        distributor_price = (item->>'distributor_price')::numeric,
        distributor_discount_pct = (item->>'distributor_discount_pct')::numeric,
        distributor_moq = (item->>'distributor_moq')::integer,
        distributor_stock = COALESCE((item->>'distributor_stock')::integer, existing.distributor_stock),
        distributor_pack_size = (item->>'distributor_pack_size')::integer,
        distributor_pack_weight_g = (item->>'distributor_pack_weight_g')::numeric,
        distributor_pack_l = (item->>'distributor_pack_l')::numeric,
        distributor_pack_w = (item->>'distributor_pack_w')::numeric,
        distributor_pack_h = (item->>'distributor_pack_h')::numeric,
        available_distributor = COALESCE((item->>'is_active')::boolean,true),
        is_active = CASE WHEN available_customer IS FALSE AND available_retailer IS FALSE
          THEN COALESCE((item->>'is_active')::boolean,true) ELSE is_active END,
        updated_at = now()
      WHERE id = existing.id;
    END IF;
    saved_skus := array_append(saved_skus, actual_sku);
    mapping := mapping || jsonb_build_object(normalized_sku, actual_sku);
  END LOOP;

  IF _buyer_type = 'retailer' THEN
    UPDATE public.product_variants SET available_retailer = false, updated_at = now()
      WHERE family_id = _family_id AND sku = ANY(old_skus) AND NOT (sku = ANY(saved_skus));
  ELSE
    UPDATE public.product_variants SET available_distributor = false, updated_at = now()
      WHERE family_id = _family_id AND sku = ANY(old_skus) AND NOT (sku = ANY(saved_skus));
  END IF;
  UPDATE public.product_variants SET is_active = false, updated_at = now()
    WHERE family_id = _family_id AND sku = ANY(old_skus) AND NOT (sku = ANY(saved_skus))
      AND available_customer IS FALSE AND available_retailer IS FALSE AND available_distributor IS FALSE;

  INSERT INTO public.product_variant_buyer_setups(family_id,buyer_type,axes,variant_skus,updated_at)
    VALUES (_family_id,_buyer_type,_axes,saved_skus,now())
    ON CONFLICT (family_id,buyer_type) DO UPDATE SET
      axes = EXCLUDED.axes, variant_skus = EXCLUDED.variant_skus, updated_at = now();
  PERFORM set_config('aurona.variant_matrix_save','off',true);
  PERFORM public.refresh_product_family(_family_id);
  RETURN mapping;
END; $$;
REVOKE ALL ON FUNCTION public.admin_save_buyer_variant_matrix_v1(uuid,text,jsonb,jsonb,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_save_buyer_variant_matrix_v1(uuid,text,jsonb,jsonb,uuid) TO service_role;
NOTIFY pgrst, 'reload schema';