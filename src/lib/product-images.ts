import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ProductImageRow = {
  id: string;
  product_id: string | null;
  family_id: string | null;
  variant_sku: string | null;
  image_url: string;
  alt_text: string | null;
  sort_order: number;
  is_primary: boolean;
};

export const productImagesQuery = (opts: { familyId?: string | null; productId?: string | null }) =>
  queryOptions({
    queryKey: ["product-images", opts.familyId ?? null, opts.productId ?? null],
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    enabled: Boolean(opts.familyId || opts.productId),
    queryFn: async (): Promise<ProductImageRow[]> => {
      let q = supabase.from("product_images").select("*").order("sort_order");
      if (opts.familyId) q = q.eq("family_id", opts.familyId);
      else if (opts.productId) q = q.eq("product_id", opts.productId);
      const { data, error } = await q;
      if (error) return [];
      return (data ?? []) as ProductImageRow[];
    },
  });
