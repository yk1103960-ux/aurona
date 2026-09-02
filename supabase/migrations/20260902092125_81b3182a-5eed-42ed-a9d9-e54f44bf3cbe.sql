ALTER TABLE public.career_applications
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS qualification text,
  ADD COLUMN IF NOT EXISTS consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS resume_path text;

CREATE TABLE IF NOT EXISTS public.abandoned_carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  cart_signature text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  item_count integer NOT NULL DEFAULT 0,
  cart_value numeric NOT NULL DEFAULT 0,
  contact_email text,
  contact_phone text,
  customer_name text,
  account_type text,
  status text NOT NULL DEFAULT 'open',
  first_reminder_at timestamptz,
  second_reminder_at timestamptz,
  coupon_code text,
  coupon_expires_at timestamptz,
  recovered_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  recovered_at timestamptz,
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, cart_signature)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.abandoned_carts TO authenticated;
GRANT ALL ON public.abandoned_carts TO service_role;
ALTER TABLE public.abandoned_carts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage abandoned carts" ON public.abandoned_carts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_abandoned_carts_updated BEFORE UPDATE ON public.abandoned_carts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_status ON public.abandoned_carts (status, last_activity_at DESC);

CREATE TABLE IF NOT EXISTS public.notification_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL,
  template text NOT NULL,
  recipient text NOT NULL,
  user_id uuid,
  subject text,
  body text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'queued',
  provider text,
  provider_message text,
  attempts integer NOT NULL DEFAULT 0,
  related_type text,
  related_id text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.notification_queue TO authenticated;
GRANT ALL ON public.notification_queue TO service_role;
ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read notification queue" ON public.notification_queue
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_notification_queue_updated BEFORE UPDATE ON public.notification_queue
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX IF NOT EXISTS idx_notification_queue_status ON public.notification_queue (status, created_at DESC);

INSERT INTO public.site_settings (key, value) VALUES
  ('cart_recovery_enabled', 'true'),
  ('cart_recovery_sending_enabled', 'false'),
  ('cart_recovery_first_delay_minutes', '60'),
  ('cart_recovery_second_delay_minutes', '1440'),
  ('cart_recovery_discount_percent', '20'),
  ('cart_recovery_coupon_validity_days', '7'),
  ('cart_recovery_link', 'https://aurona.co.in/cart'),
  ('cart_recovery_template_first', 'Hi {{name}}, you left {{items}} in your Aurona cart (₹{{value}}). Complete your order here: {{link}}'),
  ('cart_recovery_template_second', 'Hi {{name}}, here is {{discount}}% off your Aurona cart. Use code {{coupon}} before {{expiry}}: {{link}}'),
  ('career_admin_email', 'careers@aurona.co.in')
ON CONFLICT (key) DO NOTHING;