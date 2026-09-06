-- Forward-only product admin parity. This migration is safe to stage after the
-- Phase 2A migrations and is intentionally not applied by this changeset.

ALTER TABLE public.product_families
  ADD COLUMN IF NOT EXISTS meta_title text,
  ADD COLUMN IF NOT EXISTS meta_description text,
  ADD COLUMN IF NOT EXISTS meta_image_url text,
  ADD COLUMN IF NOT EXISTS video_provider text,
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS specification_pdf_url text,
  ADD COLUMN IF NOT EXISTS shipping_type text NOT NULL DEFAULT 'calculated',
  ADD COLUMN IF NOT EXISTS shipping_cost numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipping_cost_per_quantity boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS estimated_shipping_days integer,
  ADD COLUMN IF NOT EXISTS refundable boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS refund_note text;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS meta_title text,
  ADD COLUMN IF NOT EXISTS meta_description text,
  ADD COLUMN IF NOT EXISTS meta_image_url text,
  ADD COLUMN IF NOT EXISTS video_provider text,
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS specification_pdf_url text,
  ADD COLUMN IF NOT EXISTS shipping_type text NOT NULL DEFAULT 'calculated',
  ADD COLUMN IF NOT EXISTS shipping_cost numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipping_cost_per_quantity boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS estimated_shipping_days integer,
  ADD COLUMN IF NOT EXISTS refundable boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS refund_note text;

ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS barcode text;
CREATE UNIQUE INDEX IF NOT EXISTS product_variants_barcode_unique
  ON public.product_variants(barcode) WHERE barcode IS NOT NULL AND barcode <> '';

