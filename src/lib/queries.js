import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
export const categoriesQuery = queryOptions({
    queryKey: ["categories"],
    queryFn: async () => {
        const { data, error } = await supabase
            .from("categories")
            .select("*")
            .order("sort_order");
        if (error)
            throw error;
        return (data ?? []);
    },
});
export const categoryCountsQuery = queryOptions({
    queryKey: ["category-counts"],
    queryFn: async () => {
        const { data, error } = await supabase.from("products").select("category_id");
        if (error)
            throw error;
        const map = {};
        for (const row of data ?? []) {
            const id = row.category_id;
            if (!id)
                continue;
            map[id] = (map[id] ?? 0) + 1;
        }
        return map;
    },
});
export const productsQuery = (filter) => queryOptions({
    queryKey: ["products", filter ?? {}],
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    queryFn: async () => {
        const sel = (s) => s;
        const cols = sel("id, slug, sku, name, category_id, brand, short_description, mrp, price, unit, stock, rating, review_count, is_featured, is_bestseller, is_new, is_sale, image_seed, image_url, color, finish, wattage, size, categories(slug, name, icon)");
        let q = supabase.from("products").select(cols);
        if (filter?.categorySlug) {
            const { data: cat } = await supabase
                .from("categories")
                .select("id")
                .eq("slug", filter.categorySlug)
                .maybeSingle();
            if (cat?.id)
                q = q.eq("category_id", cat.id);
            else
                return [];
        }
        if (filter?.featured)
            q = q.eq("is_featured", true);
        if (filter?.bestseller)
            q = q.eq("is_bestseller", true);
        if (filter?.isNew)
            q = q.eq("is_new", true);
        if (filter?.sale)
            q = q.eq("is_sale", true);
        if (filter?.search) {
            const like = `%${filter.search.trim().replace(/[%,()]/g, " ")}%`;
            q = q.or(`name.ilike.${like},sku.ilike.${like}`);
        }
        if (filter?.limit)
            q = q.limit(filter.limit);
        const { data, error } = await q.order("created_at", { ascending: false });
        if (error)
            throw error;
        const rows = (data ?? []);
        const skus = [...new Set(rows.map((row) => row.sku).filter(Boolean))];
        if (skus.length === 0)
            return rows;
        const { data: links } = await supabase
            .from("product_variants")
            .select(sel("sku, product_families(slug)"))
            .in("sku", skus);
        const familyBySku = new Map();
        for (const link of (links ?? [])) {
            if (link.product_families?.slug)
                familyBySku.set(link.sku, link.product_families.slug);
        }
        return rows.map((row) => ({ ...row, family_slug: familyBySku.get(row.sku) ?? null }));
    },
});
export const productsPageQuery = (filter) => queryOptions({
    queryKey: ["families-page", filter],
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    queryFn: async () => {
        const sel = (s) => s;
        const cols = sel("id, slug, main_sku, name, category_id, brand, short_description, min_price, max_price, min_mrp, max_mrp, total_stock, rating, review_count, is_featured, is_bestseller, is_new, is_sale, image_seed, image_url, categories(slug, name, icon)");
        let categoryIds = filter.categoryIds;
        if (filter.categorySlug) {
            const { data: cat } = await supabase
                .from("categories")
                .select("id")
                .eq("slug", filter.categorySlug)
                .maybeSingle();
            if (!cat?.id)
                return { rows: [], total: 0 };
            categoryIds = [cat.id];
        }
        // A search term should match the product name, its SKU, or the category
        // it belongs to — searching "led" must return the LED Bulbs range.
        let searchCategoryIds = [];
        const term = filter.search?.trim();
        if (term) {
            const { data: cats } = await supabase
                .from("categories")
                .select("id")
                .ilike("name", `%${term}%`);
            searchCategoryIds = (cats ?? []).map((c) => c.id);
        }
        // Families whose SKUs have no published price yet (e.g. GORDEN outdoor,
        // Madhani, TF-CL Classic) must still be listed — the card renders
        // "Price on request" instead of hiding a real, published product.
        let q = supabase.from("product_families").select(cols, { count: "exact" });
        if (categoryIds && categoryIds.length > 0)
            q = q.in("category_id", categoryIds);
        if (term) {
            const like = `%${term.replace(/[%,()]/g, " ")}%`;
            const clauses = [`name.ilike.${like}`, `main_sku.ilike.${like}`];
            if (searchCategoryIds.length > 0)
                clauses.push(`category_id.in.(${searchCategoryIds.join(",")})`);
            q = q.or(clauses.join(","));
        }
        if (filter.min && filter.min > 0)
            q = q.gte("min_price", filter.min);
        if (filter.max && filter.max > 0)
            q = q.lte("max_price", filter.max);
        if (filter.sort === "price-asc")
            q = q.order("min_price", { ascending: true });
        else if (filter.sort === "price-desc")
            q = q.order("max_price", { ascending: false });
        else if (filter.sort === "rating")
            q = q.order("rating", { ascending: false });
        else
            q = q.order("created_at", { ascending: false });
        const from = (filter.page - 1) * filter.perPage;
        const to = from + filter.perPage - 1;
        q = q.range(from, to);
        const { data, error, count } = await q;
        if (error)
            throw error;
        const fams = (data ?? []);
        const rows = fams.map((f) => ({
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
            image_url: f.image_url,
            categories: f.categories,
            family_slug: f.slug,
            price_from: (f.min_price ?? 0) !== (f.max_price ?? 0),
        }));
        return { rows, total: count ?? rows.length };
    },
});
export const productQuery = (slug) => queryOptions({
    queryKey: ["product", slug],
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    queryFn: async () => {
        const { data, error } = await supabase
            .from("products")
            .select("*, categories(slug, name, icon)")
            .eq("slug", slug)
            .maybeSingle();
        if (error)
            throw error;
        return data;
    },
});
const VARIANT_COLS = "id, family_id, sku, attributes, mrp, price, discount_pct, moq, stock, weight_g, pack_size, pack_weight_g, dim_l, dim_w, dim_h, pack_l, pack_w, pack_h, image_seed, image_url, sort_order, created_at";
export const familyQuery = (slug) => queryOptions({
    queryKey: ["family", slug],
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    queryFn: async () => {
        const { data, error } = await supabase
            .from("product_families")
            .select(`*, categories(slug, name, icon), variants:product_variants(${VARIANT_COLS}), axes:product_variant_axes(axis_key, label, values, sort_order)`)
            .eq("slug", slug)
            .maybeSingle();
        if (error)
            throw error;
        if (!data)
            return null;
        const f = data;
        f.variants = [...(f.variants ?? [])].sort((a, b) => a.sort_order - b.sort_order);
        f.axes = [...(f.axes ?? [])].sort((a, b) => a.sort_order - b.sort_order);
        return f;
    },
});
export const familyProductsQuery = (skus) => queryOptions({
    queryKey: ["family-products", [...skus].sort().join(",")],
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    enabled: skus.length > 0,
    queryFn: async () => {
        if (skus.length === 0)
            return {};
        const { data } = await supabase.from("products").select("id, sku, slug").in("sku", skus);
        const map = {};
        for (const r of (data ?? [])) {
            map[r.sku] = { id: r.id, slug: r.slug };
        }
        return map;
    },
});
export const browseProductsByCategoryQuery = (categorySlug) => queryOptions({
    queryKey: ["browse-products", categorySlug],
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    enabled: !!categorySlug,
    queryFn: async () => {
        if (!categorySlug)
            return [];
        const { data: cat } = await supabase
            .from("categories")
            .select("id")
            .eq("slug", categorySlug)
            .maybeSingle();
        if (!cat?.id)
            return [];
        // Prefer model families (JOY, RAZER, ZELLY, ZIO ...) — model name only, no variant text
        const { data: fams } = await supabase
            .from("product_families")
            .select("slug, main_sku, name, image_seed, min_price, min_mrp")
            .eq("category_id", cat.id)
            .order("name")
            .limit(24);
        const famRows = (fams ?? []);
        if (famRows.length > 0) {
            return famRows.map((f) => ({
                slug: f.slug,
                name: f.name,
                sku: f.main_sku,
                image_seed: f.image_seed,
                family_slug: f.slug,
                price: f.min_price ?? null,
                mrp: f.min_mrp ?? null,
                wattage: null,
                stock: null,
            }));
        }
        const { data } = await supabase
            .from("products")
            .select("slug, sku, name, image_seed, price, mrp, wattage, stock")
            .eq("category_id", cat.id)
            .order("is_bestseller", { ascending: false })
            .order("name")
            .limit(24);
        const rows = (data ?? []);
        const skus = rows.map((r) => r.sku).filter(Boolean);
        const familyBySku = new Map();
        if (skus.length) {
            const { data: links } = await supabase
                .from("product_variants")
                .select("sku, product_families(slug)")
                .in("sku", skus);
            for (const link of (links ?? [])) {
                if (link.product_families?.slug)
                    familyBySku.set(link.sku, link.product_families.slug);
            }
        }
        // De-dup by family (one entry per family), keep singles as-is
        const seen = new Set();
        const out = [];
        for (const r of rows) {
            const fam = familyBySku.get(r.sku) ?? null;
            const key = fam ?? r.slug;
            if (seen.has(key))
                continue;
            seen.add(key);
            out.push({
                slug: r.slug, name: r.name, sku: r.sku, image_seed: r.image_seed, family_slug: fam,
                price: r.price ?? null, mrp: r.mrp ?? null, wattage: r.wattage ?? null, stock: r.stock ?? null,
            });
        }
        return out.slice(0, 18);
    },
});
export const searchSuggestQuery = (term) => queryOptions({
    queryKey: ["search-suggest", term.trim().toLowerCase()],
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled: term.trim().length >= 2,
    queryFn: async () => {
        const t = term.trim();
        if (t.length < 2)
            return [];
        const like = `%${t.replace(/[%_]/g, "")}%`;
        const cols = "slug, main_sku, name, image_seed, min_price, min_mrp, category_id";
        const [direct, catMatch] = await Promise.all([
            supabase
                .from("product_families")
                .select(cols)
                .or(`name.ilike.${like},main_sku.ilike.${like}`)
                .order("is_bestseller", { ascending: false })
                .limit(8),
            supabase.from("categories").select("id, name").ilike("name", like).limit(3),
        ]);
        const rows = (direct.data ?? []);
        const catIds = (catMatch.data ?? []).map((c) => c.id);
        if (rows.length < 8 && catIds.length) {
            const { data } = await supabase
                .from("product_families")
                .select(cols)
                .in("category_id", catIds)
                .order("is_bestseller", { ascending: false })
                .limit(8 - rows.length);
            for (const r of (data ?? [])) {
                if (!rows.some((x) => x.slug === r.slug))
                    rows.push(r);
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
