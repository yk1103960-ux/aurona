CREATE OR REPLACE FUNCTION public.hide_products_for_deleted_family()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE public.products SET is_published = false, archived_at = COALESCE(archived_at, now())
   WHERE sku = OLD.sku;
  RETURN OLD;
END; $$;
REVOKE EXECUTE ON FUNCTION public.hide_products_for_deleted_family() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_hide_products_for_deleted_variant ON public.product_variants;
CREATE TRIGGER trg_hide_products_for_deleted_variant
AFTER DELETE ON public.product_variants
FOR EACH ROW EXECUTE FUNCTION public.hide_products_for_deleted_family();