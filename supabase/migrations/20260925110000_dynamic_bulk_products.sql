BEGIN;

ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS retailer_stock integer NOT NULL DEFAULT 0 CHECK (retailer_stock >= 0),
  ADD COLUMN IF NOT EXISTS distributor_stock integer NOT NULL DEFAULT 0 CHECK (distributor_stock >= 0),
  ADD COLUMN IF NOT EXISTS retailer_reserved_stock integer NOT NULL DEFAULT 0 CHECK (retailer_reserved_stock >= 0),
  ADD COLUMN IF NOT EXISTS distributor_reserved_stock integer NOT NULL DEFAULT 0 CHECK (distributor_reserved_stock >= 0),
  ADD COLUMN IF NOT EXISTS retailer_pack_size integer CHECK (retailer_pack_size > 0),
  ADD COLUMN IF NOT EXISTS distributor_pack_size integer CHECK (distributor_pack_size > 0);

COMMENT ON COLUMN public.product_variants.stock IS 'Customer inventory in pieces';
COMMENT ON COLUMN public.product_variants.retailer_stock IS 'Retailer inventory in pieces';
COMMENT ON COLUMN public.product_variants.distributor_stock IS 'Distributor inventory in pieces';

CREATE OR REPLACE FUNCTION public.admin_import_dynamic_products_v1(_rows jsonb, _actor_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  item jsonb; fam public.product_families%ROWTYPE; variant public.product_variants%ROWTYPE;
  category_id uuid; program_id uuid; batch_id uuid; result jsonb;
  created_products integer := 0; updated_products integer := 0; created_variants integer := 0; updated_variants integer := 0;
  attrs jsonb; function_name text; requested_main_sku text; requested_variant_sku text;
BEGIN
  IF jsonb_array_length(COALESCE(_rows, '[]'::jsonb)) < 1 OR jsonb_array_length(_rows) > 2000 THEN RAISE EXCEPTION 'Import must contain 1 to 2000 rows'; END IF;
  INSERT INTO public.admin_import_batches(kind,status,row_count,created_by) VALUES ('dynamic_catalog','completed',jsonb_array_length(_rows),_actor_user_id) RETURNING id INTO batch_id;
  FOR item IN SELECT value FROM jsonb_array_elements(_rows) LOOP
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
    ELSIF function_name='update' AND NOT FOUND THEN RAISE EXCEPTION 'Update target Main SKU % was not found',requested_main_sku;
    ELSIF function_name='update' THEN
      UPDATE public.product_families SET
        name=COALESCE(NULLIF(item->>'product_name',''),name), category_id=category_id,
        brand=COALESCE(NULLIF(item->>'brand',''),brand), unit=COALESCE(NULLIF(item->>'unit',''),unit), model=COALESCE(NULLIF(item->>'model',''),model),
        short_description=COALESCE(NULLIF(item->>'short_description',''),short_description), description=COALESCE(NULLIF(item->>'description',''),description),
        warranty=COALESCE(NULLIF(item->>'warranty',''),warranty), updated_at=now()
      WHERE id=fam.id RETURNING * INTO fam; updated_products:=updated_products+1;
    END IF;
    attrs := COALESCE(item->'attributes','{}'::jsonb);
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
NOTIFY pgrst, 'reload schema';
COMMIT;
