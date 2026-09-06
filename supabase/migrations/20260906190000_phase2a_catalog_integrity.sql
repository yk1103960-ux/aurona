-- Phase 2A: make product families and SKUs authoritative while preserving the
-- legacy products table as a storefront compatibility projection.

ALTER TABLE public.product_families
  ADD COLUMN IF NOT EXISTS legacy_product_id uuid REFERENCES public.products(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS unit text NOT NULL DEFAULT 'Pc',
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS wattage text,
  ADD COLUMN IF NOT EXISTS size text,
  ADD COLUMN IF NOT EXISTS color_temp text,
  ADD COLUMN IF NOT EXISTS weight_g numeric,
  ADD COLUMN IF NOT EXISTS dim_l numeric,
  ADD COLUMN IF NOT EXISTS dim_w numeric,
  ADD COLUMN IF NOT EXISTS dim_h numeric,
  ADD COLUMN IF NOT EXISTS affiliate_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS affiliate_commission_kind text NOT NULL DEFAULT 'inherit',
  ADD COLUMN IF NOT EXISTS affiliate_commission_value numeric,
  ADD COLUMN IF NOT EXISTS affiliate_max_commission numeric,
  ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS reserved_stock integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS low_stock_threshold integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS archived_at timestamptz;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sku text,
  ADD COLUMN IF NOT EXISTS variant_attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS product_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.product_images ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.coupon_redemptions
  ADD COLUMN IF NOT EXISTS reversed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reversed_by uuid;

CREATE UNIQUE INDEX IF NOT EXISTS product_families_legacy_product_unique
  ON public.product_families(legacy_product_id) WHERE legacy_product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS product_variants_inventory_idx
  ON public.product_variants(family_id, is_active, archived_at, stock);

-- Link families that already share the legacy main SKU.
UPDATE public.product_families f
SET legacy_product_id = p.id,
    unit = COALESCE(p.unit, 'Pc'),
    model = p.model,
    wattage = p.wattage,
    size = p.size,
    color_temp = p.color_temp,
    weight_g = p.weight_g,
    dim_l = p.dim_l,
    dim_w = p.dim_w,
    dim_h = p.dim_h,
    affiliate_enabled = COALESCE(p.affiliate_enabled, true),
    affiliate_commission_kind = COALESCE(p.affiliate_commission_kind, 'inherit'),
    affiliate_commission_value = p.affiliate_commission_value,
    affiliate_max_commission = p.affiliate_max_commission,
    is_published = COALESCE(p.is_published, true)
FROM public.products p
WHERE f.main_sku = p.sku
  AND f.legacy_product_id IS NULL;

-- Every legacy product receives an authoritative family without changing IDs
-- used by carts, wishlists, order items, or external integrations.
INSERT INTO public.product_families (
  slug, main_sku, name, category_id, brand, short_description, description,
  image_seed, is_featured, is_bestseller, is_new, is_sale, min_price,
  max_price, min_mrp, max_mrp, total_stock, rating, review_count, warranty,
  material, body_type, features, specifications, legacy_product_id, unit,
  model, wattage, size, color_temp, weight_g, dim_l, dim_w, dim_h,
  affiliate_enabled, affiliate_commission_kind, affiliate_commission_value,
  affiliate_max_commission, is_published
)
SELECT
  p.slug, p.sku, p.name, p.category_id, p.brand, p.short_description,
  p.description, p.image_seed, p.is_featured, p.is_bestseller, p.is_new,
  p.is_sale, p.price, p.price, p.mrp, p.mrp, p.stock, p.rating,
  p.review_count, p.warranty, p.material, p.body_type, p.features,
  p.specifications, p.id, COALESCE(p.unit, 'Pc'), p.model, p.wattage,
  p.size, p.color_temp, p.weight_g, p.dim_l, p.dim_w, p.dim_h,
  COALESCE(p.affiliate_enabled, true),
  COALESCE(p.affiliate_commission_kind, 'inherit'),
  p.affiliate_commission_value, p.affiliate_max_commission,
  COALESCE(p.is_published, true)
FROM public.products p
WHERE NOT EXISTS (
  SELECT 1 FROM public.product_families f
  WHERE f.legacy_product_id = p.id OR f.main_sku = p.sku
)
ON CONFLICT (main_sku) DO NOTHING;

UPDATE public.product_families f
SET legacy_product_id = p.id
FROM public.products p
WHERE f.main_sku = p.sku AND f.legacy_product_id IS NULL;

-- A single-SKU family is the safe compatibility representation for an older
-- product that has never had variants configured.
INSERT INTO public.product_variants (
  family_id, sku, attributes, mrp, price, discount_pct, moq, stock,
  pack_size, weight_g, dim_l, dim_w, dim_h, image_seed, sort_order, is_active
)
SELECT
  f.id, p.sku,
  jsonb_strip_nulls(jsonb_build_object(
    'model', NULLIF(p.model, ''),
    'wattage', NULLIF(p.wattage, ''),
    'size', NULLIF(p.size, ''),
    'colour_temperature', NULLIF(p.color_temp, ''),
    'body_type', NULLIF(p.body_type, '')
  )),
  p.mrp, p.price,
  CASE WHEN p.mrp > 0 AND p.price < p.mrp
    THEN round(((p.mrp - p.price) / p.mrp) * 100, 2) ELSE 0 END,
  1, p.stock, p.pack_size, p.weight_g, p.dim_l, p.dim_w, p.dim_h,
  p.image_seed, 0, COALESCE(p.is_published, true)
FROM public.product_families f
JOIN public.products p ON p.id = f.legacy_product_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.product_variants v WHERE v.family_id = f.id
)
ON CONFLICT (sku) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.inventory_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id uuid NOT NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
  sku text NOT NULL,
  delta integer NOT NULL CHECK (delta <> 0),
  quantity_after integer NOT NULL CHECK (quantity_after >= 0),
  reason text NOT NULL,
  source text NOT NULL DEFAULT 'admin',
  reference_type text,
  reference_id uuid,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.inventory_ledger ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.inventory_ledger TO authenticated;
