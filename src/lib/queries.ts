import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { actualAxes } from "@/lib/variant-options";

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
  color?: string | null;
  finish?: string | null;
  material: string | null;
  warranty: string | null;
  is_featured: boolean;
  is_bestseller: boolean;
  is_new: boolean;
  is_sale: boolean;
  image_seed: string | null;
  image_url?: string | null;
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

/**
 * Primary image lookup. Images live in `product_images` (there is no
 * `image_url` column on `products`/`product_families`/`product_variants`),
 * so resolve them in a second, non-fatal query.
 */
async function primaryImages(
  key: "product_id" | "family_id" | "variant_sku",
  ids: string[],
): Promise<Record<string, string>> {
  const list = [...new Set(ids.filter(Boolean))];
  if (list.length === 0) return {};
  const { data, error } = await supabase
    .from("product_images")
    .select(`${key}, image_url, is_primary, sort_order`)
    .in(key, list);
  if (error) return {};
  const rows = (data ?? []) as unknown as {
    image_url: string | null;
    is_primary: boolean | null;
    sort_order: number | null;
    [k: string]: unknown;
  }[];
  const map: Record<string, { url: string; score: number }> = {};
  for (const r of rows) {
    const id = r[key] as string | null;
    if (!id || !r.image_url) continue;
    const score = (r.is_primary ? -1000 : 0) + (Number(r.sort_order) || 0);
    const cur = map[id];
    if (!cur || score < cur.score) map[id] = { url: r.image_url, score };
  }
  const out: Record<string, string> = {};
  for (const [id, v] of Object.entries(map)) out[id] = v.url;
  return out;
}

/**
 * Attach primary photos to plain `products` rows (cart, checkout, order lines).
 * Falls back to the product family photo when the product itself has none.
 */
