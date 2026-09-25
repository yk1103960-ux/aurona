BEGIN;

-- Complete the buyer-channel columns expected by the current Product Master,
-- variation editor, storefront filtering and checkout. Every statement is
-- idempotent so this safely complements partially-applied older migrations.
ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS retailer_mrp numeric CHECK (retailer_mrp IS NULL OR retailer_mrp >= 0),
  ADD COLUMN IF NOT EXISTS distributor_mrp numeric CHECK (distributor_mrp IS NULL OR distributor_mrp >= 0),
  ADD COLUMN IF NOT EXISTS retailer_discount_pct numeric CHECK (retailer_discount_pct IS NULL OR retailer_discount_pct BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS distributor_discount_pct numeric CHECK (distributor_discount_pct IS NULL OR distributor_discount_pct BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS retailer_stock integer NOT NULL DEFAULT 0 CHECK (retailer_stock >= 0),
  ADD COLUMN IF NOT EXISTS distributor_stock integer NOT NULL DEFAULT 0 CHECK (distributor_stock >= 0),
  ADD COLUMN IF NOT EXISTS retailer_reserved_stock integer NOT NULL DEFAULT 0 CHECK (retailer_reserved_stock >= 0),
  ADD COLUMN IF NOT EXISTS distributor_reserved_stock integer NOT NULL DEFAULT 0 CHECK (distributor_reserved_stock >= 0),
  ADD COLUMN IF NOT EXISTS retailer_pack_size integer CHECK (retailer_pack_size IS NULL OR retailer_pack_size > 0),
  ADD COLUMN IF NOT EXISTS distributor_pack_size integer CHECK (distributor_pack_size IS NULL OR distributor_pack_size > 0),
  ADD COLUMN IF NOT EXISTS available_customer boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS available_retailer boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS available_distributor boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.admin_set_variant_segments(
  _family_id uuid,
  _segments jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  segment jsonb;
BEGIN
  FOR segment IN SELECT value FROM jsonb_array_elements(COALESCE(_segments, '[]'::jsonb)) LOOP
    UPDATE public.product_variants
       SET available_customer = COALESCE((segment->>'available_customer')::boolean, true),
           available_retailer = COALESCE((segment->>'available_retailer')::boolean, true),
           available_distributor = COALESCE((segment->>'available_distributor')::boolean, true),
           updated_at = now()
     WHERE family_id = _family_id
       AND upper(sku) = upper(btrim(segment->>'sku'));
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_variant_segments(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_variant_segments(uuid, jsonb) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
