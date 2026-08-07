CREATE TABLE public.woo_import_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity text NOT NULL,
  external_id text NOT NULL,
  payload jsonb NOT NULL,
  applied boolean NOT NULL DEFAULT false,
  imported_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity, external_id)
);
GRANT ALL ON public.woo_import_records TO service_role;
ALTER TABLE public.woo_import_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read woo imports" ON public.woo_import_records FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));