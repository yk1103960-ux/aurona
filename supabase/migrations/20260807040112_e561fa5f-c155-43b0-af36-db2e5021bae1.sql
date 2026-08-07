CREATE TYPE public.return_kind AS ENUM ('return','replacement','cancellation');
CREATE TYPE public.return_status AS ENUM ('requested','approved','rejected','pickup_scheduled','picked_up','received','refund_initiated','refunded','completed','cancelled');

CREATE TABLE public.return_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  kind public.return_kind NOT NULL,
  status public.return_status NOT NULL DEFAULT 'requested',
  reason text NOT NULL,
  comments text,
  refund_amount numeric NOT NULL DEFAULT 0,
  refund_method text,
  refund_reference text,
  admin_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.return_requests TO authenticated;
GRANT ALL ON public.return_requests TO service_role;
ALTER TABLE public.return_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own returns select" ON public.return_requests FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "own returns insert" ON public.return_requests FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid()));
CREATE POLICY "admin returns update" ON public.return_requests FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin returns delete" ON public.return_requests FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_return_requests_updated BEFORE UPDATE ON public.return_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_return_requests_order ON public.return_requests(order_id);
CREATE INDEX idx_return_requests_user ON public.return_requests(user_id);

CREATE TABLE public.return_request_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.return_requests(id) ON DELETE CASCADE,
  order_item_id uuid REFERENCES public.order_items(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  quantity integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.return_request_items TO authenticated;
GRANT ALL ON public.return_request_items TO service_role;
ALTER TABLE public.return_request_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "return items select" ON public.return_request_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.return_requests r WHERE r.id = request_id AND (r.user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));
CREATE POLICY "return items insert" ON public.return_request_items FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.return_requests r WHERE r.id = request_id AND r.user_id = auth.uid()));
CREATE POLICY "return items admin write" ON public.return_request_items FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE INDEX idx_return_request_items_request ON public.return_request_items(request_id);

CREATE TABLE public.return_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.return_requests(id) ON DELETE CASCADE,
  status public.return_status NOT NULL,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.return_events TO authenticated;
GRANT ALL ON public.return_events TO service_role;
ALTER TABLE public.return_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "return events select" ON public.return_events FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.return_requests r WHERE r.id = request_id AND (r.user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));
CREATE POLICY "return events insert" ON public.return_events FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM public.return_requests r WHERE r.id = request_id AND r.user_id = auth.uid()));
CREATE INDEX idx_return_events_request ON public.return_events(request_id);

CREATE OR REPLACE FUNCTION public.log_return_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.return_events(request_id, status, note, created_by) VALUES (NEW.id, NEW.status, 'Request submitted', NEW.user_id);
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.return_events(request_id, status, note, created_by) VALUES (NEW.id, NEW.status, NEW.admin_note, auth.uid());
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_return_requests_event AFTER INSERT OR UPDATE ON public.return_requests FOR EACH ROW EXECUTE FUNCTION public.log_return_event();