DROP POLICY IF EXISTS "Tax rules are public" ON public.tax_rules;
REVOKE SELECT ON public.tax_rules FROM anon;