
-- Role helper: partner approved
CREATE OR REPLACE FUNCTION public.is_partner_approved(_uid uuid, _type partner_type)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.partner_applications
    WHERE user_id=_uid AND partner_type=_type AND status='approved');
$$;

-- Effective role
CREATE OR REPLACE FUNCTION public.current_pricing_role()
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid; BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN RETURN 'guest'; END IF;
  IF public.has_role(uid,'admin') THEN RETURN 'admin'; END IF;
  IF public.has_role(uid,'distributor') AND public.is_partner_approved(uid,'distributor') THEN RETURN 'distributor'; END IF;
  IF public.has_role(uid,'retailer') AND public.is_partner_approved(uid,'retailer') THEN RETURN 'retailer'; END IF;
  RETURN 'customer';
END; $$;

-- Role + application status for UI
CREATE OR REPLACE FUNCTION public.my_role_status()
RETURNS TABLE(role text, status text, intended_role text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid; app_status text; app_type text; ir text; BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN RETURN QUERY SELECT 'guest'::text,'anon'::text,'guest'::text; RETURN; END IF;
  IF public.has_role(uid,'admin') THEN RETURN QUERY SELECT 'admin'::text,'approved'::text,'admin'::text; RETURN; END IF;
  SELECT account_type INTO ir FROM public.profiles WHERE id=uid;
  SELECT status::text, partner_type::text INTO app_status, app_type
    FROM public.partner_applications WHERE user_id=uid ORDER BY created_at DESC LIMIT 1;
  IF app_type IN ('distributor','retailer') THEN
    RETURN QUERY SELECT app_type, COALESCE(app_status,'pending'), COALESCE(ir,app_type); RETURN;
  END IF;
  RETURN QUERY SELECT 'customer'::text,'approved'::text, COALESCE(ir,'customer'); RETURN;
END; $$;
GRANT EXECUTE ON FUNCTION public.my_role_status() TO anon, authenticated;

-- Role-aware pricing
CREATE OR REPLACE FUNCTION public.get_visible_prices(_skus text[])
RETURNS TABLE(sku text, mrp numeric, price numeric, role text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE r text; dist_visible text; BEGIN
  r := public.current_pricing_role();
  IF r = 'distributor' THEN
    SELECT value INTO dist_visible FROM public.site_settings WHERE key='distributor_price_visible';
    IF COALESCE(dist_visible,'true') = 'true' THEN
      RETURN QUERY SELECT v.sku, v.mrp, COALESCE(v.distributor_price, v.retailer_price, v.price), r
        FROM public.product_variants v WHERE v.sku = ANY(_skus);
    ELSE
      RETURN QUERY SELECT v.sku, v.mrp, NULL::numeric, r
        FROM public.product_variants v WHERE v.sku = ANY(_skus);
    END IF;
  ELSIF r = 'retailer' THEN
    RETURN QUERY SELECT v.sku, v.mrp, COALESCE(v.retailer_price, v.price), r
      FROM public.product_variants v WHERE v.sku = ANY(_skus);
  ELSE
    RETURN QUERY SELECT v.sku, v.mrp, v.price, r
      FROM public.product_variants v WHERE v.sku = ANY(_skus);
  END IF;
END; $$;
GRANT EXECUTE ON FUNCTION public.get_visible_prices(text[]) TO anon, authenticated;

-- Revoke direct access to sensitive price columns
REVOKE SELECT (retailer_price, distributor_price) ON public.product_variants FROM anon, authenticated;

-- Improved signup trigger: honors intended role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE ir text; BEGIN
  ir := COALESCE(NEW.raw_user_meta_data->>'intended_role','customer');
  INSERT INTO public.profiles (id, full_name, phone, account_type)
  VALUES (NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'phone',
    ir);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'customer') ON CONFLICT DO NOTHING;
  IF ir IN ('retailer','distributor') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, ir::app_role) ON CONFLICT DO NOTHING;
    INSERT INTO public.partner_applications (user_id, partner_type, status, full_name, mobile, email, business_name)
    VALUES (NEW.id, ir::partner_type, 'pending',
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
      COALESCE(NEW.raw_user_meta_data->>'phone',''),
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'business_name',''));
  END IF;
  RETURN NEW;
END; $$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Admin approval RPC
CREATE OR REPLACE FUNCTION public.approve_partner(_app_id uuid, _decision text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _uid uuid; _ptype partner_type; BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'not admin'; END IF;
  IF _decision NOT IN ('approved','rejected') THEN RAISE EXCEPTION 'bad decision'; END IF;
  UPDATE public.partner_applications
    SET status=_decision::application_status, reviewed_by=auth.uid(), reviewed_at=now()
    WHERE id=_app_id RETURNING user_id, partner_type INTO _uid, _ptype;
END; $$;
GRANT EXECUTE ON FUNCTION public.approve_partner(uuid,text) TO authenticated;

-- Site settings additions
INSERT INTO public.site_settings(key,value) VALUES
  ('guest_price_mode','mrp'),
  ('distributor_price_visible','true'),
  ('whatsapp_number','+919602570026')
ON CONFLICT (key) DO NOTHING;

-- Allow admin full access on partner_applications for approvals UI
DROP POLICY IF EXISTS "admin manage partner apps" ON public.partner_applications;
CREATE POLICY "admin manage partner apps" ON public.partner_applications
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
