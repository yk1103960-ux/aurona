-- Buyer-specific option setups. The existing family axes remain the Customer setup.
-- Existing retailer/distributor offerings are snapshotted without changing variants.
BEGIN;
CREATE TABLE IF NOT EXISTS public.product_variant_buyer_setups (
  family_id uuid NOT NULL REFERENCES public.product_families(id) ON DELETE CASCADE,
  buyer_type text NOT NULL CHECK (buyer_type IN ('retailer', 'distributor')),
  axes jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(axes) = 'array'),
  variant_skus text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (family_id, buyer_type)
);
REVOKE ALL ON public.product_variant_buyer_setups FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_variant_buyer_setups TO service_role;

INSERT INTO public.product_variant_buyer_setups(family_id, buyer_type, axes, variant_skus)
SELECT f.id, buyer.buyer_type,
  COALESCE((SELECT jsonb_agg(jsonb_build_object('id', a.id, 'axis_key', a.axis_key, 'label', a.label,
    'values', a.values, 'sort_order', a.sort_order) ORDER BY a.sort_order)
    FROM public.product_variant_axes a WHERE a.family_id = f.id), '[]'::jsonb),
  COALESCE((SELECT array_agg(v.sku ORDER BY v.sort_order) FROM public.product_variants v
    WHERE v.family_id = f.id AND v.archived_at IS NULL AND
      CASE buyer.buyer_type WHEN 'retailer' THEN v.available_retailer IS DISTINCT FROM false
        ELSE v.available_distributor IS DISTINCT FROM false END), '{}'::text[])
FROM public.product_families f
CROSS JOIN (VALUES ('retailer'), ('distributor')) AS buyer(buyer_type)
ON CONFLICT (family_id, buyer_type) DO NOTHING;

