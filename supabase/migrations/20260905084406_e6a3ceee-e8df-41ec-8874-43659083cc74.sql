-- Fix: validate_coupon "coupon_id is ambiguous"
-- Safe replacement for the existing function.
-- The ambiguity happened because RETURNS TABLE creates an output variable named
-- coupon_id, while coupon_redemptions also has a coupon_id column.
-- We fix it by explicitly qualifying table columns with aliases.

CREATE OR REPLACE FUNCTION public.validate_coupon(
  _code text,
  _subtotal numeric
)
RETURNS TABLE(
  coupon_id uuid,
  discount numeric,
  reason text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.coupons%ROWTYPE;
  d numeric;
  role_txt text;
  uid uuid;
  used_by_user int := 0;
BEGIN
  uid := auth.uid();
  role_txt := public.current_pricing_role();

  SELECT cp.*
  INTO c
  FROM public.coupons AS cp
  WHERE upper(cp.code) = upper(_code)
    AND cp.active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT NULL::uuid, 0::numeric, 'Invalid coupon code'::text;
    RETURN;
  END IF;

  IF c.starts_at IS NOT NULL AND c.starts_at > now() THEN
    RETURN QUERY
    SELECT NULL::uuid, 0::numeric, 'Coupon not yet active'::text;
    RETURN;
  END IF;

  IF c.expires_at IS NOT NULL AND c.expires_at < now() THEN
    RETURN QUERY
    SELECT NULL::uuid, 0::numeric, 'Coupon expired'::text;
    RETURN;
  END IF;

  IF c.usage_limit IS NOT NULL AND c.times_used >= c.usage_limit THEN
    RETURN QUERY
    SELECT NULL::uuid, 0::numeric, 'Coupon usage limit reached'::text;
    RETURN;
  END IF;

  IF _subtotal < c.min_order_value THEN
    RETURN QUERY
    SELECT NULL::uuid, 0::numeric, 'Minimum order not met'::text;
    RETURN;
  END IF;

  IF NOT (role_txt = ANY(c.eligible_roles)) THEN
    RETURN QUERY
    SELECT NULL::uuid, 0::numeric, 'Not eligible for this account type'::text;
    RETURN;
  END IF;

  IF uid IS NOT NULL THEN
    SELECT COUNT(*)::int
    INTO used_by_user
    FROM public.coupon_redemptions AS cr
    WHERE cr.coupon_id = c.id
      AND cr.user_id = uid;

    IF used_by_user >= c.per_user_limit THEN
      RETURN QUERY
      SELECT NULL::uuid, 0::numeric, 'Coupon already used'::text;
      RETURN;
    END IF;
  END IF;

  IF c.type = 'flat' THEN
    d := LEAST(c.value, _subtotal);
  ELSE
    d := _subtotal * c.value / 100.0;

    IF c.max_discount IS NOT NULL THEN
      d := LEAST(d, c.max_discount);
    END IF;
  END IF;

  RETURN QUERY
  SELECT c.id, ROUND(d, 2), NULL::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_coupon(text, numeric)
TO anon, authenticated;
