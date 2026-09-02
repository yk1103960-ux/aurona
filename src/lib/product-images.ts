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
 * Existing single product/family image query.
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
        console.error("Could not load product images:", error);
        return [];
      }

      return (data ?? []) as ProductImageRow[];
    },
  });

/**
 * Loads images for every product currently on the compare page.
 * Supports product images AND family images.
 */
export const compareProductImagesQuery = (productIds: string[], familyIds: string[]) =>
  queryOptions({
    queryKey: ["compare-product-images", [...productIds].sort().join(","), [...familyIds].sort().join(",")],

    enabled: productIds.length > 0 || familyIds.length > 0,

    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,

    queryFn: async (): Promise<ProductImageRow[]> => {
      const results: ProductImageRow[] = [];

      // Load images connected directly to products
      if (productIds.length > 0) {
        const { data, error } = await supabase
          .from("product_images")
          .select("*")
          .in("product_id", productIds)
          .order("is_primary", { ascending: false })
          .order("sort_order", { ascending: true });

        if (error) {
          console.error("Could not load compare product images:", error);
        } else if (data) {
          results.push(...(data as ProductImageRow[]));
        }
      }

      // Load images connected to product families
      if (familyIds.length > 0) {
        const { data, error } = await supabase
          .from("product_images")
          .select("*")
          .in("family_id", familyIds)
          .order("is_primary", { ascending: false })
          .order("sort_order", { ascending: true });

        if (error) {
          console.error("Could not load compare family images:", error);
        } else if (data) {
          results.push(...(data as ProductImageRow[]));
        }
      }

      // Remove duplicates
      return results.filter((image, index, array) => array.findIndex((item) => item.id === image.id) === index);
    },
  });

/**
 * Chooses the best available image for a product.
 *
 * Priority:
 * 1. Exact variant SKU image
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
  // Exact variant image
  const variantImage = images.find(
    (image) => Boolean(image.variant_sku) && Boolean(product.sku) && image.variant_sku === product.sku,
  );

  if (variantImage?.image_url) {
    return variantImage.image_url;
  }

  // Primary image attached directly to product
  const primaryProductImage = images.find(
    (image) => image.product_id === product.id && image.is_primary && Boolean(image.image_url),
  );

  if (primaryProductImage?.image_url) {
    return primaryProductImage.image_url;
  }

  // Any image attached directly to product
  const productImage = images.find((image) => image.product_id === product.id && Boolean(image.image_url));

  if (productImage?.image_url) {
    return productImage.image_url;
  }

  // Primary family image
  const primaryFamilyImage = images.find(
    (image) =>
      Boolean(product.family_id) &&
      image.family_id === product.family_id &&
      image.is_primary &&
      Boolean(image.image_url),
  );

  if (primaryFamilyImage?.image_url) {
    return primaryFamilyImage.image_url;
  }

  // Any family image
  const familyImage = images.find(
    (image) => Boolean(product.family_id) && image.family_id === product.family_id && Boolean(image.image_url),
  );

  return familyImage?.image_url ?? null;
}