-- Customer saves must leave buyer-only active variants alone during option validation.
CREATE OR REPLACE FUNCTION public.admin_save_variant_matrix_v3(
  _family_id uuid, _variants jsonb, _axes jsonb, _actor_user_id uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  item jsonb; axis jsonb; current_variant public.product_variants%ROWTYPE;
  current_family public.product_families%ROWTYPE;
  safe_variants jsonb := '[]'::jsonb; adjustments jsonb := '[]'::jsonb;
  desired integer; expected integer; field_name text; normalized_sku text;
  prior_skus text[];
BEGIN
  PERFORM 1 FROM public.product_families WHERE id = _family_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Product family not found'; END IF;
  -- Stable locks precede the existing transactional matrix save.
  PERFORM 1 FROM public.product_variants WHERE family_id = _family_id ORDER BY id FOR UPDATE;
  SELECT COALESCE(array_agg(sku), '{}'::text[]) INTO prior_skus
    FROM public.product_variants WHERE family_id = _family_id;
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
    FOREACH field_name IN ARRAY ARRAY['mrp','price','retailer_price','distributor_price','weight_g','dim_l','dim_w','dim_h','pack_weight_g','pack_l','pack_w','pack_h'] LOOP
      IF (item->>field_name)::numeric < 0 THEN RAISE EXCEPTION '% cannot be negative for SKU %', field_name, normalized_sku; END IF;
    END LOOP;
    IF COALESCE((item->>'is_active')::boolean,false) AND COALESCE((item->>'available_customer')::boolean,true) THEN
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
      -- Initial inventory also goes through the existing ledger.
      adjustments := adjustments || jsonb_build_array(jsonb_build_object('sku',normalized_sku,'delta',desired));
      safe_variants := safe_variants || jsonb_build_array(item || jsonb_build_object(
        'stock',0,'retailer_price',null,'distributor_price',null,
        'retailer_moq',null,'distributor_moq',null));
    ELSE
      SELECT * INTO current_variant FROM public.product_variants WHERE id = (item->>'id')::uuid AND family_id = _family_id AND archived_at IS NULL;
      IF NOT FOUND THEN RAISE EXCEPTION 'Variant does not belong to this family'; END IF;
      -- Renaming a saved SKU needs a separate reviewed identity/image/cart mapping.
      IF normalized_sku <> current_variant.sku THEN RAISE EXCEPTION 'Saved SKU % cannot be renamed in a matrix save; its existing references must be migrated explicitly', current_variant.sku; END IF;
      expected := NULLIF(item->>'expected_stock','')::integer;
      IF expected IS NOT NULL AND desired <> expected THEN
        IF current_variant.stock <> expected THEN RAISE EXCEPTION 'Stock changed for SKU %. Reload before adjusting inventory.', normalized_sku; END IF;
        adjustments := adjustments || jsonb_build_array(jsonb_build_object('sku',normalized_sku,'delta',desired-expected));
      ELSIF expected IS NULL AND desired <> current_variant.stock THEN
        RAISE EXCEPTION 'Reload SKU % before changing stock, or use SKU Inventory', normalized_sku;
      END IF;
      safe_variants := safe_variants || jsonb_build_array(item || jsonb_build_object(
        'stock',current_variant.stock,
        'retailer_price',current_variant.retailer_price,
        'distributor_price',current_variant.distributor_price,
        'retailer_moq',current_variant.retailer_moq,
        'distributor_moq',current_variant.distributor_moq,
        'is_active',COALESCE((item->>'is_active')::boolean,true)
          OR current_variant.available_retailer OR current_variant.available_distributor));
    END IF;
  END LOOP;
  PERFORM public.admin_save_variant_matrix_v2(_family_id,safe_variants,_axes,_actor_user_id);
  -- The older matrix writer defaults new SKUs to every buyer. Only Customer
  -- explicitly owns these newly generated combinations.
  UPDATE public.product_variants SET available_retailer = false,
    available_distributor = false
    WHERE family_id = _family_id AND NOT (sku = ANY(prior_skus));
  FOR item IN SELECT value FROM jsonb_array_elements(_variants) LOOP
    UPDATE public.product_variants SET
      available_customer = COALESCE((item->>'available_customer')::boolean,true)
        AND COALESCE((item->>'is_active')::boolean,true)
      WHERE family_id = _family_id AND sku = upper(btrim(item->>'sku'));
  END LOOP;
  IF jsonb_array_length(_axes) > 0 AND EXISTS (
    SELECT 1 FROM (
      SELECT v.id, (SELECT jsonb_object_agg(a->>'axis_key',v.attributes->>(a->>'axis_key'))
                    FROM jsonb_array_elements(_axes) a) AS combination
      FROM public.product_variants v
      WHERE v.family_id=_family_id AND v.is_active AND v.archived_at IS NULL AND v.available_customer IS DISTINCT FROM false
    ) combinations GROUP BY combination HAVING count(*) > 1
  ) THEN RAISE EXCEPTION 'Two active SKUs have the same option combination. Resolve the duplicate before saving.'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(adjustments) LOOP
    IF (item->>'delta')::integer <> 0 THEN
      SELECT * INTO current_variant FROM public.product_variants WHERE family_id = _family_id AND sku = item->>'sku';
      PERFORM public.admin_adjust_inventory(current_variant.id,(item->>'delta')::integer,'Variant editor adjustment',_actor_user_id);
    END IF;
  END LOOP;
  -- Maintain the existing products.id bridge used by carts and old URLs.
  -- New rows are projections of real saved SKUs, not another catalog system.
  -- Existing IDs/slugs and order references are never replaced.
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
END; $$;
REVOKE ALL ON FUNCTION public.admin_save_variant_matrix_v3(uuid,jsonb,jsonb,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_save_variant_matrix_v3(uuid,jsonb,jsonb,uuid) TO service_role;

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
        -- Preserve the legacy product bridge used by carts and old URLs.
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
  PERFORM public.refresh_product_family(_family_id);
  RETURN mapping;
END; $$;
REVOKE ALL ON FUNCTION public.admin_save_buyer_variant_matrix_v1(uuid,text,jsonb,jsonb,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_save_buyer_variant_matrix_v1(uuid,text,jsonb,jsonb,uuid) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
