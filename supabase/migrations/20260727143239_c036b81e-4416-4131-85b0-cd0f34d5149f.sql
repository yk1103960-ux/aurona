
-- =====================================================
-- COUPONS
-- =====================================================
CREATE TYPE public.coupon_type AS ENUM ('flat','percentage');

CREATE TABLE public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text,
  type public.coupon_type NOT NULL,
  value numeric NOT NULL CHECK (value > 0),
  min_order_value numeric NOT NULL DEFAULT 0,
  max_discount numeric,
  starts_at timestamptz,
  expires_at timestamptz,
  usage_limit integer,
  per_user_limit integer NOT NULL DEFAULT 1,
  eligible_roles text[] NOT NULL DEFAULT ARRAY['customer','retailer','distributor'],
  times_used integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.coupons TO anon, authenticated;
GRANT ALL ON public.coupons TO service_role;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read active coupons" ON public.coupons
  FOR SELECT USING (active = true);
CREATE POLICY "admin manage coupons" ON public.coupons
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.coupon_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  discount_amount numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.coupon_redemptions(coupon_id);
CREATE INDEX ON public.coupon_redemptions(user_id);

GRANT SELECT, INSERT ON public.coupon_redemptions TO authenticated;
GRANT ALL ON public.coupon_redemptions TO service_role;
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own redemptions read" ON public.coupon_redemptions
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "own redemptions insert" ON public.coupon_redemptions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- =====================================================
-- CMS BLOCKS
-- =====================================================
CREATE TABLE public.cms_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  type text NOT NULL,
  title text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.cms_blocks(type, sort_order);

GRANT SELECT ON public.cms_blocks TO anon, authenticated;
GRANT ALL ON public.cms_blocks TO service_role;
ALTER TABLE public.cms_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read active cms" ON public.cms_blocks
  FOR SELECT USING (
    active = true
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at >= now())
  );
