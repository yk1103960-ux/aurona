
ALTER TABLE public.payment_gateways
  ADD COLUMN IF NOT EXISTS config_secret_ciphertext text;

ALTER TABLE public.shipping_providers
  ADD COLUMN IF NOT EXISTS credentials_ciphertext text,
  ADD COLUMN IF NOT EXISTS auth_token_ciphertext text,
  ADD COLUMN IF NOT EXISTS auth_token_expires_at timestamptz;

-- Revoke direct SELECT on ciphertext-holding rows from anon/authenticated for shipping_providers already restricted;
-- for payment_gateways keep public SELECT but ciphertext column is not exposed via the PostgREST columnlist we use.
-- Restrict payment_gateways public read to non-secret columns via a view:
CREATE OR REPLACE VIEW public.payment_gateways_public AS
  SELECT provider, enabled, mode, config_public, secret_last4, connected_at, updated_at
  FROM public.payment_gateways;

GRANT SELECT ON public.payment_gateways_public TO anon, authenticated;
