DROP TRIGGER IF EXISTS product_variants_refresh_family ON public.product_variants;
CREATE TRIGGER product_variants_refresh_family_ins_del
  AFTER INSERT OR DELETE ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.trg_refresh_product_family();
CREATE TRIGGER product_variants_refresh_family_upd
  AFTER UPDATE ON public.product_variants
  FOR EACH ROW
  WHEN (
    OLD.family_id IS DISTINCT FROM NEW.family_id OR OLD.sku IS DISTINCT FROM NEW.sku
    OR OLD.price IS DISTINCT FROM NEW.price OR OLD.mrp IS DISTINCT FROM NEW.mrp
    OR OLD.stock IS DISTINCT FROM NEW.stock OR OLD.is_active IS DISTINCT FROM NEW.is_active
    OR OLD.archived_at IS DISTINCT FROM NEW.archived_at OR OLD.weight_g IS DISTINCT FROM NEW.weight_g
    OR OLD.dim_l IS DISTINCT FROM NEW.dim_l OR OLD.dim_w IS DISTINCT FROM NEW.dim_w
    OR OLD.dim_h IS DISTINCT FROM NEW.dim_h
  )
  EXECUTE FUNCTION public.trg_refresh_product_family();