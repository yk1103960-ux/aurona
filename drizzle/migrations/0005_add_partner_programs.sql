ALTER TABLE public.affiliates
  ADD COLUMN IF NOT EXISTS program text NOT NULL DEFAULT 'affiliate';

ALTER TABLE public.affiliates
  DROP CONSTRAINT IF EXISTS affiliates_program_check;

ALTER TABLE public.affiliates
  ADD CONSTRAINT affiliates_program_check
  CHECK (program IN ('affiliate', 'sales', 'loyalty'));

COMMENT ON COLUMN public.affiliates.program IS 'Partner program: affiliate | sales | loyalty';

ALTER TABLE public.affiliate_settings
  ADD COLUMN IF NOT EXISTS program_commissions jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.affiliate_settings.program_commissions IS 'Per-program default commission, e.g. {"sales":{"kind":"percentage","value":8}}';