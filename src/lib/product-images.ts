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
        console.error(error);
        return [];
      }

      return (data ?? []) as ProductImageRow[];
    },
  });

export const compareProductImagesQuery = (productIds: string[], familyIds: string[]) =>
  queryOptions({
    queryKey: ["compare-product-images", [...productIds].sort().join(","), [...familyIds].sort().join(",")],

    enabled: productIds.length > 0 || familyIds.length > 0,

    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,

    queryFn: async (): Promise<ProductImageRow[]> => {
      const results: ProductImageRow[] = [];

      if (productIds.length > 0) {
        const { data, error } = await supabase
          .from("product_images")
          .select("*")
          .in("product_id", productIds)
          .order("is_primary", { ascending: false })
          .order("sort_order", { ascending: true });

        if (!error && data) {
          results.push(...(data as ProductImageRow[]));
        }
      }

      if (familyIds.length > 0) {
        const { data, error } = await supabase
          .from("product_images")
          .select("*")
          .in("family_id", familyIds)
          .order("is_primary", { ascending: false })
          .order("sort_order", { ascending: true });

        if (!error && data) {
          results.push(...(data as ProductImageRow[]));
        }
      }

      return results.filter((image, index, array) => array.findIndex((item) => item.id === image.id) === index);
    },
  });

export function resolveProductImage(
  images: ProductImageRow[],
  product: {
    id: string;
    family_id?: string | null;
    sku?: string | null;
  },
) {
  const variantImage = images.find((image) => image.variant_sku && product.sku && image.variant_sku === product.sku);

  if (variantImage) return variantImage.image_url;

  const primaryProductImage = images.find((image) => image.product_id === product.id && image.is_primary);

  if (primaryProductImage) {
    return primaryProductImage.image_url;
  }

  const productImage = images.find((image) => image.product_id === product.id);

  if (productImage) {
    return productImage.image_url;
  }

  const primaryFamilyImage = images.find(
    (image) => product.family_id && image.family_id === product.family_id && image.is_primary,
  );

  if (primaryFamilyImage) {
    return primaryFamilyImage.image_url;
  }

  const familyImage = images.find((image) => product.family_id && image.family_id === product.family_id);

  return familyImage?.image_url ?? null;
}
