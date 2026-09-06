-- Complete the remaining operational admin domains without destructive deletes.

ALTER TABLE public.cms_blocks ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.shipping_zones ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.shipping_zones ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.tax_rules ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.tax_rules ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.admin_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'catalog_create',
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','rolled_back')),
  row_count integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  rolled_back_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  rolled_back_at timestamptz
);
CREATE TABLE IF NOT EXISTS public.admin_import_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.admin_import_batches(id) ON DELETE CASCADE,
  family_id uuid NOT NULL REFERENCES public.product_families(id) ON DELETE RESTRICT,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  sku text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_import_items ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.admin_import_batches, public.admin_import_items TO authenticated;
GRANT ALL ON public.admin_import_batches, public.admin_import_items TO service_role;
CREATE POLICY admin_import_batches_read ON public.admin_import_batches FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY admin_import_items_read ON public.admin_import_items FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.admin_import_new_families(_rows jsonb, _actor_user_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE batch_id uuid; item jsonb; result jsonb; normalized_sku text;
BEGIN
  IF jsonb_array_length(COALESCE(_rows,'[]'::jsonb)) < 1 OR jsonb_array_length(_rows) > 1000 THEN
    RAISE EXCEPTION 'import must contain between 1 and 1000 rows';
  END IF;
  INSERT INTO public.admin_import_batches(row_count, created_by) VALUES (jsonb_array_length(_rows), _actor_user_id) RETURNING id INTO batch_id;
  FOR item IN SELECT value FROM jsonb_array_elements(_rows) LOOP
    normalized_sku := upper(btrim(item->>'sku'));
    IF EXISTS (SELECT 1 FROM public.product_families WHERE main_sku = normalized_sku)
      OR EXISTS (SELECT 1 FROM public.product_variants WHERE sku = normalized_sku) THEN
      RAISE EXCEPTION 'SKU % already exists; bulk import is create-only', normalized_sku;
    END IF;
    result := public.admin_upsert_product_family(item);
    INSERT INTO public.admin_import_items(batch_id, family_id, product_id, sku)
    VALUES (batch_id, (result->>'family_id')::uuid, (result->>'product_id')::uuid, normalized_sku);
  END LOOP;
  RETURN batch_id;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_rollback_import_batch(_batch_id uuid, _actor_user_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE batch public.admin_import_batches%ROWTYPE; item public.admin_import_items%ROWTYPE; affected integer := 0;
BEGIN
  SELECT * INTO batch FROM public.admin_import_batches WHERE id = _batch_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'import batch not found'; END IF;
  IF batch.status <> 'completed' THEN RAISE EXCEPTION 'import batch is already rolled back'; END IF;
  FOR item IN SELECT * FROM public.admin_import_items WHERE batch_id = _batch_id LOOP
    UPDATE public.product_variants SET is_active = false, archived_at = now(), updated_at = now() WHERE family_id = item.family_id;
    UPDATE public.product_families SET is_published = false, archived_at = now(), updated_at = now() WHERE id = item.family_id;
    UPDATE public.products SET is_published = false, archived_at = now() WHERE id = item.product_id;
    affected := affected + 1;
  END LOOP;
  UPDATE public.admin_import_batches SET status = 'rolled_back', rolled_back_by = _actor_user_id, rolled_back_at = now() WHERE id = _batch_id;
  RETURN affected;
END; $$;
REVOKE ALL ON FUNCTION public.admin_import_new_families(jsonb,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_rollback_import_batch(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_import_new_families(jsonb,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_rollback_import_batch(uuid,uuid) TO service_role;

CREATE TABLE IF NOT EXISTS public.product_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid REFERENCES public.product_families(id) ON DELETE SET NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name text NOT NULL,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title text,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','published','rejected')),
  verified_purchase boolean NOT NULL DEFAULT false,
  moderated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  moderated_at timestamptz,
  moderation_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.product_reviews TO anon, authenticated;
GRANT INSERT ON public.product_reviews TO authenticated;
GRANT ALL ON public.product_reviews TO service_role;
CREATE POLICY product_reviews_public_read ON public.product_reviews FOR SELECT USING (status = 'published' OR public.has_role(auth.uid(),'admin'));
CREATE POLICY product_reviews_own_insert ON public.product_reviews FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND status = 'pending');
CREATE INDEX IF NOT EXISTS product_reviews_status_created_idx ON public.product_reviews(status, created_at DESC);
CREATE TRIGGER trg_product_reviews_updated BEFORE UPDATE ON public.product_reviews FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.refresh_product_review_summary(_family_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE published_count integer; average_rating numeric;
BEGIN
  IF _family_id IS NULL THEN RETURN; END IF;
  SELECT count(*)::integer, COALESCE(round(avg(rating)::numeric, 2), 0)
    INTO published_count, average_rating
  FROM public.product_reviews
  WHERE family_id = _family_id AND status = 'published';
  UPDATE public.product_families
  SET rating = average_rating, review_count = published_count, updated_at = now()
  WHERE id = _family_id;
  UPDATE public.products p
  SET rating = average_rating, review_count = published_count
  FROM public.product_families f
  WHERE f.id = _family_id AND p.id = f.legacy_product_id;
END; $$;
CREATE OR REPLACE FUNCTION public.on_product_review_summary_changed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.refresh_product_review_summary(OLD.family_id);
  ELSE
    PERFORM public.refresh_product_review_summary(NEW.family_id);
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.family_id IS DISTINCT FROM NEW.family_id THEN
    PERFORM public.refresh_product_review_summary(OLD.family_id);
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.refresh_product_review_summary(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.on_product_review_summary_changed() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_product_review_summary(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.on_product_review_summary_changed() TO service_role;
CREATE TRIGGER trg_product_review_summary
AFTER INSERT OR UPDATE OR DELETE ON public.product_reviews
FOR EACH ROW EXECUTE FUNCTION public.on_product_review_summary_changed();

CREATE TABLE IF NOT EXISTS public.support_ticket_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  body text NOT NULL,
  is_internal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.support_ticket_replies ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.support_ticket_replies TO authenticated;
GRANT ALL ON public.support_ticket_replies TO service_role;
CREATE POLICY support_replies_read ON public.support_ticket_replies FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND (t.user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff')))
  AND (NOT is_internal OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'))
);

CREATE TABLE IF NOT EXISTS public.marketing_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('flash_deal','homepage_promotion','coupon_campaign')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','active','paused','completed')),
  starts_at timestamptz,
  ends_at timestamptz,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);
ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.marketing_campaigns TO authenticated;
GRANT ALL ON public.marketing_campaigns TO service_role;
CREATE POLICY marketing_campaigns_admin_read ON public.marketing_campaigns FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_marketing_campaigns_updated BEFORE UPDATE ON public.marketing_campaigns FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.admin_permissions(key,module,label) VALUES
 ('returns.manage','Orders','Manage returns, replacements and refunds'),
 ('support.manage','Customers','Manage support tickets'),
 ('reviews.manage','Catalog','Moderate product reviews'),
 ('campaigns.manage','Marketing','Manage scheduled campaigns')
ON CONFLICT (key) DO UPDATE SET module = EXCLUDED.module, label = EXCLUDED.label;
INSERT INTO public.admin_role_permissions(role_id, permission_key)
SELECT r.id,p.key FROM public.admin_roles r JOIN public.admin_permissions p ON p.key IN ('returns.manage','support.manage','campaigns.manage') WHERE r.key IN ('super_admin','order_manager') ON CONFLICT DO NOTHING;
INSERT INTO public.admin_role_permissions(role_id, permission_key)
SELECT r.id,p.key FROM public.admin_roles r JOIN public.admin_permissions p ON p.key = 'reviews.manage' WHERE r.key IN ('super_admin','catalog_manager') ON CONFLICT DO NOTHING;
INSERT INTO public.admin_role_permissions(role_id, permission_key)
SELECT r.id,p.key FROM public.admin_roles r JOIN public.admin_permissions p ON p.key = 'support.manage' WHERE r.key = 'support' ON CONFLICT DO NOTHING;
INSERT INTO public.admin_role_permissions(role_id, permission_key)
SELECT r.id,p.key FROM public.admin_roles r CROSS JOIN public.admin_permissions p WHERE r.key = 'super_admin' ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.admin_update_return_request(
  _request_id uuid, _status public.return_status, _refund_amount numeric,
  _refund_reference text, _note text, _actor_user_id uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE request public.return_requests%ROWTYPE;
BEGIN
  SELECT * INTO request FROM public.return_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'return request not found'; END IF;
  IF COALESCE(_refund_amount,0) < 0 THEN RAISE EXCEPTION 'refund amount cannot be negative'; END IF;
  IF request.status IN ('completed','cancelled','rejected','refunded') AND _status <> request.status THEN RAISE EXCEPTION 'this request is already final'; END IF;
  UPDATE public.return_requests SET status = _status, refund_amount = COALESCE(_refund_amount,0),
    refund_reference = NULLIF(btrim(_refund_reference),''), admin_note = NULLIF(btrim(_note),''),
    reviewed_by = _actor_user_id, reviewed_at = now(), updated_at = now()
  WHERE id = _request_id;
END; $$;
REVOKE ALL ON FUNCTION public.admin_update_return_request(uuid,public.return_status,numeric,text,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_return_request(uuid,public.return_status,numeric,text,text,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_decide_cancellation(_request_id uuid, _decision text, _note text, _actor_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE request public.return_requests%ROWTYPE; linked_order public.orders%ROWTYPE; transition jsonb; paid boolean;
BEGIN
  SELECT * INTO request FROM public.return_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND OR request.kind <> 'cancellation' OR request.status <> 'requested' THEN RAISE EXCEPTION 'cancellation request is unavailable'; END IF;
  IF _decision = 'reject' THEN
    UPDATE public.return_requests SET status = 'rejected', admin_note = NULLIF(btrim(_note),''), reviewed_by = _actor_user_id, reviewed_at = now() WHERE id = _request_id;
    RETURN jsonb_build_object('cancelled',false,'refund_pending',false);
  ELSIF _decision <> 'approve' THEN RAISE EXCEPTION 'invalid decision'; END IF;
  SELECT * INTO linked_order FROM public.orders WHERE id = request.order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'linked order not found'; END IF;
  transition := public.admin_transition_order(linked_order.id, 'cancelled', _note, _actor_user_id);
  paid := linked_order.payment_status = 'paid';
  UPDATE public.orders SET payment_status = CASE WHEN paid THEN 'refund_pending' ELSE payment_status END WHERE id = linked_order.id;
  UPDATE public.return_requests SET status = CASE WHEN paid THEN 'refund_initiated'::public.return_status ELSE 'completed'::public.return_status END,
    admin_note = NULLIF(btrim(_note),''), reviewed_by = _actor_user_id, reviewed_at = now(),
    refund_amount = CASE WHEN paid THEN linked_order.total ELSE 0 END, refund_method = CASE WHEN paid THEN linked_order.payment_method ELSE NULL END
  WHERE id = _request_id;
  RETURN jsonb_build_object('cancelled',true,'refund_pending',paid,'restocked',transition->'restocked');
END; $$;
REVOKE ALL ON FUNCTION public.admin_decide_cancellation(uuid,text,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_decide_cancellation(uuid,text,text,uuid) TO service_role;