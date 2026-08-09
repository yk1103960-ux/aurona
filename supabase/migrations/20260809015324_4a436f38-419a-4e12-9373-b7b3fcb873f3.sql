CREATE TABLE IF NOT EXISTS public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'phonepe',
  order_id uuid references public.orders(id) on delete set null,
  merchant_txn_id text,
  stage text not null,
  environment text,
  endpoint text,
  http_method text,
  http_status integer,
  ok boolean not null default false,
  checkout_host text,
  amount numeric,
  currency text not null default 'INR',
  provider_code text,
  provider_message text,
  payment_state text,
  created_at timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS payment_events_order_idx ON public.payment_events(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payment_events_created_idx ON public.payment_events(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS payment_events_dedupe_idx ON public.payment_events(provider, merchant_txn_id, stage) WHERE merchant_txn_id IS NOT NULL;

GRANT SELECT ON public.payment_events TO authenticated;
GRANT ALL ON public.payment_events TO service_role;
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read payment diagnostics" ON public.payment_events;
CREATE POLICY "Admins can read payment diagnostics" ON public.payment_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));