DO $$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.admin_upsert_product_family(jsonb)'::regprocedure);
  d := regexp_replace(d, 'INSERT INTO public\.product_variants \(.*?WHERE NOT EXISTS \(SELECT 1 FROM public\.product_variants WHERE family_id = _family_id\);', '-- no automatic default variant; variants come only from Generate Variations', 's');
  IF position('INSERT INTO public.product_variants' in d) > 0 THEN RAISE EXCEPTION 'default variant insert not removed'; END IF;
  EXECUTE d;
END $$;