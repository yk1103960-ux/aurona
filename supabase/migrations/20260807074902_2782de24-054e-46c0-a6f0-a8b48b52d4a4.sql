CREATE TABLE public.user_security (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked boolean NOT NULL DEFAULT false,
  blocked_reason text,
  blocked_at timestamptz,
  email_verified_at timestamptz,
  phone_verified_at timestamptz,
  failed_login_count integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  last_login_at timestamptz,
  last_login_ip text,
  last_login_device text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_security TO authenticated;
GRANT ALL ON public.user_security TO service_role;
ALTER TABLE public.user_security ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own security row" ON public.user_security FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admins read security" ON public.user_security FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_user_security_updated BEFORE UPDATE ON public.user_security FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.auth_login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL,
  user_id uuid,
  method text NOT NULL DEFAULT 'password',
  success boolean NOT NULL DEFAULT false,
  reason text,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_login_attempts_identifier ON public.auth_login_attempts (identifier, created_at DESC);
GRANT SELECT ON public.auth_login_attempts TO authenticated;
GRANT ALL ON public.auth_login_attempts TO service_role;
ALTER TABLE public.auth_login_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read login attempts" ON public.auth_login_attempts FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device text,
  ip text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_user_sessions_user ON public.user_sessions (user_id, last_seen_at DESC);
GRANT SELECT ON public.user_sessions TO authenticated;
GRANT ALL ON public.user_sessions TO service_role;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sessions" ON public.user_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admins read sessions" ON public.user_sessions FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

INSERT INTO public.site_settings (key, value) VALUES
  ('otp_expiry_seconds','300'),
  ('otp_max_attempts','5'),
  ('otp_resend_cooldown','60'),
  ('login_max_failures','5'),
  ('login_lock_minutes','15'),
  ('block_fake_emails','true')
ON CONFLICT (key) DO NOTHING;