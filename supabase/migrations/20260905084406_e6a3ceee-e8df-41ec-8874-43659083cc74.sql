CREATE OR REPLACE FUNCTION public.validate_coupon(_code text, _subtotal numeric)
RETURNS TABLE(coupon_id uuid, discount numeric, reason text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE c public.coupons%ROWTYPE; d numeric; role_txt text; uid uuid; used_by_user int;
BEGIN
  uid := auth.uid();
  role_txt := public.current_pricing_role();
  SELECT * INTO c FROM public.coupons WHERE upper(code) = upper(btrim(_code)) AND active = true;
  IF NOT FOUND THEN RETURN QUERY SELECT NULL::uuid, 0::numeric, 'Invalid coupon code'; RETURN; END IF;
  IF c.starts_at IS NOT NULL AND c.starts_at > now() THEN
    RETURN QUERY SELECT NULL::uuid, 0::numeric, 'Coupon not yet active'; RETURN;
  END IF;
  IF c.expires_at IS NOT NULL AND c.expires_at < now() THEN
    RETURN QUERY SELECT NULL::uuid, 0::numeric, 'Coupon expired'; RETURN;
  END IF;
  IF c.usage_limit IS NOT NULL AND c.times_used >= c.usage_limit THEN
    RETURN QUERY SELECT NULL::uuid, 0::numeric, 'Coupon usage limit reached'; RETURN;
  END IF;
  IF _subtotal < c.min_order_value THEN
    RETURN QUERY SELECT NULL::uuid, 0::numeric, 'Minimum order not met'; RETURN;
  END IF;
  -- Admins can always use a coupon (needed to test codes), and an empty
  -- eligibility list means "everyone".
  IF role_txt <> 'admin'
     AND coalesce(array_length(c.eligible_roles, 1), 0) > 0
     AND NOT (role_txt = ANY(c.eligible_roles)) THEN
    RETURN QUERY SELECT NULL::uuid, 0::numeric, 'Not eligible for this account type'; RETURN;
  END IF;
  IF uid IS NOT NULL AND c.per_user_limit IS NOT NULL AND c.per_user_limit > 0 THEN
    SELECT COUNT(*) INTO used_by_user FROM public.coupon_redemptions
      WHERE coupon_id = c.id AND user_id = uid;
    IF used_by_user >= c.per_user_limit THEN
      RETURN QUERY SELECT NULL::uuid, 0::numeric, 'Coupon already used'; RETURN;
    END IF;
  END IF;
  IF c.type = 'flat' THEN d := LEAST(c.value, _subtotal);
  ELSE d := _subtotal * c.value / 100.0;
       IF c.max_discount IS NOT NULL THEN d := LEAST(d, c.max_discount); END IF;
  END IF;
  RETURN QUERY SELECT c.id, ROUND(d,2), NULL::text;
END; $$;