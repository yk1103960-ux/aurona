UPDATE public.profiles
SET account_type = 'retailer', updated_at = now()
WHERE account_type = 'retail';

CREATE OR REPLACE FUNCTION public.my_role_status()
RETURNS TABLE(role text, status text, intended_role text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  profile_role text;
  metadata_role text;
  resolved_role text;
  application_status text;
BEGIN
  IF uid IS NULL THEN
    RETURN QUERY SELECT 'guest'::text, 'anon'::text, 'guest'::text;
    RETURN;
  END IF;

  IF public.has_role(uid, 'admin') THEN
    RETURN QUERY SELECT 'admin'::text, 'approved'::text, 'admin'::text;
    RETURN;
  END IF;

  SELECT NULLIF(lower(trim(p.account_type)), '')
    INTO profile_role
    FROM public.profiles p
   WHERE p.id = uid;

  SELECT NULLIF(lower(trim(u.raw_user_meta_data->>'intended_role')), '')
    INTO metadata_role
    FROM auth.users u
   WHERE u.id = uid;

  resolved_role := CASE
    WHEN profile_role IN ('retailer', 'distributor') THEN profile_role
    WHEN metadata_role IN ('retailer', 'distributor') THEN metadata_role
    WHEN public.has_role(uid, 'distributor') THEN 'distributor'
    WHEN public.has_role(uid, 'retailer') THEN 'retailer'
    ELSE 'customer'
  END;

  IF resolved_role IN ('retailer', 'distributor') THEN
    SELECT pa.status::text
      INTO application_status
      FROM public.partner_applications pa
     WHERE pa.user_id = uid
       AND pa.partner_type::text = resolved_role
     ORDER BY pa.created_at DESC
     LIMIT 1;

    RETURN QUERY SELECT resolved_role, COALESCE(application_status, 'pending'), resolved_role;
    RETURN;
  END IF;

  RETURN QUERY SELECT 'customer'::text, 'approved'::text, 'customer'::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.my_role_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_role_status() TO service_role;