export async function attachProductImages<T extends { id: string; sku?: string | null }>(
  rows: T[],
): Promise<(T & { image_url: string | null })[]> {
  if (rows.length === 0) return [];
  const imgs = await primaryImages("product_id", rows.map((r) => r.id));
  const missing = rows.filter((r) => !imgs[r.id] && r.sku);
  const famBySku = new Map<string, string>();
  if (missing.length > 0) {
    const { data } = await supabase
      .from("public_product_variants")
      .select("sku, family_id")
      .in("sku", missing.map((r) => r.sku as string));
    for (const link of (data ?? []) as unknown as { sku: string; family_id: string | null }[]) {
      if (link.family_id) famBySku.set(link.sku, link.family_id);
    }
  }
  const famImgs = await primaryImages("family_id", [...famBySku.values()]);
  return rows.map((r) => {
    const famId = r.sku ? famBySku.get(r.sku) : undefined;
    return { ...r, image_url: imgs[r.id] ?? (famId ? famImgs[famId] ?? null : null) };
  });
}

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
        "id, slug, sku, name, category_id, brand, short_description, mrp, price, unit, stock, rating, review_count, is_featured, is_bestseller, is_new, is_sale, image_seed, wattage, size, categories(slug, name, icon)",
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
      if (filter?.search) {
        const like = `%${filter.search.trim().replace(/[%,()]/g, " ")}%`;
        q = q.or(`name.ilike.${like},sku.ilike.${like}`);
      }
      // Rails show one card per product family (e.g. a single "HEXA" card that
      // opens its wattage/colour variants) — over-fetch so de-duping by family
      // still fills the requested count.
      if (filter?.limit) q = q.limit(Math.max(filter.limit * 12, 48));
      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as unknown as (Product & { categories: { slug: string; name: string; icon: string | null } | null })[];
      const imgs = await primaryImages("product_id", rows.map((r) => r.id));
      const skus = [...new Set(rows.map((row) => row.sku).filter(Boolean))];
      const cut = (list: typeof rows) => (filter?.limit ? list.slice(0, filter.limit) : list);
      if (skus.length === 0) return cut(rows).map((row) => ({ ...row, image_url: imgs[row.id] ?? null }));

      const { data: links } = await supabase
        .from("public_product_variants")
        .select(sel("sku, family_id, product_families(slug)"))
        .in("sku", skus);
      const familyBySku = new Map<string, string>();
      const familyIdBySku = new Map<string, string>();
      for (const link of (links ?? []) as unknown as { sku: string; family_id: string | null; product_families?: { slug: string } | null }[]) {
        if (link.product_families?.slug) familyBySku.set(link.sku, link.product_families.slug);
        if (link.family_id) familyIdBySku.set(link.sku, link.family_id);
      }

      const famIds = [...new Set([...familyIdBySku.values()])];
      // Photos are attached to the product family, so fall back to the
      // family's primary image when a single product row has none.
      const famImgs = await primaryImages("family_id", famIds);

      type FamMeta = {
        id: string; slug: string; name: string; main_sku: string;
        min_price: number | null; max_price: number | null; min_mrp: number | null; max_mrp: number | null;
        total_stock: number | null;
      };
      const famMeta = new Map<string, FamMeta>();
      if (famIds.length > 0) {
        const { data: fams } = await supabase
          .from("product_families")
          .select("id, slug, name, main_sku, min_price, max_price, min_mrp, max_mrp, total_stock")
          .in("id", famIds);
        for (const f of (fams ?? []) as unknown as FamMeta[]) famMeta.set(f.id, f);
      }

      const seenFamilies = new Set<string>();
      const deduped: typeof rows = [];
      for (const row of rows) {
        const famId = familyIdBySku.get(row.sku);
        if (famId) {
          if (seenFamilies.has(famId)) continue;
          seenFamilies.add(famId);
        }
        deduped.push(row);
      }

      return cut(deduped).map((row) => {
        const famId = familyIdBySku.get(row.sku);
        const meta = famId ? famMeta.get(famId) : undefined;
        const min = meta?.min_price ?? null;
        const max = meta?.max_price ?? null;
        return {
          ...row,
          name: meta?.name ?? row.name,
          sku: meta?.main_sku ?? row.sku,
          price: min && min > 0 ? Number(min) : row.price,
          mrp: meta?.min_mrp && Number(meta.min_mrp) > 0 ? Number(meta.min_mrp) : row.mrp,
          stock: meta?.total_stock ?? row.stock,
          price_from: !!(min && max && Number(min) !== Number(max)),
          image_url: imgs[row.id] ?? (famId ? famImgs[famId] ?? null : null),
          family_slug: familyBySku.get(row.sku) ?? null,
        };
      });

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

      // A search term should match the product name, its SKU, or the category
      // it belongs to — searching "led" must return the LED Bulbs range.
      let searchCategoryIds: string[] = [];
      const term = filter.search?.trim();
      if (term) {
        const { data: cats } = await supabase
          .from("categories")
          .select("id")
          .ilike("name", `%${term}%`);
        searchCategoryIds = (cats ?? []).map((c) => c.id as string);
      }

      // Families whose SKUs have no published price yet (e.g. GORDEN outdoor,
      // Madhani, TF-CL Classic) must still be listed — the card renders
      // "Price on request" instead of hiding a real, published product.
      let q = supabase.from("product_families").select(cols, { count: "exact" });
      if (categoryIds && categoryIds.length > 0) q = q.in("category_id", categoryIds);
      if (term) {
        const like = `%${term.replace(/[%,()]/g, " ")}%`;
        const clauses = [`name.ilike.${like}`, `main_sku.ilike.${like}`];
        if (searchCategoryIds.length > 0) clauses.push(`category_id.in.(${searchCategoryIds.join(",")})`);
        q = q.or(clauses.join(","));
      }

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
      const famImgs = await primaryImages("family_id", fams.map((f) => f.id));
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
        image_url: famImgs[f.id] ?? null,
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
      if (!data) return null;
      const row = data as unknown as Product & { categories: { slug: string; name: string; icon: string | null } | null };
      const imgs = await primaryImages("product_id", [row.id]);
      let url = imgs[row.id] ?? null;
      if (!url && row.sku) {
        const { data: link } = await supabase
          .from("public_product_variants")
          .select("family_id")
          .eq("sku", row.sku)
          .maybeSingle();
        const famId = (link as { family_id: string | null } | null)?.family_id ?? null;
        if (famId) {
          const famImgs = await primaryImages("family_id", [famId]);
          url = famImgs[famId] ?? null;
        }
      }
      return { ...row, image_url: url };

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
  image_url: string | null;
  sort_order: number;
  product_id?: string | null;
  product_slug?: string | null;
  available_customer?: boolean;
  available_retailer?: boolean;
  available_distributor?: boolean;
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
  image_url: string | null;
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
  body_type: string | null;
  features: string[] | null;
  specifications: Record<string, string> | null;
  weight_g?: number | null;
  dim_l?: number | null;
  dim_w?: number | null;
  dim_h?: number | null;
  categories: { slug: string; name: string; icon: string | null } | null;

  variants: ProductVariant[];
  axes: VariantAxis[];
};

