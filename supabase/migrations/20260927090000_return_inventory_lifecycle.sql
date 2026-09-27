BEGIN;

-- Return inventory must be restored in pieces exactly once. The restocked_at
-- marker is the idempotency boundary for the inventory trigger.
ALTER TABLE public.return_requests
  ADD COLUMN IF NOT EXISTS restocked_at timestamptz;

CREATE OR REPLACE FUNCTION public.reconcile_returned_buyer_inventory()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  rec record;
  v public.product_variants%ROWTYPE;
  units integer;
BEGIN
  IF NEW.restocked_at IS NOT NULL
     AND OLD.restocked_at IS NULL
     AND NEW.kind='return' THEN
    FOR rec IN
      SELECT oi.*, ri.quantity AS return_qty
      FROM public.return_request_items ri
      JOIN public.order_items oi ON oi.id=ri.order_item_id
      WHERE ri.request_id=NEW.id
    LOOP
      IF rec.variant_id IS NOT NULL THEN
        SELECT * INTO v
        FROM public.product_variants
        WHERE id=rec.variant_id
        FOR UPDATE;

        IF FOUND THEN
          units :=
            LEAST(rec.return_qty, rec.quantity) *
            GREATEST(
              1,
              COALESCE(rec.stock_units / NULLIF(rec.quantity,0), 1)
            );

          IF rec.buyer_type='customer' THEN
            UPDATE public.product_variants
               SET stock=stock+units, updated_at=now()
             WHERE id=v.id;
          ELSIF rec.buyer_type='retailer' THEN
            UPDATE public.product_variants
               SET retailer_stock=retailer_stock+units, updated_at=now()
             WHERE id=v.id;
          ELSE
            UPDATE public.product_variants
               SET distributor_stock=distributor_stock+units, updated_at=now()
             WHERE id=v.id;
          END IF;

          INSERT INTO public.inventory_ledger(
            variant_id, sku, delta, quantity_after, reason, source,
            reference_type, reference_id, buyer_type
          )
          SELECT
            v.id,
            v.sku,
            units,
            CASE rec.buyer_type
              WHEN 'retailer' THEN retailer_stock
              WHEN 'distributor' THEN distributor_stock
              ELSE stock
            END,
            'Return received',
            'admin',
            'return',
            NEW.id,
            rec.buyer_type
          FROM public.product_variants
          WHERE id=v.id;
        END IF;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reconcile_returned_buyer_inventory ON public.return_requests;
CREATE TRIGGER trg_reconcile_returned_buyer_inventory
AFTER UPDATE OF restocked_at ON public.return_requests
FOR EACH ROW
EXECUTE FUNCTION public.reconcile_returned_buyer_inventory();

CREATE OR REPLACE FUNCTION public.admin_update_return_request(
  _request_id uuid,
  _status public.return_status,
  _refund_amount numeric,
  _refund_reference text,
  _note text,
  _actor_user_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  request public.return_requests%ROWTYPE;
BEGIN
  SELECT *
  INTO request
  FROM public.return_requests
  WHERE id=_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'return request not found';
  END IF;

  IF COALESCE(_refund_amount,0) < 0 THEN
    RAISE EXCEPTION 'refund amount cannot be negative';
  END IF;

  IF request.status IN ('completed','cancelled','rejected','refunded')
     AND _status <> request.status THEN
    RAISE EXCEPTION 'this request is already final';
  END IF;

  UPDATE public.return_requests
     SET status=_status,
         refund_amount=COALESCE(_refund_amount,0),
         refund_reference=NULLIF(btrim(_refund_reference),''),
         admin_note=NULLIF(btrim(_note),''),
         reviewed_by=_actor_user_id,
         reviewed_at=now(),
         updated_at=now(),
         restocked_at=
           CASE
             WHEN request.kind='return'
                  AND _status IN ('received','completed')
                  AND request.restocked_at IS NULL
               THEN now()
             ELSE request.restocked_at
           END
   WHERE id=_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_return_request(
  uuid,public.return_status,numeric,text,text,uuid
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_return_request(
  uuid,public.return_status,numeric,text,text,uuid
) TO service_role;

NOTIFY pgrst,'reload schema';
COMMIT;
