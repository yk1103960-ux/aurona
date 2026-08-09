CREATE TABLE public.shipment_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'shiprocket',
  event_key text NOT NULL,
  awb_code text,
  courier_name text,
  shipment_status text,
  status_code text,
  location text,
  event_time timestamp with time zone,
  payload jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX shipment_events_provider_event_key_idx ON public.shipment_events (provider, event_key);
CREATE INDEX shipment_events_order_idx ON public.shipment_events (order_id, event_time DESC);
CREATE INDEX orders_awb_code_idx ON public.orders (awb_code);
CREATE INDEX orders_shipment_id_idx ON public.orders (shipment_id);

GRANT SELECT ON public.shipment_events TO authenticated;
GRANT ALL ON public.shipment_events TO service_role;

ALTER TABLE public.shipment_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own shipment events read" ON public.shipment_events FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = shipment_events.order_id AND o.user_id = auth.uid()));

CREATE POLICY "admin read shipment events" ON public.shipment_events FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));