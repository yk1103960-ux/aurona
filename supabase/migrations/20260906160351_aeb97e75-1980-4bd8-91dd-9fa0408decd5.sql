-- Granular admin access profiles. Existing admins are safely backfilled as Super Admin.
CREATE TABLE IF NOT EXISTS public.admin_permissions (
  key text PRIMARY KEY,
  module text NOT NULL,
  label text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.admin_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  is_system boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_role_permissions (
  role_id uuid NOT NULL REFERENCES public.admin_roles(id) ON DELETE CASCADE,
  permission_key text NOT NULL REFERENCES public.admin_permissions(key) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_key)
);

CREATE TABLE IF NOT EXISTS public.admin_user_roles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.admin_roles(id) ON DELETE RESTRICT,
  assigned_by uuid,
  assigned_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_user_roles ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.admin_permissions, public.admin_roles, public.admin_role_permissions, public.admin_user_roles TO authenticated;
GRANT ALL ON public.admin_permissions, public.admin_roles, public.admin_role_permissions, public.admin_user_roles TO service_role;

DO $$ BEGIN
  CREATE POLICY admin_permissions_read ON public.admin_permissions FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY admin_roles_read ON public.admin_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY admin_role_permissions_read ON public.admin_role_permissions FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY admin_user_roles_read ON public.admin_user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

INSERT INTO public.admin_permissions(key, module, label) VALUES
  ('catalog.manage','Catalog','Manage products, variants and images'),
  ('inventory.manage','Inventory','View and adjust SKU inventory'),
  ('orders.view','Orders','View orders'),
  ('orders.manage','Orders','Advance, cancel and fulfil orders'),
  ('customers.view','Customers','View customers and partners'),
  ('customers.manage','Customers','Manage customer and partner access'),
  ('coupons.manage','Marketing','Manage coupons'),
  ('reports.view','Reports','View operational reports'),
  ('settings.manage','Settings','Manage storefront settings and integrations'),
  ('roles.manage','Security','Manage admin access profiles')
ON CONFLICT (key) DO UPDATE SET module = EXCLUDED.module, label = EXCLUDED.label;

INSERT INTO public.admin_roles(key, name, description) VALUES
  ('super_admin','Super Admin','Full access to every admin module'),
  ('catalog_manager','Catalog Manager','Products, variants, media and inventory'),
  ('order_manager','Order Manager','Orders, customers and coupons'),
  ('analyst','Analyst','Read-only operational reporting'),
  ('support','Customer Support','Customer records and order visibility')
ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO public.admin_role_permissions(role_id, permission_key)
SELECT r.id, p.key FROM public.admin_roles r CROSS JOIN public.admin_permissions p WHERE r.key = 'super_admin'
ON CONFLICT DO NOTHING;
INSERT INTO public.admin_role_permissions(role_id, permission_key)
SELECT r.id, p.key FROM public.admin_roles r JOIN public.admin_permissions p ON p.key IN ('catalog.manage','inventory.manage') WHERE r.key = 'catalog_manager'
ON CONFLICT DO NOTHING;
INSERT INTO public.admin_role_permissions(role_id, permission_key)
SELECT r.id, p.key FROM public.admin_roles r JOIN public.admin_permissions p ON p.key IN ('orders.view','orders.manage','customers.view','customers.manage','coupons.manage') WHERE r.key = 'order_manager'
ON CONFLICT DO NOTHING;
INSERT INTO public.admin_role_permissions(role_id, permission_key)
SELECT r.id, p.key FROM public.admin_roles r JOIN public.admin_permissions p ON p.key = 'reports.view' WHERE r.key = 'analyst'
ON CONFLICT DO NOTHING;
INSERT INTO public.admin_role_permissions(role_id, permission_key)
SELECT r.id, p.key FROM public.admin_roles r JOIN public.admin_permissions p ON p.key IN ('orders.view','customers.view','customers.manage') WHERE r.key = 'support'
ON CONFLICT DO NOTHING;

INSERT INTO public.admin_user_roles(user_id, role_id)
SELECT ur.user_id, r.id FROM public.user_roles ur CROSS JOIN public.admin_roles r
WHERE ur.role = 'admin' AND r.key = 'super_admin'
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.has_admin_permission(_user_id uuid, _permission_key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'admin') AND EXISTS (
    SELECT 1 FROM public.admin_user_roles aur
    JOIN public.admin_role_permissions arp ON arp.role_id = aur.role_id
    WHERE aur.user_id = _user_id AND arp.permission_key = _permission_key
  );
$$;
REVOKE ALL ON FUNCTION public.has_admin_permission(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_admin_permission(uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_assign_access_role(_target_user_id uuid, _role_id uuid, _actor_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  old_role_key text;
  new_role_key text;
  super_count integer;
BEGIN
  IF NOT public.has_role(_target_user_id, 'admin') THEN RAISE EXCEPTION 'target user is not an admin'; END IF;
  SELECT key INTO new_role_key FROM public.admin_roles WHERE id = _role_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'access profile not found'; END IF;
  SELECT r.key INTO old_role_key FROM public.admin_user_roles aur JOIN public.admin_roles r ON r.id = aur.role_id WHERE aur.user_id = _target_user_id FOR UPDATE;
  IF old_role_key = 'super_admin' AND new_role_key <> 'super_admin' THEN
    SELECT count(*) INTO super_count FROM public.admin_user_roles aur JOIN public.admin_roles r ON r.id = aur.role_id WHERE r.key = 'super_admin';
    IF super_count <= 1 THEN RAISE EXCEPTION 'the final Super Admin cannot be downgraded'; END IF;
  END IF;
  INSERT INTO public.admin_user_roles(user_id, role_id, assigned_by, assigned_at)
  VALUES (_target_user_id, _role_id, _actor_user_id, now())
  ON CONFLICT (user_id) DO UPDATE SET role_id = EXCLUDED.role_id, assigned_by = EXCLUDED.assigned_by, assigned_at = now();
END; $$;
REVOKE ALL ON FUNCTION public.admin_assign_access_role(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_assign_access_role(uuid,uuid,uuid) TO service_role;