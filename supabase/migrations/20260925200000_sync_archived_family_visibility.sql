-- Keep authoritative product-family visibility aligned with legacy storefront rows.
-- This backfills already archived families and protects future state changes.

UPDATE public.products p
SET is_published = false,
    archived_at = f.archived_at
FROM public.product_families f
WHERE f.archived_at IS NOT NULL
  AND (
    p.id = f.legacy_product_id
    OR EXISTS (
      SELECT 1
      FROM public.product_variants v
      WHERE v.family_id = f.id AND v.sku = p.sku
    )
  );

CREATE OR REPLACE FUNCTION public.sync_family_visibility_to_legacy_products()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.products p
     SET is_published = NEW.is_published AND NEW.archived_at IS NULL,
         archived_at = NEW.archived_at
   WHERE p.id = NEW.legacy_product_id
      OR EXISTS (
        SELECT 1
        FROM public.product_variants v
        WHERE v.family_id = NEW.id AND v.sku = p.sku
      );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_family_visibility_to_legacy_products_trigger
  ON public.product_families;
CREATE TRIGGER sync_family_visibility_to_legacy_products_trigger
AFTER INSERT OR UPDATE OF is_published, archived_at
ON public.product_families
FOR EACH ROW
EXECUTE FUNCTION public.sync_family_visibility_to_legacy_products();
