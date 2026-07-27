
DROP VIEW IF EXISTS public.payment_gateways_public;
CREATE VIEW public.payment_gateways_public
  WITH (security_invoker = true) AS
  SELECT provider, enabled, mode, config_public, secret_last4, connected_at, updated_at
  FROM public.payment_gateways;
GRANT SELECT ON public.payment_gateways_public TO anon, authenticated;
