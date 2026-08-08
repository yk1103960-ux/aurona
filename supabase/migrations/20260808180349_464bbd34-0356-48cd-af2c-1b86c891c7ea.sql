-- ============ ENUMS ============
CREATE TYPE public.affiliate_status AS ENUM ('pending','approved','suspended','rejected');
CREATE TYPE public.commission_kind AS ENUM ('percentage','fixed');
CREATE TYPE public.commission_status AS ENUM ('pending','approved','paid','reversed','cancelled');
CREATE TYPE public.withdrawal_status AS ENUM ('requested','approved','processing','paid','rejected');

-- ============ SETTINGS (single row) ============
CREATE TABLE public.affiliate_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  enabled boolean NOT NULL DEFAULT true,
  default_commission_kind public.commission_kind NOT NULL DEFAULT 'percentage',
  default_commission_value numeric NOT NULL DEFAULT 5,
  attribution_days integer NOT NULL DEFAULT 30,
  cookie_days integer NOT NULL DEFAULT 30,
  min_payout numeric NOT NULL DEFAULT 500,
  auto_approve_affiliates boolean NOT NULL DEFAULT false,
  auto_approve_commission_on_delivery boolean NOT NULL DEFAULT true,
  exclude_shipping boolean NOT NULL DEFAULT true,
  terms text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.affiliate_settings TO anon, authenticated;
GRANT ALL ON public.affiliate_settings TO service_role;
ALTER TABLE public.affiliate_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "affiliate settings readable" ON public.affiliate_settings FOR SELECT USING (true);
CREATE POLICY "admins manage affiliate settings" ON public.affiliate_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_affiliate_settings_updated BEFORE UPDATE ON public.affiliate_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
INSERT INTO public.affiliate_settings (id) VALUES (true);

-- ============ AFFILIATES ============
CREATE TABLE public.affiliates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  code text NOT NULL UNIQUE,
  full_name text NOT NULL,
  email text NOT NULL,
  mobile text NOT NULL,
  company text,
  website text,
  address text,
  city text,
  state text,
  pincode text,
  pan text,
  gstin text,
  payout_method text NOT NULL DEFAULT 'upi',
  payout_upi text,
  payout_account_name text,
  payout_account_number text,
  payout_ifsc text,
  payout_bank text,
  status public.affiliate_status NOT NULL DEFAULT 'pending',
  commission_kind public.commission_kind,
  commission_value numeric,
  notes text,
  admin_notes text,
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX affiliates_user_idx ON public.affiliates(user_id);
CREATE INDEX affiliates_code_idx ON public.affiliates(upper(code));
GRANT SELECT, INSERT, UPDATE ON public.affiliates TO authenticated;
GRANT ALL ON public.affiliates TO service_role;
ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "affiliates read own" ON public.affiliates FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "affiliates apply for self" ON public.affiliates FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "admins update affiliates" ON public.affiliates FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins delete affiliates" ON public.affiliates FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_affiliates_updated BEFORE UPDATE ON public.affiliates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ REFERRALS ============
CREATE TABLE public.affiliate_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  visitor_id text,
  landing_path text,
  referrer text,
  ip text,
  user_agent text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  converted_at timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX affiliate_referrals_user_uniq ON public.affiliate_referrals(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX affiliate_referrals_visitor_idx ON public.affiliate_referrals(visitor_id);
CREATE INDEX affiliate_referrals_affiliate_idx ON public.affiliate_referrals(affiliate_id);
GRANT SELECT ON public.affiliate_referrals TO authenticated;
GRANT ALL ON public.affiliate_referrals TO service_role;
ALTER TABLE public.affiliate_referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "referrals read own or admin" ON public.affiliate_referrals FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR EXISTS (SELECT 1 FROM public.affiliates a WHERE a.id = affiliate_id AND a.user_id = auth.uid())
  );

