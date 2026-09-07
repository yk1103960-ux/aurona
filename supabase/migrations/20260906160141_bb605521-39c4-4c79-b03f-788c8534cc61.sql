-- Preserve coupon history: archive instead of deleting records referenced by orders.
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS archived_at timestamptz;
CREATE INDEX IF NOT EXISTS coupons_archived_active_idx ON public.coupons(archived_at, active);

DROP POLICY IF EXISTS "public read active coupons" ON public.coupons;
CREATE POLICY "public read active coupons" ON public.coupons
  FOR SELECT USING (active = true AND archived_at IS NULL);