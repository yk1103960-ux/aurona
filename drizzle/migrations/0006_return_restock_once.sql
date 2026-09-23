ALTER TABLE public.return_requests ADD COLUMN IF NOT EXISTS restocked_at timestamptz;

CREATE OR REPLACE FUNCTION public.admin_update_return_request(_request_id uuid, _status return_status, _refund_amount numeric, _refund_reference text, _note text, _actor_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  request public.return_requests%ROWTYPE;
  item record;
  variant public.product_variants%ROWTYPE;
  order_status text;
BEGIN
  SELECT * INTO request FROM public.return_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'return request not found'; END IF;
  IF COALESCE(_refund_amount,0) < 0 THEN RAISE EXCEPTION 'refund amount cannot be negative'; END IF;
  IF request.status IN ('completed','cancelled','rejected','refunded') AND _status <> request.status THEN RAISE EXCEPTION 'this request is already final'; END IF;
  UPDATE public.return_requests SET status = _status, refund_amount = COALESCE(_refund_amount,0),
    refund_reference = NULLIF(btrim(_refund_reference),''), admin_note = NULLIF(btrim(_note),''),
    reviewed_by = _actor_user_id, reviewed_at = now(), updated_at = now()
  WHERE id = _request_id;

  -- Put returned goods back into stock exactly once, when they are received.
  SELECT status INTO order_status FROM public.orders WHERE id = request.order_id;
  IF request.kind = 'return' AND request.restocked_at IS NULL
     AND _status IN ('received','refund_initiated','refunded','completed')
     AND COALESCE(order_status,'') <> 'cancelled' THEN
    FOR item IN
      SELECT oi.variant_id, oi.product_id, LEAST(ri.quantity, oi.quantity) AS qty
      FROM public.return_request_items ri
      JOIN public.order_items oi ON oi.id = ri.order_item_id
      WHERE ri.request_id = _request_id AND ri.quantity > 0
    LOOP
      IF item.variant_id IS NOT NULL THEN
        SELECT * INTO variant FROM public.product_variants WHERE id = item.variant_id FOR UPDATE;
        IF FOUND THEN
          UPDATE public.product_variants SET stock = stock + item.qty, updated_at = now() WHERE id = variant.id;
          INSERT INTO public.inventory_ledger(variant_id, sku, delta, quantity_after, reason, source, reference_type, reference_id, actor_user_id)
          VALUES (variant.id, variant.sku, item.qty, variant.stock + item.qty, 'Return received', 'admin', 'return', _request_id, _actor_user_id);
        END IF;
      ELSIF item.product_id IS NOT NULL THEN
        UPDATE public.products SET stock = stock + item.qty WHERE id = item.product_id;
      END IF;
    END LOOP;
    UPDATE public.return_requests SET restocked_at = now() WHERE id = _request_id;
  END IF;
END; $function$;