BEGIN;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS buyer_type text NOT NULL DEFAULT 'customer' CHECK (buyer_type IN ('customer','retailer','distributor')),
  ADD COLUMN IF NOT EXISTS stock_units integer CHECK (stock_units IS NULL OR stock_units > 0);
ALTER TABLE public.inventory_ledger
  ADD COLUMN IF NOT EXISTS buyer_type text NOT NULL DEFAULT 'customer' CHECK (buyer_type IN ('customer','retailer','distributor'));

CREATE OR REPLACE FUNCTION public.place_order_atomic_v2(
  _user_id uuid, _address jsonb, _payment_method text, _shipping numeric, _items jsonb,
  _buyer_type text DEFAULT 'customer', _coupon_id uuid DEFAULT NULL, _coupon_code text DEFAULT NULL, _discount numeric DEFAULT 0
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE item jsonb; v public.product_variants%ROWTYPE; placed_order_id uuid; units integer; pack integer; available integer;
BEGIN
  IF _buyer_type NOT IN ('customer','retailer','distributor') THEN RAISE EXCEPTION 'Invalid buyer type'; END IF;
  -- Lock every SKU and validate the exact buyer inventory in pieces before the legacy atomic order writer runs.
  FOR item IN SELECT value FROM jsonb_array_elements(_items) LOOP
    SELECT * INTO v FROM public.product_variants WHERE sku=item->>'sku' AND is_active AND archived_at IS NULL FOR UPDATE;
    IF FOUND THEN
      pack := CASE _buyer_type WHEN 'retailer' THEN COALESCE(v.retailer_pack_size,v.pack_size,1) WHEN 'distributor' THEN COALESCE(v.distributor_pack_size,v.pack_size,1) ELSE COALESCE(v.pack_size,1) END;
      units := (item->>'quantity')::integer * pack;
      available := CASE _buyer_type WHEN 'retailer' THEN v.retailer_stock-v.retailer_reserved_stock WHEN 'distributor' THEN v.distributor_stock-v.distributor_reserved_stock ELSE v.stock-v.reserved_stock END;
      IF available < units THEN RAISE EXCEPTION '% has only % pieces available for %',v.sku,available,_buyer_type; END IF;
      -- The v1 routine checks/deducts one customer unit. Add that temporary unit;
      -- all changes remain in this transaction and are reconciled immediately below.
      UPDATE public.product_variants SET stock=stock+(item->>'quantity')::integer WHERE id=v.id;
    END IF;
  END LOOP;
  placed_order_id := public.place_order_atomic(_user_id,_address,_payment_method,_shipping,_items,_coupon_id,_coupon_code,_discount);
  FOR item IN SELECT value FROM jsonb_array_elements(_items) LOOP
    SELECT * INTO v FROM public.product_variants WHERE sku=item->>'sku' FOR UPDATE;
    IF FOUND THEN
      pack := CASE _buyer_type WHEN 'retailer' THEN COALESCE(v.retailer_pack_size,v.pack_size,1) WHEN 'distributor' THEN COALESCE(v.distributor_pack_size,v.pack_size,1) ELSE COALESCE(v.pack_size,1) END;
      units := (item->>'quantity')::integer * pack;
      IF _buyer_type='customer' THEN UPDATE public.product_variants SET stock=stock-units,updated_at=now() WHERE id=v.id;
      ELSIF _buyer_type='retailer' THEN UPDATE public.product_variants SET retailer_stock=retailer_stock-units,updated_at=now() WHERE id=v.id;
      ELSE UPDATE public.product_variants SET distributor_stock=distributor_stock-units,updated_at=now() WHERE id=v.id; END IF;
      UPDATE public.order_items SET buyer_type=_buyer_type,stock_units=units WHERE order_id=placed_order_id AND sku=v.sku;
      DELETE FROM public.inventory_ledger WHERE reference_type='order' AND reference_id=placed_order_id AND variant_id=v.id;
      INSERT INTO public.inventory_ledger(variant_id,sku,delta,quantity_after,reason,source,reference_type,reference_id,actor_user_id,buyer_type)
      VALUES(v.id,v.sku,-units,CASE _buyer_type WHEN 'retailer' THEN v.retailer_stock-units WHEN 'distributor' THEN v.distributor_stock-units ELSE v.stock-units END,'Order placed','checkout','order',placed_order_id,_user_id,_buyer_type);
    END IF;
  END LOOP;
  RETURN placed_order_id;
END; $$;

CREATE OR REPLACE FUNCTION public.reconcile_cancelled_buyer_inventory() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE line public.order_items%ROWTYPE; v public.product_variants%ROWTYPE; units integer;
BEGIN
  IF NEW.status='cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    FOR line IN SELECT * FROM public.order_items WHERE order_id=NEW.id AND variant_id IS NOT NULL LOOP
      SELECT * INTO v FROM public.product_variants WHERE id=line.variant_id FOR UPDATE;
      IF FOUND THEN
        units:=COALESCE(line.stock_units,line.quantity);
        -- Undo the legacy quantity restoration, then restore the original buyer inventory exactly once.
        UPDATE public.product_variants SET stock=GREATEST(0,stock-line.quantity),updated_at=now() WHERE id=v.id;
        IF line.buyer_type='customer' THEN UPDATE public.product_variants SET stock=stock+units WHERE id=v.id;
        ELSIF line.buyer_type='retailer' THEN UPDATE public.product_variants SET retailer_stock=retailer_stock+units WHERE id=v.id;
        ELSE UPDATE public.product_variants SET distributor_stock=distributor_stock+units WHERE id=v.id; END IF;
        INSERT INTO public.inventory_ledger(variant_id,sku,delta,quantity_after,reason,source,reference_type,reference_id,buyer_type)
        SELECT v.id,v.sku,units,CASE line.buyer_type WHEN 'retailer' THEN retailer_stock WHEN 'distributor' THEN distributor_stock ELSE stock END,'Order cancelled','admin','order',NEW.id,line.buyer_type FROM public.product_variants WHERE id=v.id;
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_reconcile_cancelled_buyer_inventory ON public.orders;
CREATE TRIGGER trg_reconcile_cancelled_buyer_inventory AFTER UPDATE OF status ON public.orders FOR EACH ROW EXECUTE FUNCTION public.reconcile_cancelled_buyer_inventory();

CREATE OR REPLACE FUNCTION public.reconcile_returned_buyer_inventory() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE rec record; v public.product_variants%ROWTYPE; units integer;
BEGIN
  IF NEW.restocked_at IS NOT NULL AND OLD.restocked_at IS NULL AND NEW.kind='return' THEN
    FOR rec IN SELECT oi.*,ri.quantity AS return_qty FROM public.return_request_items ri JOIN public.order_items oi ON oi.id=ri.order_item_id WHERE ri.request_id=NEW.id LOOP
      IF rec.variant_id IS NOT NULL THEN
        SELECT * INTO v FROM public.product_variants WHERE id=rec.variant_id FOR UPDATE;
        units:=LEAST(rec.return_qty,rec.quantity)*GREATEST(1,COALESCE(rec.stock_units/NULLIF(rec.quantity,0),1));
        UPDATE public.product_variants SET stock=GREATEST(0,stock-LEAST(rec.return_qty,rec.quantity)),updated_at=now() WHERE id=v.id;
        IF rec.buyer_type='customer' THEN UPDATE public.product_variants SET stock=stock+units WHERE id=v.id;
        ELSIF rec.buyer_type='retailer' THEN UPDATE public.product_variants SET retailer_stock=retailer_stock+units WHERE id=v.id;
        ELSE UPDATE public.product_variants SET distributor_stock=distributor_stock+units WHERE id=v.id; END IF;
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_reconcile_returned_buyer_inventory ON public.return_requests;
CREATE TRIGGER trg_reconcile_returned_buyer_inventory AFTER UPDATE OF restocked_at ON public.return_requests FOR EACH ROW EXECUTE FUNCTION public.reconcile_returned_buyer_inventory();

REVOKE ALL ON FUNCTION public.place_order_atomic_v2(uuid,jsonb,text,numeric,jsonb,text,uuid,text,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.place_order_atomic_v2(uuid,jsonb,text,numeric,jsonb,text,uuid,text,numeric) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
