CREATE TABLE public.variant_program_commissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES public.referral_programs(id) ON DELETE CASCADE,
  commission_kind public.commission_kind NOT NULL DEFAULT 'percentage',
  commission_value NUMERIC NOT NULL DEFAULT 0,
  max_commission NUMERIC,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (variant_id, program_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.variant_program_commissions TO authenticated;
GRANT ALL ON public.variant_program_commissions TO service_role;

ALTER TABLE public.variant_program_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage variant program commissions"
ON public.variant_program_commissions
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_variant_program_commissions_updated_at
BEFORE UPDATE ON public.variant_program_commissions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();