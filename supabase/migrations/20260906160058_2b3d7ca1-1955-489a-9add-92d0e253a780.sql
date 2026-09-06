-- Phase 2B: auditable order transitions with atomic cancellation restocking.

CREATE TABLE IF NOT EXISTS public.order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  note text,
  actor_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.order_status_history TO authenticated;
GRANT ALL ON public.order_status_history TO service_role;
DROP POLICY IF EXISTS order_status_history_admin_read ON public.order_status_history;
CREATE POLICY order_status_history_admin_read ON public.order_status_history
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS order_status_history_order_created_idx
  ON public.order_status_history(order_id, created_at DESC);

ALTER TABLE public.coupon_redemptions
  ADD COLUMN IF NOT EXISTS reversed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reversed_by uuid;

CREATE OR REPLACE FUNCTION public.admin_transition_order(
  _order_id uuid,
  _to_status text,
  _note text DEFAULT NULL,
  _actor_user_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_order public.orders%ROWTYPE;
  line public.order_items%ROWTYPE;
  variant public.product_variants%ROWTYPE;
  redemption record;
BEGIN
  SELECT * INTO current_order FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order not found'; END IF;
  IF _to_status = current_order.status THEN
    RETURN jsonb_build_object('status', current_order.status, 'restocked', false);
  END IF;

  IF NOT (
    (current_order.status = 'placed' AND _to_status IN ('confirmed','cancelled')) OR
    (current_order.status = 'confirmed' AND _to_status IN ('packed','cancelled')) OR
    (current_order.status = 'packed' AND _to_status IN ('shipped','cancelled')) OR
    (current_order.status = 'shipped' AND _to_status = 'out_for_delivery') OR
    (current_order.status = 'out_for_delivery' AND _to_status = 'delivered')
  ) THEN
    RAISE EXCEPTION 'invalid order transition from % to %', current_order.status, _to_status;
  END IF;

  IF _to_status = 'cancelled' THEN
    FOR line IN SELECT * FROM public.order_items WHERE order_id = _order_id LOOP
      IF line.variant_id IS NOT NULL THEN
        SELECT * INTO variant FROM public.product_variants WHERE id = line.variant_id FOR UPDATE;
        IF FOUND THEN
          UPDATE public.product_variants
          SET stock = stock + line.quantity, updated_at = now()
          WHERE id = variant.id;
          INSERT INTO public.inventory_ledger(
            variant_id, sku, delta, quantity_after, reason, source,
            reference_type, reference_id, actor_user_id
          ) VALUES (
            variant.id, variant.sku, line.quantity, variant.stock + line.quantity,
            'Order cancelled', 'admin', 'order', _order_id, _actor_user_id
          );
        END IF;
      ELSIF line.product_id IS NOT NULL THEN
        UPDATE public.products SET stock = stock + line.quantity WHERE id = line.product_id;
      END IF;
    END LOOP;

    FOR redemption IN
      SELECT id, coupon_id FROM public.coupon_redemptions
      WHERE order_id = _order_id AND reversed_at IS NULL FOR UPDATE
    LOOP
      UPDATE public.coupon_redemptions
      SET reversed_at = now(), reversed_by = _actor_user_id
      WHERE id = redemption.id;
      UPDATE public.coupons
      SET times_used = greatest(0, times_used - 1), updated_at = now()
      WHERE id = redemption.coupon_id;
    END LOOP;
  END IF;

  UPDATE public.orders SET status = _to_status WHERE id = _order_id;
  INSERT INTO public.order_status_history(order_id, from_status, to_status, note, actor_user_id)
  VALUES (_order_id, current_order.status, _to_status, NULLIF(trim(_note), ''), _actor_user_id);

  RETURN jsonb_build_object('status', _to_status, 'restocked', _to_status = 'cancelled');
END;
$$;

REVOKE ALL ON FUNCTION public.admin_transition_order(uuid,text,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_transition_order(uuid,text,text,uuid) TO service_role;