GRANT ALL ON public.inventory_ledger TO service_role;
DROP POLICY IF EXISTS inventory_ledger_admin_read ON public.inventory_ledger;
CREATE POLICY inventory_ledger_admin_read ON public.inventory_ledger
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS inventory_ledger_variant_created_idx
  ON public.inventory_ledger(variant_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.refresh_product_family(_family_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  f public.product_families%ROWTYPE;
BEGIN
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
        weight_g = f.weight_g, dim_l = f.dim_l, dim_w = f.dim_w,
        dim_h = f.dim_h, archived_at = f.archived_at
    WHERE id = f.legacy_product_id;
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.trg_refresh_product_family()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.refresh_product_family(COALESCE(NEW.family_id, OLD.family_id));
  RETURN COALESCE(NEW, OLD);
END; $$;

DROP TRIGGER IF EXISTS product_variants_refresh_family ON public.product_variants;
CREATE TRIGGER product_variants_refresh_family
AFTER INSERT OR UPDATE OR DELETE ON public.product_variants
FOR EACH ROW EXECUTE FUNCTION public.trg_refresh_product_family();

CREATE OR REPLACE FUNCTION public.admin_upsert_product_family(_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _product_id uuid := NULLIF(_payload->>'product_id', '')::uuid;
  _family_id uuid;
  _name text := btrim(_payload->>'name');
  _sku text := upper(btrim(_payload->>'sku'));
  _slug text := lower(btrim(_payload->>'slug'));
BEGIN
  IF _name IS NULL OR _name = '' OR _sku IS NULL OR _sku = '' OR _slug IS NULL OR _slug = '' THEN
    RAISE EXCEPTION 'name, sku and slug are required';
  END IF;

  IF _product_id IS NULL THEN
    INSERT INTO public.products (
      name, sku, slug, brand, category_id, short_description, description,
      mrp, price, stock, unit, wattage, size, color_temp, material, warranty,
      model, body_type, pack_size, features, specifications, image_seed,
      is_published, is_featured, is_bestseller, is_new, is_sale,
      affiliate_enabled, affiliate_commission_kind, affiliate_commission_value,
      affiliate_max_commission, weight_g, dim_l, dim_w, dim_h
    ) VALUES (
      _name, _sku, _slug, COALESCE(NULLIF(_payload->>'brand',''),'Aurona'),
      NULLIF(_payload->>'category_id','')::uuid,
      NULLIF(_payload->>'short_description',''), NULLIF(_payload->>'description',''),
      COALESCE((_payload->>'mrp')::numeric,0), COALESCE((_payload->>'price')::numeric,0),
      COALESCE((_payload->>'stock')::integer,0), COALESCE(NULLIF(_payload->>'unit',''),'Pc'),
      NULLIF(_payload->>'wattage',''), NULLIF(_payload->>'size',''),
      NULLIF(_payload->>'color_temp',''), NULLIF(_payload->>'material',''),
      NULLIF(_payload->>'warranty',''), NULLIF(_payload->>'model',''),
      NULLIF(_payload->>'body_type',''), NULLIF(_payload->>'pack_size','')::integer,
      COALESCE(_payload->'features','[]'::jsonb), COALESCE(_payload->'specifications','{}'::jsonb),
      NULLIF(_payload->>'image_seed',''), COALESCE((_payload->>'is_published')::boolean,true),
      COALESCE((_payload->>'is_featured')::boolean,false),
      COALESCE((_payload->>'is_bestseller')::boolean,false),
      COALESCE((_payload->>'is_new')::boolean,false), COALESCE((_payload->>'is_sale')::boolean,false),
      COALESCE((_payload->>'affiliate_enabled')::boolean,true),
      COALESCE(NULLIF(_payload->>'affiliate_commission_kind',''),'inherit'),
      NULLIF(_payload->>'affiliate_commission_value','')::numeric,
      NULLIF(_payload->>'affiliate_max_commission','')::numeric,
      NULLIF(_payload->>'weight_g','')::numeric, NULLIF(_payload->>'dim_l','')::numeric,
      NULLIF(_payload->>'dim_w','')::numeric, NULLIF(_payload->>'dim_h','')::numeric
    ) RETURNING id INTO _product_id;
  END IF;

  SELECT id INTO _family_id FROM public.product_families
  WHERE legacy_product_id = _product_id OR main_sku = _sku LIMIT 1 FOR UPDATE;

  IF _family_id IS NULL THEN
    INSERT INTO public.product_families (
      legacy_product_id, name, main_sku, slug, brand, category_id,
      short_description, description, unit, model, wattage, size, color_temp,
      material, warranty, body_type, features, specifications, image_seed,
      is_published, is_featured, is_bestseller, is_new, is_sale,
      affiliate_enabled, affiliate_commission_kind, affiliate_commission_value,
      affiliate_max_commission, weight_g, dim_l, dim_w, dim_h
    ) VALUES (
      _product_id, _name, _sku, _slug, COALESCE(NULLIF(_payload->>'brand',''),'Aurona'),
      NULLIF(_payload->>'category_id','')::uuid,
      NULLIF(_payload->>'short_description',''), NULLIF(_payload->>'description',''),
      COALESCE(NULLIF(_payload->>'unit',''),'Pc'), NULLIF(_payload->>'model',''),
      NULLIF(_payload->>'wattage',''), NULLIF(_payload->>'size',''), NULLIF(_payload->>'color_temp',''),
      NULLIF(_payload->>'material',''), NULLIF(_payload->>'warranty',''), NULLIF(_payload->>'body_type',''),
      COALESCE(_payload->'features','[]'::jsonb), COALESCE(_payload->'specifications','{}'::jsonb),
      NULLIF(_payload->>'image_seed',''), COALESCE((_payload->>'is_published')::boolean,true),
      COALESCE((_payload->>'is_featured')::boolean,false),
      COALESCE((_payload->>'is_bestseller')::boolean,false),
      COALESCE((_payload->>'is_new')::boolean,false), COALESCE((_payload->>'is_sale')::boolean,false),
      COALESCE((_payload->>'affiliate_enabled')::boolean,true),
      COALESCE(NULLIF(_payload->>'affiliate_commission_kind',''),'inherit'),
      NULLIF(_payload->>'affiliate_commission_value','')::numeric,
      NULLIF(_payload->>'affiliate_max_commission','')::numeric,
      NULLIF(_payload->>'weight_g','')::numeric, NULLIF(_payload->>'dim_l','')::numeric,
      NULLIF(_payload->>'dim_w','')::numeric, NULLIF(_payload->>'dim_h','')::numeric
    ) RETURNING id INTO _family_id;
  ELSE
    UPDATE public.product_families SET
      legacy_product_id = _product_id, name = _name, main_sku = _sku, slug = _slug,
      brand = COALESCE(NULLIF(_payload->>'brand',''),'Aurona'),
      category_id = NULLIF(_payload->>'category_id','')::uuid,
      short_description = NULLIF(_payload->>'short_description',''),
      description = NULLIF(_payload->>'description',''), unit = COALESCE(NULLIF(_payload->>'unit',''),'Pc'),
      model = NULLIF(_payload->>'model',''), wattage = NULLIF(_payload->>'wattage',''),
      size = NULLIF(_payload->>'size',''), color_temp = NULLIF(_payload->>'color_temp',''),
      material = NULLIF(_payload->>'material',''), warranty = NULLIF(_payload->>'warranty',''),
      body_type = NULLIF(_payload->>'body_type',''), features = COALESCE(_payload->'features','[]'::jsonb),
      specifications = COALESCE(_payload->'specifications','{}'::jsonb), image_seed = NULLIF(_payload->>'image_seed',''),
      is_published = COALESCE((_payload->>'is_published')::boolean,true),
      is_featured = COALESCE((_payload->>'is_featured')::boolean,false),
      is_bestseller = COALESCE((_payload->>'is_bestseller')::boolean,false),
      is_new = COALESCE((_payload->>'is_new')::boolean,false), is_sale = COALESCE((_payload->>'is_sale')::boolean,false),
      affiliate_enabled = COALESCE((_payload->>'affiliate_enabled')::boolean,true),
      affiliate_commission_kind = COALESCE(NULLIF(_payload->>'affiliate_commission_kind',''),'inherit'),
      affiliate_commission_value = NULLIF(_payload->>'affiliate_commission_value','')::numeric,
      affiliate_max_commission = NULLIF(_payload->>'affiliate_max_commission','')::numeric,
      weight_g = NULLIF(_payload->>'weight_g','')::numeric, dim_l = NULLIF(_payload->>'dim_l','')::numeric,
      dim_w = NULLIF(_payload->>'dim_w','')::numeric, dim_h = NULLIF(_payload->>'dim_h','')::numeric,
      updated_at = now()
    WHERE id = _family_id;
  END IF;

  INSERT INTO public.product_variants (
    family_id, sku, attributes, mrp, price, stock, moq, pack_size, weight_g,
    dim_l, dim_w, dim_h, image_seed, sort_order, is_active
  )
  SELECT _family_id, _sku, '{}'::jsonb, COALESCE((_payload->>'mrp')::numeric,0),
    COALESCE((_payload->>'price')::numeric,0), COALESCE((_payload->>'stock')::integer,0),
    1, NULLIF(_payload->>'pack_size','')::integer, NULLIF(_payload->>'weight_g','')::numeric,
    NULLIF(_payload->>'dim_l','')::numeric, NULLIF(_payload->>'dim_w','')::numeric,
    NULLIF(_payload->>'dim_h','')::numeric, NULLIF(_payload->>'image_seed',''), 0, true
  WHERE NOT EXISTS (SELECT 1 FROM public.product_variants WHERE family_id = _family_id);

  PERFORM public.refresh_product_family(_family_id);
  RETURN jsonb_build_object('product_id', _product_id, 'family_id', _family_id);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_save_variant_matrix(
  _family_id uuid, _variants jsonb, _axes jsonb, _actor_user_id uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE item jsonb; axis jsonb; _id uuid; _sku text;
BEGIN
  PERFORM 1 FROM public.product_families WHERE id = _family_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'product family not found'; END IF;

  DELETE FROM public.product_variant_axes existing
  WHERE existing.family_id = _family_id
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(_axes, '[]'::jsonb)) incoming
      WHERE incoming->>'axis_key' = existing.axis_key
    );

  FOR axis IN SELECT value FROM jsonb_array_elements(COALESCE(_axes, '[]'::jsonb)) LOOP
    INSERT INTO public.product_variant_axes(family_id, axis_key, label, values, sort_order)
    VALUES (_family_id, axis->>'axis_key', axis->>'label', COALESCE(axis->'values','[]'::jsonb), COALESCE((axis->>'sort_order')::integer,0))
    ON CONFLICT (family_id, axis_key) DO UPDATE SET
      label = EXCLUDED.label, values = EXCLUDED.values, sort_order = EXCLUDED.sort_order;
  END LOOP;

  FOR item IN SELECT value FROM jsonb_array_elements(COALESCE(_variants, '[]'::jsonb)) LOOP
    _id := NULLIF(item->>'id','')::uuid;
    _sku := upper(btrim(item->>'sku'));
    IF _sku = '' THEN RAISE EXCEPTION 'every variant needs a SKU'; END IF;

    IF _id IS NULL THEN
      INSERT INTO public.product_variants(
        family_id, sku, attributes, mrp, price, discount_pct, retailer_price,
        distributor_price, moq, retailer_moq, distributor_moq, stock, pack_size,
        weight_g, dim_l, dim_w, dim_h, pack_weight_g, pack_l, pack_w, pack_h,
        is_active, sort_order, low_stock_threshold
      ) VALUES (
        _family_id, _sku, COALESCE(item->'attributes','{}'::jsonb),
        COALESCE((item->>'mrp')::numeric,0), COALESCE((item->>'price')::numeric,0),
        COALESCE((item->>'discount_pct')::numeric,0), NULLIF(item->>'retailer_price','')::numeric,
        NULLIF(item->>'distributor_price','')::numeric, COALESCE((item->>'moq')::integer,1),
        NULLIF(item->>'retailer_moq','')::integer, NULLIF(item->>'distributor_moq','')::integer,
        COALESCE((item->>'stock')::integer,0), NULLIF(item->>'pack_size','')::integer,
        NULLIF(item->>'weight_g','')::numeric, NULLIF(item->>'dim_l','')::numeric,
        NULLIF(item->>'dim_w','')::numeric, NULLIF(item->>'dim_h','')::numeric,
        NULLIF(item->>'pack_weight_g','')::numeric, NULLIF(item->>'pack_l','')::numeric,
        NULLIF(item->>'pack_w','')::numeric, NULLIF(item->>'pack_h','')::numeric,
        COALESCE((item->>'is_active')::boolean,true), COALESCE((item->>'sort_order')::integer,0),
        COALESCE((item->>'low_stock_threshold')::integer,10)
      );
    ELSE
      UPDATE public.product_variants SET
        sku = _sku, attributes = COALESCE(item->'attributes','{}'::jsonb),
        mrp = COALESCE((item->>'mrp')::numeric,0), price = COALESCE((item->>'price')::numeric,0),
        discount_pct = COALESCE((item->>'discount_pct')::numeric,0),
        retailer_price = NULLIF(item->>'retailer_price','')::numeric,
        distributor_price = NULLIF(item->>'distributor_price','')::numeric,
        moq = COALESCE((item->>'moq')::integer,1), retailer_moq = NULLIF(item->>'retailer_moq','')::integer,
        distributor_moq = NULLIF(item->>'distributor_moq','')::integer,
        stock = COALESCE((item->>'stock')::integer,0), pack_size = NULLIF(item->>'pack_size','')::integer,
        weight_g = NULLIF(item->>'weight_g','')::numeric, dim_l = NULLIF(item->>'dim_l','')::numeric,
        dim_w = NULLIF(item->>'dim_w','')::numeric, dim_h = NULLIF(item->>'dim_h','')::numeric,
        pack_weight_g = NULLIF(item->>'pack_weight_g','')::numeric, pack_l = NULLIF(item->>'pack_l','')::numeric,
        pack_w = NULLIF(item->>'pack_w','')::numeric, pack_h = NULLIF(item->>'pack_h','')::numeric,
        is_active = COALESCE((item->>'is_active')::boolean,true),
        sort_order = COALESCE((item->>'sort_order')::integer,0),
        low_stock_threshold = COALESCE((item->>'low_stock_threshold')::integer,10), updated_at = now()
      WHERE id = _id AND family_id = _family_id AND archived_at IS NULL;
      IF NOT FOUND THEN RAISE EXCEPTION 'variant not found in this family'; END IF;
    END IF;
  END LOOP;

  PERFORM public.refresh_product_family(_family_id);
  INSERT INTO public.audit_logs(actor_user_id, action, entity_type, entity_id, after)
  VALUES (_actor_user_id, 'catalog.variant_matrix_save', 'product_family', _family_id,
          jsonb_build_object('variant_count', jsonb_array_length(COALESCE(_variants,'[]'::jsonb))));
END; $$;

CREATE OR REPLACE FUNCTION public.admin_adjust_inventory(
  _variant_id uuid, _delta integer, _reason text, _actor_user_id uuid
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _after integer; _sku text; _family_id uuid;
BEGIN
  IF _delta = 0 THEN RAISE EXCEPTION 'quantity change cannot be zero'; END IF;
  IF btrim(COALESCE(_reason,'')) = '' THEN RAISE EXCEPTION 'a reason is required'; END IF;
  SELECT sku, family_id INTO _sku, _family_id FROM public.product_variants
  WHERE id = _variant_id AND archived_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'variant not found'; END IF;
  UPDATE public.product_variants SET stock = stock + _delta, updated_at = now()
  WHERE id = _variant_id AND stock + _delta >= 0 RETURNING stock INTO _after;
  IF _after IS NULL THEN RAISE EXCEPTION 'inventory cannot become negative'; END IF;
  INSERT INTO public.inventory_ledger(variant_id, sku, delta, quantity_after, reason, actor_user_id)
  VALUES (_variant_id, _sku, _delta, _after, btrim(_reason), _actor_user_id);
  PERFORM public.refresh_product_family(_family_id);
  RETURN _after;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_set_primary_product_image(_image_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target public.product_images%ROWTYPE;
BEGIN
  SELECT * INTO target FROM public.product_images WHERE id = _image_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'image not found'; END IF;
  UPDATE public.product_images SET is_primary = false, updated_at = now()
  WHERE id <> target.id AND is_primary
    AND family_id IS NOT DISTINCT FROM target.family_id
    AND product_id IS NOT DISTINCT FROM target.product_id
    AND variant_sku IS NOT DISTINCT FROM target.variant_sku;
  UPDATE public.product_images SET is_primary = true, updated_at = now() WHERE id = target.id;
END; $$;

REVOKE ALL ON FUNCTION public.admin_upsert_product_family(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_save_variant_matrix(uuid,jsonb,jsonb,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_adjust_inventory(uuid,integer,text,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_set_primary_product_image(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_upsert_product_family(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_save_variant_matrix(uuid,jsonb,jsonb,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_adjust_inventory(uuid,integer,text,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_primary_product_image(uuid) TO service_role;

-- Finalize an order, its item snapshots, coupon redemption, stock movements,
-- cart cleanup and recovery status in one database transaction. The function
-- is service-role only; the authenticated server handler performs pricing and
-- delivery quotation before entering this boundary.
CREATE OR REPLACE FUNCTION public.place_order_atomic(
  _user_id uuid,
  _address jsonb,
  _payment_method text,
  _shipping numeric,
  _items jsonb,
  _coupon_id uuid DEFAULT NULL,
  _coupon_code text DEFAULT NULL,
  _discount numeric DEFAULT 0
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _order_id uuid;
  _subtotal numeric := 0;
  _total numeric;
  item jsonb;
  variant public.product_variants%ROWTYPE;
  product public.products%ROWTYPE;
  _quantity integer;
  _price numeric;
  _used integer;
  coupon public.coupons%ROWTYPE;
BEGIN
  IF _user_id IS NULL OR jsonb_array_length(COALESCE(_items, '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'order requires a user and at least one item';
  END IF;
  IF _payment_method NOT IN ('cod','upi','card') OR COALESCE(_shipping,0) < 0 OR COALESCE(_discount,0) < 0 THEN
    RAISE EXCEPTION 'invalid order totals';
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(_items) LOOP
    _quantity := (item->>'quantity')::integer;
    _price := (item->>'price')::numeric;
    IF _quantity < 1 OR _price < 0 THEN RAISE EXCEPTION 'invalid order item'; END IF;
    _subtotal := _subtotal + (_price * _quantity);

    SELECT * INTO variant FROM public.product_variants
    WHERE sku = item->>'sku' AND is_active AND archived_at IS NULL FOR UPDATE;
    IF FOUND THEN
      IF variant.stock - variant.reserved_stock < _quantity THEN
        RAISE EXCEPTION '% has only % available', variant.sku, variant.stock - variant.reserved_stock;
      END IF;
    ELSE
      SELECT * INTO product FROM public.products
      WHERE id = (item->>'productId')::uuid AND is_published FOR UPDATE;
      IF NOT FOUND OR product.stock < _quantity THEN
        RAISE EXCEPTION 'an item is no longer available';
      END IF;
    END IF;
  END LOOP;

  _subtotal := round(_subtotal, 2);
  IF _discount > _subtotal THEN RAISE EXCEPTION 'discount exceeds subtotal'; END IF;

  IF _coupon_id IS NOT NULL THEN
    SELECT * INTO coupon FROM public.coupons WHERE id = _coupon_id AND active FOR UPDATE;
    IF NOT FOUND OR (coupon.starts_at IS NOT NULL AND coupon.starts_at > now())
      OR (coupon.expires_at IS NOT NULL AND coupon.expires_at < now())
      OR (coupon.usage_limit IS NOT NULL AND coupon.times_used >= coupon.usage_limit) THEN
      RAISE EXCEPTION 'coupon is no longer available';
    END IF;
    SELECT count(*)::integer INTO _used FROM public.coupon_redemptions
    WHERE coupon_id = _coupon_id AND user_id = _user_id AND reversed_at IS NULL;
    IF _used >= coupon.per_user_limit THEN RAISE EXCEPTION 'coupon already used'; END IF;
  ELSIF _discount <> 0 THEN
    RAISE EXCEPTION 'discount requires a valid coupon';
  END IF;

  _total := greatest(0, round(_subtotal - _discount + _shipping, 2));
  INSERT INTO public.orders(
    user_id, subtotal, discount, shipping, total, payment_method,
    full_name, phone, email, address, city, state, pincode, discount_code
  ) VALUES (
    _user_id, _subtotal, _discount, _shipping, _total, _payment_method,
    _address->>'full_name', _address->>'phone', NULLIF(_address->>'email',''),
    _address->>'address', _address->>'city', _address->>'state',
    _address->>'pincode', _coupon_code
  ) RETURNING id INTO _order_id;

  FOR item IN SELECT value FROM jsonb_array_elements(_items) LOOP
    _quantity := (item->>'quantity')::integer;
    SELECT * INTO variant FROM public.product_variants
    WHERE sku = item->>'sku' AND is_active AND archived_at IS NULL FOR UPDATE;
    IF FOUND THEN
      UPDATE public.product_variants SET stock = stock - _quantity, updated_at = now() WHERE id = variant.id;
      INSERT INTO public.inventory_ledger(
        variant_id, sku, delta, quantity_after, reason, source,
        reference_type, reference_id, actor_user_id
      ) VALUES (
        variant.id, variant.sku, -_quantity, variant.stock - _quantity,
        'Order placed', 'checkout', 'order', _order_id, _user_id
      );
    ELSE
      UPDATE public.products SET stock = stock - _quantity WHERE id = (item->>'productId')::uuid;
    END IF;

    INSERT INTO public.order_items(
      order_id, product_id, variant_id, sku, product_name, price, quantity,
      variant_attributes, product_snapshot
    ) VALUES (
      _order_id, (item->>'productId')::uuid,
      CASE WHEN variant.id IS NULL THEN NULL ELSE variant.id END,
      item->>'sku', item->>'name', (item->>'price')::numeric, _quantity,
      COALESCE(variant.attributes, '{}'::jsonb),
      jsonb_build_object('name', item->>'name', 'sku', item->>'sku', 'unit_price', (item->>'price')::numeric)
    );
  END LOOP;

  IF _coupon_id IS NOT NULL AND _discount > 0 THEN
    INSERT INTO public.coupon_redemptions(coupon_id, user_id, order_id, discount_amount)
    VALUES (_coupon_id, _user_id, _order_id, _discount);
    UPDATE public.coupons SET times_used = times_used + 1, updated_at = now() WHERE id = _coupon_id;
  END IF;

  DELETE FROM public.cart_items
  WHERE user_id = _user_id AND id IN (
    SELECT (value->>'cartId')::uuid FROM jsonb_array_elements(_items)
  );
  UPDATE public.abandoned_carts SET status = 'recovered', recovered_at = now(), recovered_order_id = _order_id
  WHERE user_id = _user_id AND status <> 'recovered';

  RETURN _order_id;
END; $$;

REVOKE ALL ON FUNCTION public.place_order_atomic(uuid,jsonb,text,numeric,jsonb,uuid,text,numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.place_order_atomic(uuid,jsonb,text,numeric,jsonb,uuid,text,numeric) TO service_role;

DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT id FROM public.product_families LOOP
    PERFORM public.refresh_product_family(f.id);
  END LOOP;
END $$;