CREATE POLICY "admin manage cms" ON public.cms_blocks
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- =====================================================
-- PAYMENT GATEWAYS (public metadata only)
-- =====================================================
CREATE TABLE public.payment_gateways (
  provider text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  mode text NOT NULL DEFAULT 'test' CHECK (mode IN ('test','live')),
  config_public jsonb NOT NULL DEFAULT '{}'::jsonb,
  secret_last4 text,
  connected_at timestamptz,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.payment_gateways TO anon, authenticated;
GRANT ALL ON public.payment_gateways TO service_role;
ALTER TABLE public.payment_gateways ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read gateway status" ON public.payment_gateways
  FOR SELECT USING (true);
CREATE POLICY "admin manage gateways" ON public.payment_gateways
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.payment_gateways(provider, enabled, mode)
VALUES ('cod', true, 'live'), ('razorpay', false, 'test')
ON CONFLICT DO NOTHING;

-- =====================================================
-- SHIPPING PROVIDERS (Shiprocket)
-- =====================================================
CREATE TABLE public.shipping_providers (
  provider text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  config_public jsonb NOT NULL DEFAULT '{}'::jsonb,
  credential_masked text,
  connected_at timestamptz,
  last_verified_at timestamptz,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.shipping_providers TO authenticated;
GRANT ALL ON public.shipping_providers TO service_role;
ALTER TABLE public.shipping_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin manage shipping" ON public.shipping_providers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.shipping_providers(provider, enabled)
VALUES ('shiprocket', false)
ON CONFLICT DO NOTHING;

-- Extend orders for shipment tracking
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipment_provider text,
  ADD COLUMN IF NOT EXISTS shipment_id text,
  ADD COLUMN IF NOT EXISTS awb_code text,
  ADD COLUMN IF NOT EXISTS courier_name text,
  ADD COLUMN IF NOT EXISTS tracking_url text,
  ADD COLUMN IF NOT EXISTS shipment_status text,
  ADD COLUMN IF NOT EXISTS shipment_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS payment_provider_order_id text,
  ADD COLUMN IF NOT EXISTS payment_provider_payment_id text,
  ADD COLUMN IF NOT EXISTS discount_code text;

-- =====================================================
-- AUDIT LOGS (append-only)
-- =====================================================
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid,
  actor_email text,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  before jsonb,
  after jsonb,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.audit_logs(created_at DESC);
CREATE INDEX ON public.audit_logs(actor_user_id);
CREATE INDEX ON public.audit_logs(entity_type, entity_id);

GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin read audit" ON public.audit_logs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
-- No insert/update/delete policies: only service_role writes.

-- =====================================================
-- MFA
-- =====================================================
CREATE TABLE public.user_mfa (
  user_id uuid PRIMARY KEY,
  secret_ciphertext text NOT NULL,
  verified_at timestamptz,
  backup_codes_ciphertext text,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.user_mfa TO authenticated;
GRANT ALL ON public.user_mfa TO service_role;
ALTER TABLE public.user_mfa ENABLE ROW LEVEL SECURITY;

-- Only "is enrolled" style checks — no secret exposed via SELECT columns from clients.
CREATE POLICY "own mfa status read" ON public.user_mfa
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- =====================================================
-- Triggers: updated_at
-- =====================================================
CREATE TRIGGER trg_coupons_updated_at BEFORE UPDATE ON public.coupons
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_cms_updated_at BEFORE UPDATE ON public.cms_blocks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_pg_updated_at BEFORE UPDATE ON public.payment_gateways
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_sp_updated_at BEFORE UPDATE ON public.shipping_providers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_mfa_updated_at BEFORE UPDATE ON public.user_mfa
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================
-- Helper: validate + redeem coupon
-- =====================================================
CREATE OR REPLACE FUNCTION public.validate_coupon(_code text, _subtotal numeric)
RETURNS TABLE(coupon_id uuid, discount numeric, reason text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
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
    RETURN QUERY SELECT NULL::uuid, 0::numeric, 'Invalid coupon code'::text;
    RETURN;
  END IF;

  IF c.starts_at IS NOT NULL AND c.starts_at > now() THEN
    RETURN QUERY SELECT NULL::uuid, 0::numeric, 'Coupon not yet active'::text;
    RETURN;
  END IF;

  IF c.expires_at IS NOT NULL AND c.expires_at < now() THEN
    RETURN QUERY SELECT NULL::uuid, 0::numeric, 'Coupon expired'::text;
    RETURN;
  END IF;

  IF c.usage_limit IS NOT NULL AND c.times_used >= c.usage_limit THEN
    RETURN QUERY SELECT NULL::uuid, 0::numeric, 'Coupon usage limit reached'::text;
    RETURN;
  END IF;

  IF _subtotal < c.min_order_value THEN
    RETURN QUERY SELECT NULL::uuid, 0::numeric, 'Minimum order not met'::text;
    RETURN;
  END IF;

  IF NOT (role_txt = ANY(c.eligible_roles)) THEN
    RETURN QUERY SELECT NULL::uuid, 0::numeric, 'Not eligible for this account type'::text;
    RETURN;
  END IF;

  IF uid IS NOT NULL THEN
    SELECT COUNT(*)::int
    INTO used_by_user
    FROM public.coupon_redemptions AS cr
    WHERE cr.coupon_id = c.id
      AND cr.user_id = uid;

    IF used_by_user >= c.per_user_limit THEN
      RETURN QUERY SELECT NULL::uuid, 0::numeric, 'Coupon already used'::text;
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

  RETURN QUERY SELECT c.id, ROUND(d, 2), NULL::text;
END; $$;

CREATE OR REPLACE FUNCTION public.redeem_coupon(_coupon_id uuid, _order_id uuid, _amount numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  INSERT INTO public.coupon_redemptions(coupon_id, user_id, order_id, discount_amount)
    VALUES (_coupon_id, auth.uid(), _order_id, _amount);
  UPDATE public.coupons SET times_used = times_used + 1 WHERE id = _coupon_id;
END; $$;

-- =====================================================
-- Helper: is_admin_mfa_verified
-- =====================================================
CREATE OR REPLACE FUNCTION public.is_mfa_enrolled(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_mfa WHERE user_id = _uid AND verified_at IS NOT NULL)
$$;

GRANT EXECUTE ON FUNCTION public.validate_coupon(text, numeric) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_coupon(uuid, uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_mfa_enrolled(uuid) TO authenticated;
