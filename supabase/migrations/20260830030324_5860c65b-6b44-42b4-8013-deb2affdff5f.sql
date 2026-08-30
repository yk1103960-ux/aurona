CREATE OR REPLACE FUNCTION public.my_role_status()
RETURNS TABLE(role text, status text, intended_role text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE uid uuid; app_status text; app_type text; ir text; BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN RETURN QUERY SELECT 'guest'::text,'anon'::text,'guest'::text; RETURN; END IF;
  IF public.has_role(uid,'admin') THEN RETURN QUERY SELECT 'admin'::text,'approved'::text,'admin'::text; RETURN; END IF;

  SELECT p.account_type INTO ir FROM public.profiles p WHERE p.id = uid;

  SELECT pa.status::text, pa.partner_type::text
    INTO app_status, app_type
    FROM public.partner_applications pa
   WHERE pa.user_id = uid
     AND pa.partner_type IN ('retailer','distributor')
   ORDER BY pa.created_at DESC
   LIMIT 1;

  IF app_type IN ('distributor','retailer') THEN
    RETURN QUERY SELECT app_type, COALESCE(app_status,'pending'), COALESCE(ir, app_type); RETURN;
  END IF;

  RETURN QUERY SELECT 'customer'::text,'approved'::text, COALESCE(ir,'customer'); RETURN;
END; $$;