-- ============ COMMISSIONS ============
CREATE TABLE public.affiliate_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  referral_id uuid REFERENCES public.affiliate_referrals(id) ON DELETE SET NULL,
  order_number text,
  order_total numeric NOT NULL DEFAULT 0,
  eligible_amount numeric NOT NULL DEFAULT 0,
  commission_kind public.commission_kind NOT NULL,
  commission_value numeric NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  status public.commission_status NOT NULL DEFAULT 'pending',
  reason text,
  approved_at timestamptz,
  paid_at timestamptz,
  withdrawal_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX affiliate_commissions_order_uniq ON public.affiliate_commissions(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX affiliate_commissions_affiliate_idx ON public.affiliate_commissions(affiliate_id, status);
GRANT SELECT ON public.affiliate_commissions TO authenticated;
GRANT ALL ON public.affiliate_commissions TO service_role;
ALTER TABLE public.affiliate_commissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "commissions read own or admin" ON public.affiliate_commissions FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR EXISTS (SELECT 1 FROM public.affiliates a WHERE a.id = affiliate_id AND a.user_id = auth.uid())
  );
CREATE TRIGGER trg_affiliate_commissions_updated BEFORE UPDATE ON public.affiliate_commissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ WITHDRAWALS ============
CREATE TABLE public.affiliate_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  method text NOT NULL DEFAULT 'upi',
  payout_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  status public.withdrawal_status NOT NULL DEFAULT 'requested',
  reference text,
  admin_note text,
  processed_by uuid REFERENCES auth.users(id),
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX affiliate_withdrawals_affiliate_idx ON public.affiliate_withdrawals(affiliate_id, status);
GRANT SELECT ON public.affiliate_withdrawals TO authenticated;
GRANT ALL ON public.affiliate_withdrawals TO service_role;
ALTER TABLE public.affiliate_withdrawals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "withdrawals read own or admin" ON public.affiliate_withdrawals FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR EXISTS (SELECT 1 FROM public.affiliates a WHERE a.id = affiliate_id AND a.user_id = auth.uid())
  );
CREATE TRIGGER trg_affiliate_withdrawals_updated BEFORE UPDATE ON public.affiliate_withdrawals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ LOGS ============
CREATE TABLE public.affiliate_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid REFERENCES public.affiliates(id) ON DELETE CASCADE,
  actor_user_id uuid,
  action text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX affiliate_logs_affiliate_idx ON public.affiliate_logs(affiliate_id, created_at DESC);
GRANT SELECT ON public.affiliate_logs TO authenticated;
GRANT ALL ON public.affiliate_logs TO service_role;
ALTER TABLE public.affiliate_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "logs read own or admin" ON public.affiliate_logs FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR EXISTS (SELECT 1 FROM public.affiliates a WHERE a.id = affiliate_id AND a.user_id = auth.uid())
  );

-- ============ BALANCE HELPER ============
CREATE OR REPLACE FUNCTION public.affiliate_balance(_affiliate_id uuid)
RETURNS TABLE(pending numeric, approved numeric, paid numeric, reversed numeric, withdrawn_pending numeric, available numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH c AS (
    SELECT
      COALESCE(SUM(amount) FILTER (WHERE status='pending'),0) AS pending,
      COALESCE(SUM(amount) FILTER (WHERE status='approved'),0) AS approved,
      COALESCE(SUM(amount) FILTER (WHERE status='paid'),0) AS paid,
      COALESCE(SUM(amount) FILTER (WHERE status='reversed'),0) AS reversed
    FROM public.affiliate_commissions WHERE affiliate_id = _affiliate_id
  ), w AS (
    SELECT COALESCE(SUM(amount),0) AS held
    FROM public.affiliate_withdrawals
    WHERE affiliate_id = _affiliate_id AND status IN ('requested','approved','processing')
  )
  SELECT c.pending, c.approved, c.paid, c.reversed, w.held,
         GREATEST(0, c.approved - w.held)
  FROM c, w;
$$;