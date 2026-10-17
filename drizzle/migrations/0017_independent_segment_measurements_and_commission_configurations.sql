ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS retailer_weight_g numeric, ADD COLUMN IF NOT EXISTS retailer_dim_l numeric, ADD COLUMN IF NOT EXISTS retailer_dim_w numeric, ADD COLUMN IF NOT EXISTS retailer_dim_h numeric, ADD COLUMN IF NOT EXISTS distributor_weight_g numeric, ADD COLUMN IF NOT EXISTS distributor_dim_l numeric, ADD COLUMN IF NOT EXISTS distributor_dim_w numeric, ADD COLUMN IF NOT EXISTS distributor_dim_h numeric;
ALTER TABLE public.variant_program_commissions ADD COLUMN IF NOT EXISTS scoped_rules jsonb NOT NULL DEFAULT '{}'::jsonb;
DO $$ DECLARE definition text; BEGIN
 SELECT pg_get_functiondef(oid) INTO definition FROM pg_proc WHERE oid='public.admin_save_buyer_variant_matrix_v1(uuid,text,jsonb,jsonb,uuid)'::regprocedure;
 definition := replace(definition,'retailer_mrp = (item->>''retailer_mrp'')::numeric,','retailer_mrp = (item->>''retailer_mrp'')::numeric, retailer_weight_g = (item->>''retailer_weight_g'')::numeric, retailer_dim_l = (item->>''retailer_dim_l'')::numeric, retailer_dim_w = (item->>''retailer_dim_w'')::numeric, retailer_dim_h = (item->>''retailer_dim_h'')::numeric,');
 definition := replace(definition,'distributor_mrp = (item->>''distributor_mrp'')::numeric,','distributor_mrp = (item->>''distributor_mrp'')::numeric, distributor_weight_g = (item->>''distributor_weight_g'')::numeric, distributor_dim_l = (item->>''distributor_dim_l'')::numeric, distributor_dim_w = (item->>''distributor_dim_w'')::numeric, distributor_dim_h = (item->>''distributor_dim_h'')::numeric,');
 EXECUTE definition;
END $$;
CREATE OR REPLACE FUNCTION public.admin_save_scoped_commissions(_buyer_type text, _customer_role text, _rows jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE item jsonb; config_key text;
BEGIN
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
 IF _buyer_type NOT IN ('customer','retailer','distributor') OR _customer_role NOT IN ('customer','retailer','distributor','staff','admin') THEN RAISE EXCEPTION 'Invalid commission scope'; END IF;
 config_key := _buyer_type || ':' || CASE WHEN _buyer_type='customer' THEN _customer_role ELSE _buyer_type END;
 FOR item IN SELECT value FROM jsonb_array_elements(_rows) LOOP
 IF (item->>'commission_value')::numeric < 0 OR ((item->>'commission_kind')='percentage' AND (item->>'commission_value')::numeric > 100) OR (item->>'max_commission')::numeric < 0 THEN RAISE EXCEPTION 'Invalid commission value'; END IF;
 IF config_key='customer:customer' THEN
 INSERT INTO public.variant_program_commissions(variant_id,program_id,commission_kind,commission_value,max_commission,is_active) VALUES ((item->>'variant_id')::uuid,(item->>'program_id')::uuid,(item->>'commission_kind')::public.commission_kind,(item->>'commission_value')::numeric,(item->>'max_commission')::numeric,(item->>'is_active')::boolean) ON CONFLICT(variant_id,program_id) DO UPDATE SET commission_kind=excluded.commission_kind,commission_value=excluded.commission_value,max_commission=excluded.max_commission,is_active=excluded.is_active;
 ELSE
 INSERT INTO public.variant_program_commissions(variant_id,program_id,commission_kind,commission_value,is_active,scoped_rules) VALUES ((item->>'variant_id')::uuid,(item->>'program_id')::uuid,'percentage',0,false,jsonb_build_object(config_key,item)) ON CONFLICT(variant_id,program_id) DO UPDATE SET scoped_rules=public.variant_program_commissions.scoped_rules || excluded.scoped_rules;
 END IF;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.admin_save_scoped_commissions(text,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_save_scoped_commissions(text,text,jsonb) TO authenticated,service_role;
NOTIFY pgrst,'reload schema';