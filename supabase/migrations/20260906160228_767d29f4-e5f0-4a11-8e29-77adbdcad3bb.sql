-- Server-side operational report aggregates (service role only).
CREATE OR REPLACE FUNCTION public.admin_report_summary(_from timestamptz, _to timestamptz)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH scoped_orders AS (
    SELECT * FROM public.orders
    WHERE created_at >= _from AND created_at < _to
  ),
  revenue_orders AS (
    SELECT * FROM scoped_orders WHERE status <> 'cancelled'
  ),
  status_rows AS (
    SELECT status, count(*)::integer AS count
    FROM scoped_orders GROUP BY status ORDER BY count(*) DESC
  ),
  payment_rows AS (
    SELECT payment_status, count(*)::integer AS count, coalesce(sum(total),0)::numeric AS total
    FROM scoped_orders GROUP BY payment_status ORDER BY count(*) DESC
  ),
  top_rows AS (
    SELECT oi.sku, oi.product_name, sum(oi.quantity)::integer AS units,
      sum(oi.price * oi.quantity)::numeric AS revenue
    FROM public.order_items oi JOIN revenue_orders o ON o.id = oi.order_id
    GROUP BY oi.sku, oi.product_name ORDER BY units DESC, revenue DESC LIMIT 10
  ),
  low_rows AS (
    SELECT v.id, v.sku, f.name, v.stock, v.reserved_stock, v.low_stock_threshold,
      (v.stock - v.reserved_stock) AS available
    FROM public.product_variants v JOIN public.product_families f ON f.id = v.family_id
    WHERE v.is_active AND v.archived_at IS NULL
      AND (v.stock - v.reserved_stock) <= v.low_stock_threshold
    ORDER BY available ASC, v.sku LIMIT 20
  )
  SELECT jsonb_build_object(
    'orders', (SELECT count(*) FROM scoped_orders),
    'gross_revenue', (SELECT coalesce(sum(total),0) FROM revenue_orders),
    'discounts', (SELECT coalesce(sum(discount),0) FROM revenue_orders),
    'average_order_value', (SELECT coalesce(avg(total),0) FROM revenue_orders),
    'cancelled_orders', (SELECT count(*) FROM scoped_orders WHERE status = 'cancelled'),
    'statuses', coalesce((SELECT jsonb_agg(to_jsonb(status_rows)) FROM status_rows), '[]'::jsonb),
    'payments', coalesce((SELECT jsonb_agg(to_jsonb(payment_rows)) FROM payment_rows), '[]'::jsonb),
    'top_skus', coalesce((SELECT jsonb_agg(to_jsonb(top_rows)) FROM top_rows), '[]'::jsonb),
    'low_stock', coalesce((SELECT jsonb_agg(to_jsonb(low_rows)) FROM low_rows), '[]'::jsonb)
  );
$$;

REVOKE ALL ON FUNCTION public.admin_report_summary(timestamptz,timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_report_summary(timestamptz,timestamptz) TO service_role;