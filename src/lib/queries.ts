import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Product = {
  id: string;
  slug: string;
  sku: string;
  name: string;
  category_id: string | null;
  brand: string;
  short_description: string | null;
  description: string | null;
  mrp: number;
  price: number;
  unit: string;
  stock: number;
  rating: number;
  review_count: number;
  wattage: string | null;
  size: string | null;
  color_temp: string | null;
  material: string | null;
  warranty: string | null;
  is_featured: boolean;
  is_bestseller: boolean;
  is_new: boolean;
  is_sale: boolean;
  image_seed: string | null;
  family_slug?: string | null;
  variations?: { sku: string; attrs: string[]; mrp: number | null; price: number | null }[] | null;
};

export type Category = {
  id: string;
  slug: string;
  name: string;
  parent_group: string;
  icon: string | null;
  sort_order: number;
};

export const categoriesQuery = queryOptions({
  queryKey: ["categories"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("sort_order");
    if (error) throw error;
    return (data ?? []) as Category[];
  },
});

export const categoryCountsQuery = queryOptions({
  queryKey: ["category-counts"],
  queryFn: async () => {
    const { data, error } = await supabase.from("products").select("category_id");
    if (error) throw error;
    const map: Record<string, number> = {};
    for (const row of data ?? []) {
      const id = (row as { category_id: string | null }).category_id;
      if (!id) continue;
      map[id] = (map[id] ?? 0) + 1;
    }
    return map;
  },
});

export const productsQuery = (filter?: {
  categorySlug?: string;
  featured?: boolean;
  bestseller?: boolean;
  isNew?: boolean;
  sale?: boolean;
  search?: string;
  limit?: number;
}) =>
  queryOptions({
    queryKey: ["products", filter ?? {}],
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    queryFn: async () => {
      const sel = (s: string): string => s;
      const cols = sel(
        "id, slug, sku, name, category_id, brand, short_description, mrp, price, unit, stock, rating, review_count, is_featured, is_bestseller, is_new, is_sale, image_seed, categories(slug, name, icon)",
      );
      let q = supabase.from("products").select(cols);
      if (filter?.categorySlug) {
        const { data: cat } = await supabase
          .from("categories")
          .select("id")
          .eq("slug", filter.categorySlug)
          .maybeSingle();
        if (cat?.id) q = q.eq("category_id", cat.id);
        else return [];
      }
      if (filter?.featured) q = q.eq("is_featured", true);
      if (filter?.bestseller) q = q.eq("is_bestseller", true);
      if (filter?.isNew) q = q.eq("is_new", true);
      if (filter?.sale) q = q.eq("is_sale", true);
      if (filter?.search) q = q.ilike("name", `%${filter.search}%`);
      if (filter?.limit) q = q.limit(filter.limit);
      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as unknown as (Product & { categories: { slug: string; name: string; icon: string | null } | null })[];
      const skus = [...new Set(rows.map((row) => row.sku).filter(Boolean))];
      if (skus.length === 0) return rows;

      const { data: links } = await supabase
        .from("product_variants")
        .select(sel("sku, product_families(slug)"))
        .in("sku", skus);
      const familyBySku = new Map<string, string>();
      for (const link of (links ?? []) as unknown as { sku: string; product_families?: { slug: string } | null }[]) {
        if (link.product_families?.slug) familyBySku.set(link.sku, link.product_families.slug);
      }

      return rows.map((row) => ({ ...row, family_slug: familyBySku.get(row.sku) ?? null }));
    },
  });

export const productQuery = (slug: string) =>
  queryOptions({
    queryKey: ["product", slug],
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, categories(slug, name, icon)")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data as (Product & { categories: { slug: string; name: string; icon: string | null } | null }) | null;
    },
  });

export type VariantAxis = { axis_key: string; label: string; values: string[]; sort_order: number };
export type ProductVariant = {
  id: string;
  family_id: string;
  sku: string;
  attributes: Record<string, string>;
  mrp: number;
  price: number;
  discount_pct: number | null;
  retailer_price: number | null;
  distributor_price: number | null;
  moq: number;
  stock: number;
  weight_g: number | null;
  pack_size: number | null;
  dim_l: number | null; dim_w: number | null; dim_h: number | null;
  pack_l: number | null; pack_w: number | null; pack_h: number | null;
  image_seed: string | null;
  sort_order: number;
  product_id?: string | null;
  product_slug?: string | null;
};
export type ProductFamily = {
  id: string;
  slug: string;
  main_sku: string;
  name: string;
  category_id: string | null;
  brand: string;
  short_description: string | null;
  description: string | null;
  image_seed: string | null;
  is_featured: boolean;
  is_bestseller: boolean;
  is_new: boolean;
  is_sale: boolean;
  min_price: number | null;
  max_price: number | null;
  min_mrp: number | null;
  max_mrp: number | null;
  total_stock: number;
  rating: number;
  review_count: number;
  warranty: string | null;
  material: string | null;
  categories: { slug: string; name: string; icon: string | null } | null;
  variants: ProductVariant[];
  axes: VariantAxis[];
};

export const familyQuery = (slug: string) =>
  queryOptions({
    queryKey: ["family", slug],
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    queryFn: async (): Promise<ProductFamily | null> => {
      const { data, error } = await supabase
        .from("product_families")
        .select(
          "*, categories(slug, name, icon), variants:product_variants(*), axes:product_variant_axes(axis_key, label, values, sort_order)",
        )
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const f = data as unknown as ProductFamily;
      f.variants = [...(f.variants ?? [])].sort((a, b) => a.sort_order - b.sort_order);
      f.axes = [...(f.axes ?? [])].sort((a, b) => a.sort_order - b.sort_order);
      const skus = [...new Set(f.variants.map((variant) => variant.sku).filter(Boolean))];
      if (skus.length > 0) {
        const { data: products } = await supabase.from("products").select("id, sku, slug").in("sku", skus);
        const productBySku = new Map(
          ((products ?? []) as { id: string; sku: string; slug: string }[]).map((product) => [product.sku, product]),
        );
        f.variants = f.variants.map((variant) => {
          const product = productBySku.get(variant.sku);
          return { ...variant, product_id: product?.id ?? null, product_slug: product?.slug ?? null };
        });
      }
      return f;
    },
  });
