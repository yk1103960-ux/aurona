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
    queryFn: async () => {
      let q = supabase.from("products").select("*, categories(slug, name, icon)");
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
      return (data ?? []) as (Product & { categories: { slug: string; name: string; icon: string | null } | null })[];
    },
  });

export const productQuery = (slug: string) =>
  queryOptions({
    queryKey: ["product", slug],
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