const VARIANT_COLS = "id, family_id, sku, attributes, mrp, price, discount_pct, moq, stock, weight_g, pack_size, pack_weight_g, dim_l, dim_w, dim_h, pack_l, pack_w, pack_h, image_seed, sort_order, created_at, available_customer, available_retailer, available_distributor";

/** Which shopper segment a variation list is being built for. */
export type VariantSegment = "customer" | "retailer" | "distributor";

const segmentAllows = (v: ProductVariant, segment: VariantSegment) =>
  segment === "retailer"
    ? v.available_retailer !== false
    : segment === "distributor"
      ? v.available_distributor !== false
      : v.available_customer !== false;

export const familyQuery = (slug: string, segment: VariantSegment = "customer") =>
  queryOptions({
    queryKey: ["family", slug, segment],
    // Product details edited in admin must be fresh when the storefront opens.
    staleTime: 0,
    gcTime: 30 * 60 * 1000,
    queryFn: async (): Promise<ProductFamily | null> => {
      const { data, error } = await supabase
        .from("product_families")
        .select(
          `*, categories(slug, name, icon), variants:public_product_variants(${VARIANT_COLS}), axes:product_variant_axes(axis_key, label, values, sort_order)`,
        )
        .eq("slug", slug)
        .eq("variants.is_active", true)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const f = data as unknown as ProductFamily;
      f.variants = [...(f.variants ?? [])]
        .filter((v) => segmentAllows(v, segment))
        .sort((a, b) => a.sort_order - b.sort_order);
      f.axes = actualAxes([...(f.axes ?? [])].sort((a, b) => a.sort_order - b.sort_order), f.variants);
      const [famImg, variantImgs] = await Promise.all([
        primaryImages("family_id", [f.id]),
        primaryImages("variant_sku", f.variants.map((v) => v.sku)),
      ]);
      f.image_url = famImg[f.id] ?? null;
      f.variants = f.variants.map((v) => ({ ...v, image_url: variantImgs[v.sku] ?? null }));
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

export const relatedFamilyProductsQuery = ({
  familyId,
  categoryId,
  excludeFamilySlug,
  limit = 10,
}: {
  familyId: string;
  categoryId: string | null;
  excludeFamilySlug?: string;
  limit?: number;
}) =>
  queryOptions({
    queryKey: ["related-family-products", familyId, categoryId ?? "", excludeFamilySlug ?? "", limit],
    // Admin changes to Frequently Bought must reflect on the product page immediately.
    staleTime: 0,
    gcTime: 10 * 60 * 1000,
    queryFn: async (): Promise<ProductRow[]> => {
      const cols =
        "id, slug, main_sku, name, category_id, brand, short_description, min_price, max_price, min_mrp, max_mrp, total_stock, rating, review_count, is_featured, is_bestseller, is_new, is_sale, image_seed, categories(slug, name, icon)";

      const relation = await supabase
        .from("product_related_families")
        .select("related_family_id, sort_order")
        .eq("family_id", familyId)
        .order("sort_order", { ascending: true });

      if (relation.error) throw relation.error;

      const selectedIds = (relation.data ?? [])
        .map((row) => row.related_family_id as string | null)
        .filter((id): id is string => Boolean(id));

      let q = supabase
        .from("product_families")
        .select(cols)
        .eq("is_published", true)
        .is("archived_at", null);

      if (selectedIds.length > 0) {
        q = q.in("id", selectedIds);
      } else if (categoryId) {
        q = q.eq("category_id", categoryId).neq("id", familyId).order("is_bestseller", { ascending: false }).limit(limit);
      } else {
        return [];
      }

      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) throw error;

      type FamRow = {
        id: string;
        slug: string;
        main_sku: string;
        name: string;
        category_id: string | null;
        brand: string;
        short_description: string | null;
        min_price: number | null;
        max_price: number | null;
        min_mrp: number | null;
        max_mrp: number | null;
        total_stock: number;
        rating: number;
        review_count: number;
        is_featured: boolean;
        is_bestseller: boolean;
        is_new: boolean;
        is_sale: boolean;
        image_seed: string | null;
        categories: { slug: string; name: string; icon: string | null } | null;
      };

      const order = new Map(selectedIds.map((id, index) => [id, index]));
      const rows = ((data ?? []) as unknown as FamRow[])
        .filter((family) => family.id !== familyId && family.slug !== excludeFamilySlug)
        .sort((a, b) => {
          if (selectedIds.length === 0) return 0;
          return (order.get(a.id) ?? 9999) - (order.get(b.id) ?? 9999);
        })
        .slice(0, limit);

      const famImgs = await primaryImages("family_id", rows.map((family) => family.id));

      return rows.map((family) => ({
        id: family.id,
        slug: family.slug,
        sku: family.main_sku,
        name: family.name,
        category_id: family.category_id,
        brand: family.brand,
        short_description: family.short_description,
        description: null,
        mrp: Number(family.min_mrp ?? family.min_price ?? 0),
        price: Number(family.min_price ?? 0),
        unit: "unit",
        stock: Number(family.total_stock ?? 0),
        rating: Number(family.rating ?? 0),
        review_count: family.review_count ?? 0,
        wattage: null,
        size: null,
        color_temp: null,
        material: null,
        warranty: null,
        is_featured: family.is_featured,
        is_bestseller: family.is_bestseller,
        is_new: family.is_new,
        is_sale: family.is_sale,
        image_seed: family.image_seed,
        image_url: famImgs[family.id] ?? null,
        categories: family.categories,
        family_slug: family.slug,
        price_from: (family.min_price ?? 0) !== (family.max_price ?? 0),
      }));
    },
  });

// Lightweight product list for Browse Categories flyout (name, slug, image, family)
export type BrowseProduct = {
  slug: string;
  name: string;
  sku: string;
  image_seed: string | null;
  image_url: string | null;
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

      // Prefer model families (JOY, RAZER, ZELLY, ZIO ...) — model name only, no variant text
      const { data: fams } = await supabase
        .from("product_families")
        .select("id, slug, main_sku, name, image_seed, min_price, min_mrp")
        .eq("category_id", cat.id)
        .order("name")
        .limit(24);
      const famRows = (fams ?? []) as {
        id: string; slug: string; main_sku: string; name: string; image_seed: string | null;
        min_price: number | null; min_mrp: number | null;
      }[];
      if (famRows.length > 0) {
        const famImgs = await primaryImages("family_id", famRows.map((f) => f.id));
        return famRows.map((f) => ({
          slug: f.slug,
          name: f.name,
          sku: f.main_sku,
          image_seed: f.image_seed,
          image_url: famImgs[f.id] ?? null,
          family_slug: f.slug,
          price: f.min_price ?? null,
          mrp: f.min_mrp ?? null,
          wattage: null,
          stock: null,
        }));
      }

      const { data } = await supabase

        .from("products")
        .select("id, slug, sku, name, image_seed, price, mrp, wattage, stock")
        .eq("category_id", cat.id)
        .order("is_bestseller", { ascending: false })
        .order("name")
        .limit(24);
      const rows = (data ?? []) as {
        id: string; slug: string; sku: string; name: string; image_seed: string | null;
        price: number | null; mrp: number | null; wattage: string | null; stock: number | null;
      }[];

      const skus = rows.map((r) => r.sku).filter(Boolean);
      const familyBySku = new Map<string, string>();
      const familyIdBySku = new Map<string, string>();
      if (skus.length) {
        const { data: links } = await supabase
          .from("public_product_variants")
          .select("sku, family_id, product_families(slug, name)")
          .in("sku", skus);
        for (const link of (links ?? []) as unknown as { sku: string; family_id: string | null; product_families?: { slug: string } | null }[]) {
          if (link.product_families?.slug) familyBySku.set(link.sku, link.product_families.slug);
          if (link.family_id) familyIdBySku.set(link.sku, link.family_id);
        }
      }
      const prodImgs = await primaryImages("product_id", rows.map((r) => r.id));
      const famFallback = await primaryImages("family_id", [...new Set(familyIdBySku.values())]);
      // De-dup by family (one entry per family), keep singles as-is
      const seen = new Set<string>();
      const out: BrowseProduct[] = [];
      for (const r of rows) {
        const fam = familyBySku.get(r.sku) ?? null;
        const key = fam ?? r.slug;
        if (seen.has(key)) continue;
        seen.add(key);
        const famId = familyIdBySku.get(r.sku);
        out.push({
          slug: r.slug, name: r.name, sku: r.sku, image_seed: r.image_seed,
          image_url: prodImgs[r.id] ?? (famId ? famFallback[famId] ?? null : null),
          family_slug: fam,
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
