CREATE TABLE public.auth_otp_challenges (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  phone text,
  channel text NOT NULL DEFAULT 'sms',
  purpose text NOT NULL DEFAULT 'signup',
  code_hash text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  consumed_at timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX auth_otp_challenges_email_idx ON public.auth_otp_challenges (email, created_at DESC);

GRANT ALL ON public.auth_otp_challenges TO service_role;

ALTER TABLE public.auth_otp_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can review OTP challenges"
ON public.auth_otp_challenges FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_auth_otp_challenges_updated
BEFORE UPDATE ON public.auth_otp_challenges
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();