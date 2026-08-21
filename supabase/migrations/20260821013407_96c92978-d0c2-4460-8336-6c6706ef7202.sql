-- 1) Decorative Lights category
INSERT INTO public.categories (slug, name, parent_group, sort_order)
VALUES ('decorative-lights', 'Decorative Lights', 'led-lighting', 60)
ON CONFLICT (slug) DO NOTHING;

-- 2) Optional district on profile + addresses
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS district text;
ALTER TABLE public.addresses ADD COLUMN IF NOT EXISTS district text;

-- 3) FAQs
CREATE TABLE IF NOT EXISTS public.faqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  answer text NOT NULL,
  category text NOT NULL DEFAULT 'General',
  sort_order integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.faqs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.faqs TO authenticated;
GRANT ALL ON public.faqs TO service_role;
ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "faqs_public_read" ON public.faqs FOR SELECT USING (is_published = true);
CREATE POLICY "faqs_admin_all" ON public.faqs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_faqs_updated BEFORE UPDATE ON public.faqs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) Career programs
CREATE TABLE IF NOT EXISTS public.career_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  department text,
  location text,
  employment_type text,
  kind text NOT NULL DEFAULT 'job',
  description text NOT NULL DEFAULT '',
  eligibility text,
  reward text,
  apply_url text,
  apply_email text,
  sort_order integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.career_programs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.career_programs TO authenticated;
GRANT ALL ON public.career_programs TO service_role;
ALTER TABLE public.career_programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "career_public_read" ON public.career_programs FOR SELECT USING (is_published = true);
CREATE POLICY "career_admin_all" ON public.career_programs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_career_updated BEFORE UPDATE ON public.career_programs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5) Blog posts
CREATE TABLE IF NOT EXISTS public.blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  excerpt text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'Lighting Guide',
  cover_url text,
  author text NOT NULL DEFAULT 'Aurona Editorial',
  read_minutes integer NOT NULL DEFAULT 4,
  body jsonb NOT NULL DEFAULT '[]'::jsonb,
  published_at timestamptz NOT NULL DEFAULT now(),
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.blog_posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blog_posts TO authenticated;
GRANT ALL ON public.blog_posts TO service_role;
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blog_public_read" ON public.blog_posts FOR SELECT USING (is_published = true);
CREATE POLICY "blog_admin_all" ON public.blog_posts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_blog_updated BEFORE UPDATE ON public.blog_posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX IF NOT EXISTS blog_posts_published_idx ON public.blog_posts (is_published, published_at DESC);

-- 6) Notification log (welcome + security notifications)
CREATE TABLE IF NOT EXISTS public.notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  channel text NOT NULL,
  kind text NOT NULL,
  recipient_masked text,
  status text NOT NULL DEFAULT 'queued',
  provider_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.notification_log TO authenticated;
GRANT ALL ON public.notification_log TO service_role;
ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_own_read" ON public.notification_log FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE UNIQUE INDEX IF NOT EXISTS notification_log_once_idx
  ON public.notification_log (user_id, channel, kind)
  WHERE kind = 'welcome';