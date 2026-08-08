REVOKE EXECUTE ON FUNCTION public.affiliate_balance(uuid) FROM anon;

CREATE OR REPLACE FUNCTION public.affiliate_sync_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE auto_ok boolean;
BEGIN
  IF NEW.status IN ('cancelled','canceled','returned','refunded')
     OR NEW.payment_status IN ('refunded','failed_refunded') THEN
    UPDATE public.affiliate_commissions
      SET status = 'reversed',
          reason = COALESCE(reason, 'Order ' || NEW.status || ' / payment ' || NEW.payment_status)
      WHERE order_id = NEW.id AND status IN ('pending','approved');
    RETURN NEW;
  END IF;

  IF NEW.status = 'delivered' THEN
    SELECT auto_approve_commission_on_delivery INTO auto_ok FROM public.affiliate_settings WHERE id;
    IF COALESCE(auto_ok, true) THEN
      UPDATE public.affiliate_commissions
        SET status = 'approved', approved_at = now()
        WHERE order_id = NEW.id AND status = 'pending';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_orders_affiliate_sync
AFTER UPDATE OF status, payment_status ON public.orders
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.payment_status IS DISTINCT FROM NEW.payment_status)
EXECUTE FUNCTION public.affiliate_sync_order();