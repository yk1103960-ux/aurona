
-- Create initial admin user with fixed credentials (dev bootstrap)
DO $$
DECLARE
  admin_email text := 'admin@aurona.in';
  admin_password text := 'Aurona123@_$#&-';
  admin_uid uuid;
BEGIN
  SELECT id INTO admin_uid FROM auth.users WHERE email = admin_email;

  IF admin_uid IS NULL THEN
    admin_uid := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change,
      email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      admin_uid,
      'authenticated',
      'authenticated',
      admin_email,
      crypt(admin_password, gen_salt('bf')),
      now(),
      jsonb_build_object('provider','email','providers',jsonb_build_array('email')),
      jsonb_build_object('full_name','Aurona Admin','intended_role','admin'),
      now(), now(), '', '', '', ''
    );

    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (
      gen_random_uuid(), admin_uid,
      jsonb_build_object('sub', admin_uid::text, 'email', admin_email, 'email_verified', true),
      'email', admin_uid::text, now(), now(), now()
    );
  ELSE
    -- Reset password to the specified bootstrap value in case it already exists
    UPDATE auth.users
      SET encrypted_password = crypt(admin_password, gen_salt('bf')),
          email_confirmed_at = COALESCE(email_confirmed_at, now()),
          updated_at = now()
      WHERE id = admin_uid;
  END IF;

  -- Ensure profile row
  INSERT INTO public.profiles (id, full_name, account_type)
  VALUES (admin_uid, 'Aurona Admin', 'admin')
  ON CONFLICT (id) DO NOTHING;

  -- Assign admin role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (admin_uid, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
END $$;

-- Disable public sign-ups from the admin role path: handle_new_user already
-- only assigns 'customer' by default and requires application review for
-- retailer/distributor — 'admin' cannot be self-assigned via signup metadata.
