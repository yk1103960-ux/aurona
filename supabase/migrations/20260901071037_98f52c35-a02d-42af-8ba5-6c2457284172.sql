ALTER TABLE public.auth_otp_challenges ADD COLUMN IF NOT EXISTS user_id uuid;
CREATE INDEX IF NOT EXISTS auth_otp_challenges_purpose_user_idx ON public.auth_otp_challenges (purpose, user_id, created_at DESC);

INSERT INTO public.site_settings (key, value)
VALUES
  ('twofa_sms_enabled', 'true'),
  ('twofa_required_roles', 'admin,staff,customer,retailer,distributor,franchise,student'),
  ('otp_expiry_seconds', '300'),
  ('otp_max_attempts', '5'),
  ('otp_resend_cooldown', '60')
ON CONFLICT (key) DO NOTHING;