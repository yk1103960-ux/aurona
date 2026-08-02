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
  price_from?: boolean;
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

export type ProductRow = Product & { categories: { slug: string; name: string; icon: string | null } | null };
export type ProductsPage = { rows: ProductRow[]; total: number };

export type ProductsPageFilter = {
  categorySlug?: string;
  categoryIds?: string[];
  search?: string;
  min?: number;
  max?: number;
  sort?: "newest" | "price-asc" | "price-desc" | "rating";
  page: number;
  perPage: number;
};

export const productsPageQuery = (filter: ProductsPageFilter) =>
  queryOptions({
    queryKey: ["families-page", filter],
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    queryFn: async (): Promise<ProductsPage> => {
      const sel = (s: string): string => s;
      const cols = sel(
        "id, slug, main_sku, name, category_id, brand, short_description, min_price, max_price, min_mrp, max_mrp, total_stock, rating, review_count, is_featured, is_bestseller, is_new, is_sale, image_seed, categories(slug, name, icon)",
      );

      let categoryIds = filter.categoryIds;
      if (filter.categorySlug) {
        const { data: cat } = await supabase
          .from("categories")
          .select("id")
          .eq("slug", filter.categorySlug)
          .maybeSingle();
        if (!cat?.id) return { rows: [], total: 0 };
        categoryIds = [cat.id];
      }

      let q = supabase.from("product_families").select(cols, { count: "exact" }).gt("min_price", 0);
      if (categoryIds && categoryIds.length > 0) q = q.in("category_id", categoryIds);
      if (filter.search) q = q.ilike("name", `%${filter.search}%`);
      if (filter.min && filter.min > 0) q = q.gte("min_price", filter.min);
      if (filter.max && filter.max > 0) q = q.lte("max_price", filter.max);

      if (filter.sort === "price-asc") q = q.order("min_price", { ascending: true });
      else if (filter.sort === "price-desc") q = q.order("max_price", { ascending: false });
      else if (filter.sort === "rating") q = q.order("rating", { ascending: false });
      else q = q.order("created_at", { ascending: false });

      const from = (filter.page - 1) * filter.perPage;
      const to = from + filter.perPage - 1;
      q = q.range(from, to);

      const { data, error, count } = await q;
      if (error) throw error;
      type FamRow = {
        id: string; slug: string; main_sku: string; name: string; category_id: string | null;
        brand: string; short_description: string | null;
        min_price: number | null; max_price: number | null; min_mrp: number | null; max_mrp: number | null;
        total_stock: number; rating: number; review_count: number;
        is_featured: boolean; is_bestseller: boolean; is_new: boolean; is_sale: boolean;
        image_seed: string | null;
        categories: { slug: string; name: string; icon: string | null } | null;
      };
      const fams = (data ?? []) as unknown as FamRow[];
      const rows: ProductRow[] = fams.map((f) => ({
        id: f.id,
        slug: f.slug,
        sku: f.main_sku,
        name: f.name,
        category_id: f.category_id,
        brand: f.brand,
        short_description: f.short_description,
        description: null,
        mrp: Number(f.min_mrp ?? f.min_price ?? 0),
        price: Number(f.min_price ?? 0),
        unit: "unit",
        stock: f.total_stock,
        rating: Number(f.rating ?? 0),
        review_count: f.review_count ?? 0,
        wattage: null, size: null, color_temp: null, material: null, warranty: null,
        is_featured: f.is_featured, is_bestseller: f.is_bestseller, is_new: f.is_new, is_sale: f.is_sale,
        image_seed: f.image_seed,
        categories: f.categories,
        family_slug: f.slug,
        price_from: (f.min_price ?? 0) !== (f.max_price ?? 0),
      }));
      return { rows, total: count ?? rows.length };
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

const VARIANT_COLS = "id, family_id, sku, attributes, mrp, price, discount_pct, moq, stock, weight_g, pack_size, pack_weight_g, dim_l, dim_w, dim_h, pack_l, pack_w, pack_h, image_seed, sort_order, created_at";

export const familyQuery = (slug: string) =>
  queryOptions({
    queryKey: ["family", slug],
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    queryFn: async (): Promise<ProductFamily | null> => {
      const { data, error } = await supabase
        .from("product_families")
        .select(
          `*, categories(slug, name, icon), variants:product_variants(${VARIANT_COLS}), axes:product_variant_axes(axis_key, label, values, sort_order)`,
        )
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const f = data as unknown as ProductFamily;
      f.variants = [...(f.variants ?? [])].sort((a, b) => a.sort_order - b.sort_order);
      f.axes = [...(f.axes ?? [])].sort((a, b) => a.sort_order - b.sort_order);
      return f;
    },
  });

export const familyProductsQuery = (skus: string[]) =>
  queryOptions({
    queryKey: ["family-products", [...skus].sort().join(",")],
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    enabled: skus.length > 0,
    queryFn: async (): Promise<Record<string, { id: string; slug: string }>> => {
      if (skus.length === 0) return {};
      const { data } = await supabase.from("products").select("id, sku, slug").in("sku", skus);
      const map: Record<string, { id: string; slug: string }> = {};
      for (const r of (data ?? []) as { id: string; sku: string; slug: string }[]) {
        map[r.sku] = { id: r.id, slug: r.slug };
      }
      return map;
    },
  });

// Lightweight product list for Browse Categories flyout (name, slug, image, family)
export type BrowseProduct = {
  slug: string;
  name: string;
  sku: string;
  image_seed: string | null;
  family_slug: string | null;
  price: number | null;
  mrp: number | null;
  wattage: string | null;
  stock: number | null;
};

export const browseProductsByCategoryQuery = (categorySlug: string) =>
  queryOptions({
    queryKey: ["browse-products", categorySlug],
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    enabled: !!categorySlug,
    queryFn: async (): Promise<BrowseProduct[]> => {
      if (!categorySlug) return [];
      const { data: cat } = await supabase
        .from("categories")
        .select("id")
        .eq("slug", categorySlug)
        .maybeSingle();
      if (!cat?.id) return [];
      const { data } = await supabase
        .from("products")
        .select("slug, sku, name, image_seed, price, mrp, wattage, stock")
        .eq("category_id", cat.id)
        .gt("price", 0)
        .order("is_bestseller", { ascending: false })
        .order("name")
        .limit(24);
      const rows = (data ?? []) as {
        slug: string; sku: string; name: string; image_seed: string | null;
        price: number | null; mrp: number | null; wattage: string | null; stock: number | null;
      }[];

      const skus = rows.map((r) => r.sku).filter(Boolean);
      const familyBySku = new Map<string, string>();
      if (skus.length) {
        const { data: links } = await supabase
          .from("product_variants")
          .select("sku, product_families(slug)")
          .in("sku", skus);
        for (const link of (links ?? []) as unknown as { sku: string; product_families?: { slug: string } | null }[]) {
          if (link.product_families?.slug) familyBySku.set(link.sku, link.product_families.slug);
        }
      }
      // De-dup by family (one entry per family), keep singles as-is
      const seen = new Set<string>();
      const out: BrowseProduct[] = [];
      for (const r of rows) {
        const fam = familyBySku.get(r.sku) ?? null;
        const key = fam ?? r.slug;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({
          slug: r.slug, name: r.name, sku: r.sku, image_seed: r.image_seed, family_slug: fam,
          price: r.price ?? null, mrp: r.mrp ?? null, wattage: r.wattage ?? null, stock: r.stock ?? null,
        });
      }
      return out.slice(0, 18);
    },
  });

// Live search suggestions for the header search bar
export type SearchSuggestion = {
  slug: string;
  name: string;
  sku: string;
  image_seed: string | null;
  price: number | null;
  mrp: number | null;
  wattage: string | null;
};

export const searchSuggestQuery = (term: string) =>
  queryOptions({
    queryKey: ["search-suggest", term.trim().toLowerCase()],
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled: term.trim().length >= 2,
    queryFn: async (): Promise<SearchSuggestion[]> => {
      const t = term.trim();
      if (t.length < 2) return [];
      const like = `%${t.replace(/[%_]/g, "")}%`;
      const cols = "slug, main_sku, name, image_seed, min_price, min_mrp, category_id";
      type Row = {
        slug: string; main_sku: string; name: string; image_seed: string | null;
        min_price: number | null; min_mrp: number | null; category_id: string | null;
      };

      const [direct, catMatch] = await Promise.all([
        supabase
          .from("product_families")
          .select(cols)
          .or(`name.ilike.${like},main_sku.ilike.${like}`)
          .order("is_bestseller", { ascending: false })
          .limit(8),
        supabase.from("categories").select("id, name").ilike("name", like).limit(3),
      ]);

      const rows: Row[] = (direct.data ?? []) as Row[];
      const catIds = (catMatch.data ?? []).map((c) => c.id);
      if (rows.length < 8 && catIds.length) {
        const { data } = await supabase
          .from("product_families")
          .select(cols)
          .in("category_id", catIds)
          .order("is_bestseller", { ascending: false })
          .limit(8 - rows.length);
        for (const r of (data ?? []) as Row[]) {
          if (!rows.some((x) => x.slug === r.slug)) rows.push(r);
        }
      }

      return rows.slice(0, 8).map((r) => ({
        slug: r.slug,
        name: r.name,
        sku: r.main_sku,
        image_seed: r.image_seed,
        price: r.min_price === null ? null : Number(r.min_price),
        mrp: r.min_mrp === null ? null : Number(r.min_mrp),
        wattage: null,
      }));
    },

  });

