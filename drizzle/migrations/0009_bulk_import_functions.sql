ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS retailer_discount_pct numeric, ADD COLUMN IF NOT EXISTS distributor_discount_pct numeric;

ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS retailer_stock integer NOT NULL DEFAULT 0 CHECK (retailer_stock >= 0),
  ADD COLUMN IF NOT EXISTS distributor_stock integer NOT NULL DEFAULT 0 CHECK (distributor_stock >= 0),
  ADD COLUMN IF NOT EXISTS retailer_reserved_stock integer NOT NULL DEFAULT 0 CHECK (retailer_reserved_stock >= 0),
  ADD COLUMN IF NOT EXISTS distributor_reserved_stock integer NOT NULL DEFAULT 0 CHECK (distributor_reserved_stock >= 0),
  ADD COLUMN IF NOT EXISTS retailer_pack_size integer CHECK (retailer_pack_size > 0),
  ADD COLUMN IF NOT EXISTS distributor_pack_size integer CHECK (distributor_pack_size > 0);

ALTER TABLE public.product_families ADD COLUMN IF NOT EXISTS frequently_bought_category text;

CREATE OR REPLACE FUNCTION public.admin_import_dynamic_products_v1(_rows jsonb, _actor_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  item jsonb; axis jsonb; fam public.product_families%ROWTYPE; variant public.product_variants%ROWTYPE;
  category_id uuid; program_id uuid; batch_id uuid; result jsonb;
  created_products integer := 0; updated_products integer := 0; created_variants integer := 0; updated_variants integer := 0;
  attrs jsonb; function_name text; requested_main_sku text; requested_variant_sku text; family_created boolean;
BEGIN
  IF jsonb_array_length(COALESCE(_rows, '[]'::jsonb)) < 1 OR jsonb_array_length(_rows) > 2000 THEN RAISE EXCEPTION 'Import must contain 1 to 2000 rows'; END IF;
  INSERT INTO public.admin_import_batches(kind,status,row_count,created_by) VALUES ('dynamic_catalog','completed',jsonb_array_length(_rows),_actor_user_id) RETURNING id INTO batch_id;
  FOR item IN SELECT value FROM jsonb_array_elements(_rows) LOOP
    family_created := false;
    function_name := lower(btrim(item->>'function')); requested_main_sku := upper(btrim(item->>'main_sku')); requested_variant_sku := upper(btrim(item->>'variant_sku'));
    IF function_name NOT IN ('create','update') OR requested_main_sku = '' OR requested_variant_sku = '' THEN RAISE EXCEPTION 'Invalid function or SKU at Excel row %', item->>'excel_row'; END IF;
    SELECT id INTO category_id FROM public.categories WHERE lower(name)=lower(btrim(item->>'category_name')) LIMIT 1;
    IF category_id IS NULL THEN RAISE EXCEPTION 'Unknown category at Excel row %', item->>'excel_row'; END IF;
    SELECT * INTO fam FROM public.product_families f WHERE f.id = NULLIF(item->>'family_id','')::uuid OR f.main_sku = requested_main_sku LIMIT 1 FOR UPDATE;
    IF function_name='create' AND NOT FOUND THEN
      result := public.admin_upsert_product_family(jsonb_build_object(
        'name',item->>'product_name','sku',requested_main_sku,'slug',lower(regexp_replace(item->>'product_name','[^a-zA-Z0-9]+','-','g'))||'-'||lower(replace(requested_main_sku,'-','')),
        'category_id',category_id,'brand',COALESCE(NULLIF(item->>'brand',''),'AURONA'),'unit',COALESCE(NULLIF(item->>'unit',''),'Pc'),
        'model',NULLIF(item->>'model',''),'short_description',NULLIF(item->>'short_description',''),'description',NULLIF(item->>'description',''),
        'warranty',NULLIF(item->>'warranty',''),'mrp',COALESCE(NULLIF(item->>'mrp','')::numeric,0),'price',COALESCE(NULLIF(item->>'customer_price','')::numeric,0),'stock',0,'is_published',false
      ));
      SELECT * INTO fam FROM public.product_families WHERE id=(result->>'family_id')::uuid FOR UPDATE; created_products:=created_products+1;
      family_created := true;
    ELSIF function_name='update' AND NOT FOUND THEN RAISE EXCEPTION 'Update target Main SKU % was not found',requested_main_sku;
    ELSIF function_name='update' THEN
      UPDATE public.product_families SET
        name=COALESCE(NULLIF(item->>'product_name',''),name), category_id=category_id,
        brand=COALESCE(NULLIF(item->>'brand',''),brand), unit=COALESCE(NULLIF(item->>'unit',''),unit), model=COALESCE(NULLIF(item->>'model',''),model),
        short_description=COALESCE(NULLIF(item->>'short_description',''),short_description), description=COALESCE(NULLIF(item->>'description',''),description),
        warranty=COALESCE(NULLIF(item->>'warranty',''),warranty), updated_at=now()
      WHERE id=fam.id RETURNING * INTO fam; updated_products:=updated_products+1;
    END IF;
    UPDATE public.product_families SET
      meta_title=COALESCE(NULLIF(item->>'seo_title',''),meta_title),
      meta_description=COALESCE(NULLIF(item->>'seo_description',''),meta_description),
      estimated_shipping_days=COALESCE(NULLIF(item->>'shipping_days','')::integer,estimated_shipping_days),
      refundable=CASE WHEN NULLIF(item->>'refundable','') IS NULL THEN refundable ELSE lower(item->>'refundable') IN ('yes','true','1') END,
      warranty=COALESCE(NULLIF(item->>'warranty',''),warranty),
      is_sale=CASE WHEN NULLIF(item->>'sale_status','') IS NULL THEN is_sale ELSE lower(item->>'sale_status') IN ('sale','deal','yes','true','1') END,
      updated_at=now()
    WHERE id=fam.id RETURNING * INTO fam;
    attrs := COALESCE(item->'attributes','{}'::jsonb);
    IF family_created THEN
      DELETE FROM public.product_variants WHERE family_id=fam.id AND sku=requested_main_sku AND attributes='{}'::jsonb;
    END IF;
    FOR axis IN SELECT value FROM jsonb_array_elements(COALESCE(item->'variation_axes','[]'::jsonb)) LOOP
      INSERT INTO public.product_variant_axes(family_id,axis_key,label,values,sort_order)
      VALUES(fam.id,lower(regexp_replace(btrim(axis->>'name'),'[^a-zA-Z0-9]+','_','g')),btrim(axis->>'name'),jsonb_build_array(axis->>'value'),COALESCE((axis->>'sort_order')::integer,0))
      ON CONFLICT(family_id,axis_key) DO UPDATE SET
        label=EXCLUDED.label,
        sort_order=LEAST(product_variant_axes.sort_order,EXCLUDED.sort_order),
        values=(SELECT jsonb_agg(value ORDER BY ordinal) FROM (
          SELECT value,MIN(ordinal) ordinal FROM jsonb_array_elements_text(product_variant_axes.values||EXCLUDED.values) WITH ORDINALITY AS x(value,ordinal) GROUP BY value
        ) distinct_values);
    END LOOP;
    IF EXISTS(SELECT 1 FROM public.product_variants v WHERE v.sku=requested_variant_sku AND v.family_id<>fam.id) THEN RAISE EXCEPTION 'Variant SKU % belongs to another product',requested_variant_sku; END IF;
    SELECT * INTO variant FROM public.product_variants v WHERE v.id=NULLIF(item->>'variant_id','')::uuid OR (v.family_id=fam.id AND v.sku=requested_variant_sku) LIMIT 1 FOR UPDATE;
    IF function_name='create' AND FOUND THEN RAISE EXCEPTION 'Variant SKU % already exists',requested_variant_sku;
    ELSIF function_name='create' THEN
      INSERT INTO public.product_variants(family_id,sku,attributes,mrp,price,discount_pct,moq,stock,reserved_stock,pack_size,weight_g,dim_l,dim_w,dim_h,pack_weight_g,pack_l,pack_w,pack_h,retailer_price,retailer_moq,retailer_stock,retailer_reserved_stock,retailer_pack_size,retailer_pack_weight_g,retailer_pack_l,retailer_pack_w,retailer_pack_h,distributor_price,distributor_moq,distributor_stock,distributor_reserved_stock,distributor_pack_size,distributor_pack_weight_g,distributor_pack_l,distributor_pack_w,distributor_pack_h,is_active)
      VALUES(fam.id,requested_variant_sku,attrs,COALESCE((item->>'mrp')::numeric,0),COALESCE((item->>'customer_price')::numeric,0),COALESCE((item->>'customer_discount')::numeric,0),COALESCE((item->>'customer_moq')::integer,1),COALESCE((item->>'customer_stock')::integer,0),COALESCE((item->>'customer_reserved_stock')::integer,0),NULLIF(item->>'customer_pack_size','')::integer,NULLIF(item->>'weight_g','')::numeric,NULLIF(item->>'dim_l','')::numeric,NULLIF(item->>'dim_w','')::numeric,NULLIF(item->>'dim_h','')::numeric,NULLIF(item->>'customer_pack_weight_g','')::numeric,NULLIF(item->>'customer_pack_l','')::numeric,NULLIF(item->>'customer_pack_w','')::numeric,NULLIF(item->>'customer_pack_h','')::numeric,NULLIF(item->>'retailer_price','')::numeric,NULLIF(item->>'retailer_moq','')::integer,COALESCE((item->>'retailer_stock')::integer,0),COALESCE((item->>'retailer_reserved_stock')::integer,0),NULLIF(item->>'retailer_pack_size','')::integer,NULLIF(item->>'retailer_pack_weight_g','')::numeric,NULLIF(item->>'retailer_pack_l','')::numeric,NULLIF(item->>'retailer_pack_w','')::numeric,NULLIF(item->>'retailer_pack_h','')::numeric,NULLIF(item->>'distributor_price','')::numeric,NULLIF(item->>'distributor_moq','')::integer,COALESCE((item->>'distributor_stock')::integer,0),COALESCE((item->>'distributor_reserved_stock')::integer,0),NULLIF(item->>'distributor_pack_size','')::integer,NULLIF(item->>'distributor_pack_weight_g','')::numeric,NULLIF(item->>'distributor_pack_l','')::numeric,NULLIF(item->>'distributor_pack_w','')::numeric,NULLIF(item->>'distributor_pack_h','')::numeric,lower(COALESCE(item->>'active_status','true')) IN ('true','active','yes')) RETURNING * INTO variant;
      created_variants:=created_variants+1;
    ELSIF NOT FOUND THEN RAISE EXCEPTION 'Update target Variant SKU % was not found',requested_variant_sku;
    ELSE
      UPDATE public.product_variants SET attributes=COALESCE(NULLIF(attrs,'{}'::jsonb),attributes),mrp=COALESCE(NULLIF(item->>'mrp','')::numeric,mrp),price=COALESCE(NULLIF(item->>'customer_price','')::numeric,price),discount_pct=COALESCE(NULLIF(item->>'customer_discount','')::numeric,discount_pct),moq=COALESCE(NULLIF(item->>'customer_moq','')::integer,moq),stock=COALESCE(NULLIF(item->>'customer_stock','')::integer,stock),reserved_stock=COALESCE(NULLIF(item->>'customer_reserved_stock','')::integer,reserved_stock),pack_size=COALESCE(NULLIF(item->>'customer_pack_size','')::integer,pack_size),weight_g=COALESCE(NULLIF(item->>'weight_g','')::numeric,weight_g),dim_l=COALESCE(NULLIF(item->>'dim_l','')::numeric,dim_l),dim_w=COALESCE(NULLIF(item->>'dim_w','')::numeric,dim_w),dim_h=COALESCE(NULLIF(item->>'dim_h','')::numeric,dim_h),pack_weight_g=COALESCE(NULLIF(item->>'customer_pack_weight_g','')::numeric,pack_weight_g),pack_l=COALESCE(NULLIF(item->>'customer_pack_l','')::numeric,pack_l),pack_w=COALESCE(NULLIF(item->>'customer_pack_w','')::numeric,pack_w),pack_h=COALESCE(NULLIF(item->>'customer_pack_h','')::numeric,pack_h),retailer_price=COALESCE(NULLIF(item->>'retailer_price','')::numeric,retailer_price),retailer_moq=COALESCE(NULLIF(item->>'retailer_moq','')::integer,retailer_moq),retailer_stock=COALESCE(NULLIF(item->>'retailer_stock','')::integer,retailer_stock),retailer_reserved_stock=COALESCE(NULLIF(item->>'retailer_reserved_stock','')::integer,retailer_reserved_stock),retailer_pack_size=COALESCE(NULLIF(item->>'retailer_pack_size','')::integer,retailer_pack_size),retailer_pack_weight_g=COALESCE(NULLIF(item->>'retailer_pack_weight_g','')::numeric,retailer_pack_weight_g),retailer_pack_l=COALESCE(NULLIF(item->>'retailer_pack_l','')::numeric,retailer_pack_l),retailer_pack_w=COALESCE(NULLIF(item->>'retailer_pack_w','')::numeric,retailer_pack_w),retailer_pack_h=COALESCE(NULLIF(item->>'retailer_pack_h','')::numeric,retailer_pack_h),distributor_price=COALESCE(NULLIF(item->>'distributor_price','')::numeric,distributor_price),distributor_moq=COALESCE(NULLIF(item->>'distributor_moq','')::integer,distributor_moq),distributor_stock=COALESCE(NULLIF(item->>'distributor_stock','')::integer,distributor_stock),distributor_reserved_stock=COALESCE(NULLIF(item->>'distributor_reserved_stock','')::integer,distributor_reserved_stock),distributor_pack_size=COALESCE(NULLIF(item->>'distributor_pack_size','')::integer,distributor_pack_size),distributor_pack_weight_g=COALESCE(NULLIF(item->>'distributor_pack_weight_g','')::numeric,distributor_pack_weight_g),distributor_pack_l=COALESCE(NULLIF(item->>'distributor_pack_l','')::numeric,distributor_pack_l),distributor_pack_w=COALESCE(NULLIF(item->>'distributor_pack_w','')::numeric,distributor_pack_w),distributor_pack_h=COALESCE(NULLIF(item->>'distributor_pack_h','')::numeric,distributor_pack_h),updated_at=now() WHERE id=variant.id RETURNING * INTO variant;
      updated_variants:=updated_variants+1;
    END IF;
    IF NULLIF(item->>'commission_program','') IS NOT NULL THEN
      SELECT id INTO program_id FROM public.referral_programs WHERE lower(name)=lower(item->>'commission_program') LIMIT 1;
      IF program_id IS NULL THEN RAISE EXCEPTION 'Unknown Partner Program at Excel row %',item->>'excel_row'; END IF;
      INSERT INTO public.variant_program_commissions(variant_id,program_id,commission_kind,commission_value,max_commission,is_active)
      VALUES(variant.id,program_id,lower(item->>'commission_type'),COALESCE((item->>'commission_value')::numeric,0),NULLIF(item->>'max_commission','')::numeric,true)
      ON CONFLICT(variant_id,program_id) DO UPDATE SET commission_kind=EXCLUDED.commission_kind,commission_value=EXCLUDED.commission_value,max_commission=EXCLUDED.max_commission,is_active=true;
    END IF;
    INSERT INTO public.admin_import_items(batch_id,family_id,product_id,sku) VALUES(batch_id,fam.id,fam.legacy_product_id,requested_variant_sku);
    PERFORM public.refresh_product_family(fam.id);
  END LOOP;
  RETURN jsonb_build_object('batch_id',batch_id,'created_products',created_products,'updated_products',updated_products,'created_variants',created_variants,'updated_variants',updated_variants);
END; $$;

REVOKE ALL ON FUNCTION public.admin_import_dynamic_products_v1(jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_import_dynamic_products_v1(jsonb,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_import_dynamic_products_v2(_rows jsonb, _actor_user_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  item jsonb; result jsonb; fam_id uuid; requested_main_sku text; requested_variant_sku text;
  requested_family_id uuid; requested_variant_id uuid; extra_attrs jsonb; matched_id uuid;
BEGIN
  FOR item IN SELECT value FROM jsonb_array_elements(COALESCE(_rows, '[]'::jsonb)) LOOP
    requested_main_sku := upper(btrim(item->>'main_sku'));
    requested_variant_sku := upper(btrim(item->>'variant_sku'));
    requested_family_id := NULLIF(btrim(item->>'family_id'), '')::uuid;
    requested_variant_id := NULLIF(btrim(item->>'variant_id'), '')::uuid;
    IF requested_family_id IS NOT NULL THEN
      matched_id := NULL;
      SELECT f.id INTO matched_id FROM public.product_families f WHERE f.id = requested_family_id AND f.main_sku = requested_main_sku;
      IF matched_id IS NULL THEN RAISE EXCEPTION 'family_id does not match Main SKU % at Excel row %', requested_main_sku, item->>'excel_row'; END IF;
    END IF;
    IF requested_variant_id IS NOT NULL THEN
      matched_id := NULL;
      SELECT v.id INTO matched_id FROM public.product_variants v JOIN public.product_families f ON f.id = v.family_id
      WHERE v.id = requested_variant_id AND upper(v.sku) = requested_variant_sku AND f.main_sku = requested_main_sku;
      IF matched_id IS NULL THEN RAISE EXCEPTION 'variant_id does not match Variant SKU/Main SKU at Excel row %', item->>'excel_row'; END IF;
    END IF;
  END LOOP;

  result := public.admin_import_dynamic_products_v1(_rows, _actor_user_id);

  FOR item IN SELECT value FROM jsonb_array_elements(COALESCE(_rows, '[]'::jsonb)) LOOP
    requested_main_sku := upper(btrim(item->>'main_sku'));
    requested_variant_sku := upper(btrim(item->>'variant_sku'));
    fam_id := NULL;
    SELECT id INTO fam_id FROM public.product_families WHERE main_sku = requested_main_sku LIMIT 1;
    IF fam_id IS NULL THEN RAISE EXCEPTION 'Imported family % could not be reloaded', requested_main_sku; END IF;
    IF NULLIF(item->>'attributes_json', '') IS NULL THEN extra_attrs := '{}'::jsonb;
    ELSE
      extra_attrs := (item->>'attributes_json')::jsonb;
      IF jsonb_typeof(extra_attrs) <> 'object' THEN RAISE EXCEPTION 'attributes_json must be a JSON object at Excel row %', item->>'excel_row'; END IF;
    END IF;
    UPDATE public.product_variants SET
      barcode = COALESCE(NULLIF(btrim(item->>'barcode'), ''), barcode),
      retailer_discount_pct = COALESCE(NULLIF(item->>'retailer_discount', '')::numeric, retailer_discount_pct),
      distributor_discount_pct = COALESCE(NULLIF(item->>'distributor_discount', '')::numeric, distributor_discount_pct),
      is_active = CASE WHEN NULLIF(btrim(item->>'active_status'), '') IS NULL THEN is_active ELSE lower(btrim(item->>'active_status')) IN ('true','active','yes','1') END,
      attributes = extra_attrs || COALESCE(item->'attributes', '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object('variant_label', NULLIF(btrim(item->>'variant_name'), ''))),
      updated_at = now()
    WHERE family_id = fam_id AND upper(sku) = requested_variant_sku;
    IF NOT FOUND THEN RAISE EXCEPTION 'Imported variant % could not be reloaded', requested_variant_sku; END IF;
    UPDATE public.product_families SET
      frequently_bought_category = COALESCE(NULLIF(btrim(item->>'frequently_bought_category'), ''), frequently_bought_category),
      updated_at = now()
    WHERE id = fam_id;
    IF NULLIF(btrim(item->>'features'), '') IS NOT NULL THEN
      UPDATE public.product_families SET features = to_jsonb(regexp_split_to_array(regexp_replace(item->>'features', E'\r', '', 'g'), E'\n+')), updated_at = now() WHERE id = fam_id;
    END IF;
    PERFORM public.refresh_product_family(fam_id);
  END LOOP;
  RETURN result;
END; $$;

REVOKE ALL ON FUNCTION public.admin_import_dynamic_products_v2(jsonb, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_import_dynamic_products_v2(jsonb, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_import_dynamic_products_v3(_rows jsonb, _actor_user_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  item jsonb; clean_rows jsonb; result jsonb; variant_id_value uuid; program_row record; specific_program_id uuid;
  commission_set_on text; commission_norm text; commission_kind_value text; commission_value_value numeric;
  max_commission_value numeric; axis_matches boolean; program_count integer;
BEGIN
  SELECT COALESCE(jsonb_agg(value - 'commission_program' - 'commission_set_on' - 'commission_type' - 'commission_value' - 'max_commission'), '[]'::jsonb)
  INTO clean_rows FROM jsonb_array_elements(COALESCE(_rows, '[]'::jsonb));

  result := public.admin_import_dynamic_products_v2(clean_rows, _actor_user_id);
  SELECT count(*) INTO program_count FROM public.referral_programs;

  FOR item IN SELECT value FROM jsonb_array_elements(COALESCE(_rows, '[]'::jsonb)) LOOP
    commission_set_on := COALESCE(NULLIF(btrim(item->>'commission_set_on'), ''), NULLIF(btrim(item->>'commission_program'), ''));
    IF commission_set_on IS NULL THEN CONTINUE; END IF;
    commission_norm := lower(regexp_replace(btrim(commission_set_on), '[[:space:]]+', ' ', 'g'));
    commission_kind_value := lower(NULLIF(btrim(item->>'commission_type'), ''));
    commission_value_value := NULLIF(btrim(item->>'commission_value'), '')::numeric;
    max_commission_value := NULLIF(btrim(item->>'max_commission'), '')::numeric;
    IF commission_kind_value IS NULL OR commission_kind_value NOT IN ('percentage', 'fixed') THEN RAISE EXCEPTION 'Commission Type must be Percentage or Fixed at Excel row %', item->>'excel_row'; END IF;
    IF commission_value_value IS NULL OR commission_value_value < 0 THEN RAISE EXCEPTION 'Commission Value must be 0 or greater at Excel row %', item->>'excel_row'; END IF;
    IF commission_kind_value = 'percentage' AND commission_value_value > 100 THEN RAISE EXCEPTION 'Percentage commission cannot exceed 100 at Excel row %', item->>'excel_row'; END IF;
    IF max_commission_value IS NOT NULL AND max_commission_value < 0 THEN RAISE EXCEPTION 'Max commission cannot be negative at Excel row %', item->>'excel_row'; END IF;
    variant_id_value := NULL;
    SELECT v.id INTO variant_id_value FROM public.product_variants v WHERE upper(v.sku) = upper(btrim(item->>'variant_sku')) LIMIT 1;
    IF variant_id_value IS NULL THEN RAISE EXCEPTION 'Imported variant % could not be found for commission setup at Excel row %', item->>'variant_sku', item->>'excel_row'; END IF;
    specific_program_id := NULL;
    SELECT p.id INTO specific_program_id FROM public.referral_programs p WHERE lower(regexp_replace(btrim(p.name), '[[:space:]]+', ' ', 'g')) = commission_norm LIMIT 1;
    SELECT EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(item->'variation_axes', '[]'::jsonb)) axis
      WHERE lower(regexp_replace(btrim(COALESCE(axis->>'name', axis->>'label', axis->>'axis_key', '')), '[[:space:]]+', ' ', 'g')) = commission_norm) INTO axis_matches;
    IF commission_norm IN ('all variants', '__all') OR axis_matches THEN
      IF program_count = 0 THEN RAISE EXCEPTION 'No partner programs exist for Commission Set on "%" at Excel row %', commission_set_on, item->>'excel_row'; END IF;
      FOR program_row IN SELECT id FROM public.referral_programs LOOP
        INSERT INTO public.variant_program_commissions(variant_id, program_id, commission_kind, commission_value, max_commission, is_active)
        VALUES(variant_id_value, program_row.id, commission_kind_value, commission_value_value, max_commission_value, true)
        ON CONFLICT(variant_id, program_id) DO UPDATE SET commission_kind = EXCLUDED.commission_kind, commission_value = EXCLUDED.commission_value, max_commission = EXCLUDED.max_commission, is_active = true;
      END LOOP;
    ELSIF specific_program_id IS NOT NULL THEN
      INSERT INTO public.variant_program_commissions(variant_id, program_id, commission_kind, commission_value, max_commission, is_active)
      VALUES(variant_id_value, specific_program_id, commission_kind_value, commission_value_value, max_commission_value, true)
      ON CONFLICT(variant_id, program_id) DO UPDATE SET commission_kind = EXCLUDED.commission_kind, commission_value = EXCLUDED.commission_value, max_commission = EXCLUDED.max_commission, is_active = true;
    ELSE
      RAISE EXCEPTION 'Unknown Commission Set on "%" at Excel row %. Expected All Variants, a variation axis, or an existing partner program.', commission_set_on, item->>'excel_row';
    END IF;
  END LOOP;
  RETURN result;
END; $$;

REVOKE ALL ON FUNCTION public.admin_import_dynamic_products_v3(jsonb, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_import_dynamic_products_v3(jsonb, uuid) TO service_role;

NOTIFY pgrst, 'reload schema';