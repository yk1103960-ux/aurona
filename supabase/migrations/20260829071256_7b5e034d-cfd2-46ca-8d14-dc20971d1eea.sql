CREATE TABLE public.cart_reminders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stage text NOT NULL,
  cart_signature text NOT NULL,
  coupon_code text,
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, stage, cart_signature)
);

GRANT SELECT ON public.cart_reminders TO authenticated;
GRANT ALL ON public.cart_reminders TO service_role;
ALTER TABLE public.cart_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own cart reminders" ON public.cart_reminders
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins read cart reminders" ON public.cart_reminders
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX cart_reminders_user_idx ON public.cart_reminders (user_id, sent_at DESC);

INSERT INTO public.coupons (code, description, type, value, min_order_value, max_discount, per_user_limit, eligible_roles, active)
VALUES ('CART20', 'Abandoned cart recovery — 20% off', 'percentage', 20, 499, 1500, 1, ARRAY['customer']::text[], true)
ON CONFLICT (code) DO NOTHING;