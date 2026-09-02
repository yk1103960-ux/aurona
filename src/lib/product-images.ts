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
      let q = supabase.from("product_images").select("*").order("sort_order", { ascending: true });

      if (opts.familyId) {
        q = q.eq("family_id", opts.familyId);
      } else if (opts.productId) {
        q = q.eq("product_id", opts.productId);
      }

      const { data, error } = await q;

      if (error) {
        console.error("Product images error:", error);
        return [];
      }

      return (data ?? []) as ProductImageRow[];
    },
  });

export const compareProductImagesQuery = (productIds: string[], familyIds: string[], skus: string[]) =>
  queryOptions({
    queryKey: [
      "compare-product-images",
      [...productIds].sort().join(","),
      [...familyIds].sort().join(","),
      [...skus].sort().join(","),
    ],

    enabled: productIds.length > 0 || familyIds.length > 0 || skus.length > 0,

    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,

    queryFn: async (): Promise<ProductImageRow[]> => {
      const results: ProductImageRow[] = [];

      if (productIds.length > 0) {
        const { data, error } = await supabase
          .from("product_images")
          .select("*")
          .in("product_id", productIds)
          .order("sort_order", { ascending: true });

        if (error) {
          console.error("Compare product image error:", error);
        }

        if (data) {
          results.push(...(data as ProductImageRow[]));
        }
      }

      if (familyIds.length > 0) {
        const { data, error } = await supabase
          .from("product_images")
          .select("*")
          .in("family_id", familyIds)
          .order("sort_order", { ascending: true });

        if (error) {
          console.error("Compare family image error:", error);
        }

        if (data) {
          results.push(...(data as ProductImageRow[]));
        }
      }

      if (skus.length > 0) {
        const { data, error } = await supabase
          .from("product_images")
          .select("*")
          .in("variant_sku", skus)
          .order("sort_order", { ascending: true });

        if (error) {
          console.error("Compare SKU image error:", error);
        }

        if (data) {
          results.push(...(data as ProductImageRow[]));
        }
      }

      return Array.from(new Map(results.map((image) => [image.id, image])).values());
    },
  });

export function resolveProductImage(
  images: ProductImageRow[],
  product: {
    id: string;
    sku?: string | null;
    family_id?: string | null;
  },
): string | null {
  const variantImage = images.find((image) => Boolean(product.sku) && image.variant_sku === product.sku);

  if (variantImage?.image_url) {
    return variantImage.image_url;
  }

  const primaryProductImage = images.find((image) => image.product_id === product.id && image.is_primary);

  if (primaryProductImage?.image_url) {
    return primaryProductImage.image_url;
  }

  const productImage = images.find((image) => image.product_id === product.id);

  if (productImage?.image_url) {
    return productImage.image_url;
  }

  if (product.family_id) {
    const primaryFamilyImage = images.find((image) => image.family_id === product.family_id && image.is_primary);

    if (primaryFamilyImage?.image_url) {
      return primaryFamilyImage.image_url;
    }

    const familyImage = images.find((image) => image.family_id === product.family_id);

    if (familyImage?.image_url) {
      return familyImage.image_url;
    }
  }

  return null;
}
