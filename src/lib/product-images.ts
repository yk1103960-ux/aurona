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

      // 1. Images attached directly to product
      if (productIds.length > 0) {
        const { data } = await supabase
          .from("product_images")
          .select("*")
          .in("product_id", productIds)
          .order("is_primary", { ascending: false })
          .order("sort_order", { ascending: true });

        if (data) {
          results.push(...(data as ProductImageRow[]));
        }
      }

      // 2. Images attached to family
      if (familyIds.length > 0) {
        const { data } = await supabase
          .from("product_images")
          .select("*")
          .in("family_id", familyIds)
          .order("is_primary", { ascending: false })
          .order("sort_order", { ascending: true });

        if (data) {
          results.push(...(data as ProductImageRow[]));
        }
      }

      // 3. Images attached to exact variant/SKU
      if (skus.length > 0) {
        const { data } = await supabase
          .from("product_images")
          .select("*")
          .in("variant_sku", skus)
          .order("is_primary", { ascending: false })
          .order("sort_order", { ascending: true });

        if (data) {
          results.push(...(data as ProductImageRow[]));
        }
      }

      return results.filter((image, index, array) => array.findIndex((item) => item.id === image.id) === index);
    },
  });
