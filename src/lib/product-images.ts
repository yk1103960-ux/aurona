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

/**
 * Existing single-product / family image query.
 * Kept compatible with the rest of the website.
 */
export const productImagesQuery = (opts: { familyId?: string | null; productId?: string | null }) =>
  queryOptions({
    queryKey: ["product-images", opts.familyId ?? null, opts.productId ?? null],

    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,

    enabled: Boolean(opts.familyId || opts.productId),

    queryFn: async (): Promise<ProductImageRow[]> => {
      let q = supabase
        .from("product_images")
        .select("*")
        .order("is_primary", { ascending: false })
        .order("sort_order", { ascending: true });

      if (opts.familyId) {
        q = q.eq("family_id", opts.familyId);
      } else if (opts.productId) {
        q = q.eq("product_id", opts.productId);
      }

      const { data, error } = await q;

      if (error) {
        console.error("Failed to load product images:", error);
        return [];
      }

      return (data ?? []) as ProductImageRow[];
    },
  });

/**
 * Used by the compare page.
 * Loads images for several products in one request.
 */
export const compareProductImagesQuery = (productIds: string[]) =>
  queryOptions({
    queryKey: ["compare-product-images", [...productIds].sort().join(",")],

    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,

    enabled: productIds.length > 0,

    queryFn: async (): Promise<ProductImageRow[]> => {
      if (!productIds.length) return [];

      const { data, error } = await supabase
        .from("product_images")
        .select("*")
        .in("product_id", productIds)
        .order("is_primary", { ascending: false })
        .order("sort_order", { ascending: true });

      if (error) {
        console.error("Failed to load compare product images:", error);

        return [];
      }

      return (data ?? []) as ProductImageRow[];
    },
  });

/**
 * Finds the best available image for a product.
 *
 * Priority:
 * 1. Exact variant SKU
 * 2. Primary product image
 * 3. Any product image
 * 4. Primary family image
 * 5. Any family image
 */
export function resolveProductImage(
  images: ProductImageRow[],
  product: {
    id: string;
    family_id?: string | null;
    sku?: string | null;
  },
): string | null {
  const variantImage = images.find((image) => image.variant_sku && product.sku && image.variant_sku === product.sku);

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
