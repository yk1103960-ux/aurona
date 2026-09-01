CREATE TABLE public.career_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid REFERENCES public.career_programs(id) ON DELETE SET NULL,
  program_title text NOT NULL,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  city text,
  experience text,
  message text,
  resume_url text,
  status text NOT NULL DEFAULT 'new',
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.career_applications TO anon;
GRANT INSERT, SELECT ON public.career_applications TO authenticated;
GRANT ALL ON public.career_applications TO service_role;

ALTER TABLE public.career_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit an application" ON public.career_applications
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Applicants can view their own applications" ON public.career_applications
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Admins can view applications" ON public.career_applications
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update applications" ON public.career_applications
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER career_applications_updated_at BEFORE UPDATE ON public.career_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();