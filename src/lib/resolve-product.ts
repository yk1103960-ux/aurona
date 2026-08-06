import { supabase } from "@/integrations/supabase/client";

/**
 * Listing grids are built from `product_families`, whose ids do NOT exist in
 * `products` — inserting them into cart_items/wishlist_items violates the
 * product_id foreign key. This resolves any id-or-SKU pair to a real
 * products.id before writing.
 */
export async function resolveProductId(idOrSku: string, sku?: string | null): Promise<string> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSku);

  if (isUuid) {
    const { data } = await supabase.from("products").select("id").eq("id", idOrSku).maybeSingle();
    if (data?.id) return data.id;
  }

  const candidates = [sku, isUuid ? null : idOrSku].filter(Boolean) as string[];
  for (const candidate of candidates) {
    const { data } = await supabase.from("products").select("id").eq("sku", candidate).maybeSingle();
    if (data?.id) return data.id;
  }

  // Family id → resolve through its variants (main variant first).
  if (isUuid) {
    const { data: variants } = await supabase
      .from("product_variants")
      .select("sku")
      .eq("family_id", idOrSku)
      .order("sort_order", { ascending: true })
      .limit(20);
    for (const v of variants ?? []) {
      const { data } = await supabase.from("products").select("id").eq("sku", v.sku).maybeSingle();
      if (data?.id) return data.id;
    }
  }

  throw new Error("This product is currently unavailable");
}