CREATE TABLE IF NOT EXISTS public.product_related_families (
  family_id uuid NOT NULL REFERENCES public.product_families(id) ON DELETE CASCADE,
  related_family_id uuid NOT NULL REFERENCES public.product_families(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (family_id, related_family_id),
  CHECK (family_id <> related_family_id)
);

CREATE TABLE IF NOT EXISTS public.catalog_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('brand','attribute','colour','warranty','size_guide')),
  name text NOT NULL,
  code text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(kind,name)
);
ALTER TABLE public.catalog_options ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.catalog_options TO anon, authenticated;
GRANT ALL ON public.catalog_options TO service_role;
DROP POLICY IF EXISTS catalog_options_public_read ON public.catalog_options;
CREATE POLICY catalog_options_public_read ON public.catalog_options FOR SELECT USING (active AND archived_at IS NULL);
ALTER TABLE public.product_related_families ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.product_related_families TO anon, authenticated;
GRANT ALL ON public.product_related_families TO service_role;
DROP POLICY IF EXISTS product_related_families_public_read ON public.product_related_families;
CREATE POLICY product_related_families_public_read ON public.product_related_families FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION public.admin_upsert_product_family_v2(_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _result jsonb; _family_id uuid; _product_id uuid;
BEGIN
  _result := public.admin_upsert_product_family(_payload);
  _family_id := (_result->>'family_id')::uuid;
  _product_id := (_result->>'product_id')::uuid;
  UPDATE public.product_families SET
    meta_title = NULLIF(_payload->>'meta_title',''), meta_description = NULLIF(_payload->>'meta_description',''),
    meta_image_url = NULLIF(_payload->>'meta_image_url',''), video_provider = NULLIF(_payload->>'video_provider',''),
    video_url = NULLIF(_payload->>'video_url',''), specification_pdf_url = NULLIF(_payload->>'specification_pdf_url',''),
    shipping_type = COALESCE(NULLIF(_payload->>'shipping_type',''),'calculated'),
    shipping_cost = COALESCE(NULLIF(_payload->>'shipping_cost','')::numeric,0),
    shipping_cost_per_quantity = COALESCE((_payload->>'shipping_cost_per_quantity')::boolean,false),
    estimated_shipping_days = NULLIF(_payload->>'estimated_shipping_days','')::integer,
    refundable = COALESCE((_payload->>'refundable')::boolean,true), refund_note = NULLIF(_payload->>'refund_note','')
  WHERE id = _family_id;
  UPDATE public.products SET
    meta_title = NULLIF(_payload->>'meta_title',''), meta_description = NULLIF(_payload->>'meta_description',''),
    meta_image_url = NULLIF(_payload->>'meta_image_url',''), video_provider = NULLIF(_payload->>'video_provider',''),
    video_url = NULLIF(_payload->>'video_url',''), specification_pdf_url = NULLIF(_payload->>'specification_pdf_url',''),
    shipping_type = COALESCE(NULLIF(_payload->>'shipping_type',''),'calculated'),
    shipping_cost = COALESCE(NULLIF(_payload->>'shipping_cost','')::numeric,0),
    shipping_cost_per_quantity = COALESCE((_payload->>'shipping_cost_per_quantity')::boolean,false),
    estimated_shipping_days = NULLIF(_payload->>'estimated_shipping_days','')::integer,
    refundable = COALESCE((_payload->>'refundable')::boolean,true), refund_note = NULLIF(_payload->>'refund_note','')
  WHERE id = _product_id;
  RETURN _result;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_set_product_family_state(_family_ids uuid[], _action text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _family_id uuid;
BEGIN
  IF _action NOT IN ('publish','unpublish','archive','restore','feature','unfeature','deal','undeal') THEN
    RAISE EXCEPTION 'unsupported family action';
  END IF;
  UPDATE public.product_families SET
    is_published = CASE WHEN _action = 'publish' THEN true WHEN _action IN ('unpublish','archive') THEN false ELSE is_published END,
    archived_at = CASE WHEN _action = 'archive' THEN now() WHEN _action = 'restore' THEN NULL ELSE archived_at END,
    is_featured = CASE WHEN _action = 'feature' THEN true WHEN _action = 'unfeature' THEN false ELSE is_featured END,
    is_bestseller = CASE WHEN _action = 'deal' THEN true WHEN _action = 'undeal' THEN false ELSE is_bestseller END,
    updated_at = now()
  WHERE id = ANY(_family_ids);
  FOREACH _family_id IN ARRAY _family_ids LOOP PERFORM public.refresh_product_family(_family_id); END LOOP;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_duplicate_product_family(_family_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE src public.product_families%ROWTYPE; result jsonb; new_family uuid; new_product uuid; suffix text; v record;
BEGIN
  SELECT * INTO src FROM public.product_families WHERE id = _family_id AND archived_at IS NULL FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'product family not found'; END IF;
  suffix := upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
  result := public.admin_upsert_product_family_v2(jsonb_build_object(
    'name', src.name || ' (Copy)', 'sku', src.main_sku || '-COPY-' || suffix,
    'slug', src.slug || '-copy-' || lower(suffix), 'brand', src.brand, 'category_id', src.category_id,
    'short_description', src.short_description, 'description', src.description, 'mrp', COALESCE(src.min_mrp,0),
    'price', COALESCE(src.min_price,0), 'stock', 0, 'unit', src.unit, 'wattage', src.wattage, 'size', src.size,
    'color_temp', src.color_temp, 'material', src.material, 'warranty', src.warranty, 'model', src.model,
    'body_type', src.body_type, 'features', src.features, 'specifications', src.specifications,
    'image_seed', src.image_seed, 'is_published', false, 'is_featured', false, 'is_bestseller', false,
    'is_new', src.is_new, 'is_sale', src.is_sale, 'affiliate_enabled', src.affiliate_enabled,
    'affiliate_commission_kind', src.affiliate_commission_kind, 'affiliate_commission_value', src.affiliate_commission_value,
    'affiliate_max_commission', src.affiliate_max_commission, 'weight_g', src.weight_g, 'dim_l', src.dim_l,
    'dim_w', src.dim_w, 'dim_h', src.dim_h, 'meta_title', src.meta_title, 'meta_description', src.meta_description,
    'meta_image_url', src.meta_image_url, 'video_provider', src.video_provider, 'video_url', src.video_url,
    'specification_pdf_url', src.specification_pdf_url, 'shipping_type', src.shipping_type,
    'shipping_cost', src.shipping_cost, 'shipping_cost_per_quantity', src.shipping_cost_per_quantity,
    'estimated_shipping_days', src.estimated_shipping_days, 'refundable', src.refundable, 'refund_note', src.refund_note));
  new_family := (result->>'family_id')::uuid; new_product := (result->>'product_id')::uuid;
  DELETE FROM public.product_variants WHERE family_id = new_family;
  FOR v IN SELECT *, row_number() OVER (ORDER BY sort_order,id) AS rn FROM public.product_variants WHERE family_id = _family_id AND archived_at IS NULL LOOP
    INSERT INTO public.product_variants(family_id,sku,barcode,attributes,mrp,price,discount_pct,retailer_price,distributor_price,moq,retailer_moq,distributor_moq,stock,pack_size,weight_g,dim_l,dim_w,dim_h,pack_weight_g,pack_l,pack_w,pack_h,image_seed,is_active,sort_order,low_stock_threshold)
    VALUES(new_family,src.main_sku || '-COPY-' || suffix || '-' || lpad(v.rn::text,2,'0'),NULL,v.attributes,v.mrp,v.price,v.discount_pct,v.retailer_price,v.distributor_price,v.moq,v.retailer_moq,v.distributor_moq,0,v.pack_size,v.weight_g,v.dim_l,v.dim_w,v.dim_h,v.pack_weight_g,v.pack_l,v.pack_w,v.pack_h,v.image_seed,v.is_active,v.sort_order,v.low_stock_threshold);
  END LOOP;
  INSERT INTO public.product_variant_axes(family_id,axis_key,label,values,sort_order) SELECT new_family,axis_key,label,values,sort_order FROM public.product_variant_axes WHERE family_id=_family_id;
  INSERT INTO public.product_images(product_id,family_id,variant_sku,image_url,alt_text,sort_order,is_primary)
    SELECT new_product,new_family,nv.sku,img.image_url,img.alt_text,img.sort_order,img.is_primary
    FROM public.product_images img
    LEFT JOIN public.product_variants ov ON ov.family_id=_family_id AND ov.sku=img.variant_sku
    LEFT JOIN public.product_variants nv ON nv.family_id=new_family AND nv.sort_order=ov.sort_order
    WHERE img.family_id=_family_id;
  PERFORM public.refresh_product_family(new_family);
  RETURN result;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_set_related_product_families(_family_id uuid, _related_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.product_related_families WHERE family_id = _family_id;
  INSERT INTO public.product_related_families(family_id,related_family_id,sort_order)
  SELECT _family_id, related_id, ordinal::integer - 1 FROM unnest(_related_ids) WITH ORDINALITY AS x(related_id,ordinal)
  WHERE related_id <> _family_id;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_save_variant_matrix_v2(
  _family_id uuid, _variants jsonb, _axes jsonb, _actor_user_id uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE item jsonb;
BEGIN
  PERFORM public.admin_save_variant_matrix(_family_id, _variants, _axes, _actor_user_id);
  FOR item IN SELECT value FROM jsonb_array_elements(COALESCE(_variants,'[]'::jsonb)) LOOP
    UPDATE public.product_variants
      SET barcode = NULLIF(btrim(item->>'barcode'),'')
      WHERE family_id = _family_id AND sku = upper(btrim(item->>'sku'));
  END LOOP;
END; $$;

REVOKE ALL ON FUNCTION public.admin_upsert_product_family_v2(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_set_product_family_state(uuid[],text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_duplicate_product_family(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_set_related_product_families(uuid,uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_save_variant_matrix_v2(uuid,jsonb,jsonb,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_upsert_product_family_v2(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_product_family_state(uuid[],text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_duplicate_product_family(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_related_product_families(uuid,uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_save_variant_matrix_v2(uuid,jsonb,jsonb,uuid) TO service_role;
