/**
 * Server-only catalog feed builder for Fastrr Custom Endpoints.
 *
 * Read-only. It NEVER exposes retailer/distributor pricing or MOQ, and never
 * touches the checkout, payment or Shiprocket shipping code paths.
 *
 * Shape follows the Shopify-style contract Fastrr Custom Endpoints consume:
 *   { status, message, data: { products | collections, page_info } }
 */

type Json = Record<string, unknown>;

export type FastrrVariant = {
  id: string;
  sku: string;
  barcode: string | null;
  title: string;
  price: number;
  mrp: number;
  available: boolean;
  inventory_quantity: number;
  weight: number;
  weight_unit: "g";
  dimensions: { length: number | null; breadth: number | null; height: number | null };
  image_url: string | null;
  options: Json;
};

export type FastrrProduct = {
  id: string;
  handle: string;
  title: string;
  description: string;
  vendor: string;
  product_type: string | null;
  tags: string[];
  status: "active";
  url: string;
  images: Array<{ id: string; src: string; alt: string | null; position: number }>;
  price_range: { min_price: number; max_price: number; min_mrp: number; max_mrp: number };
  variants: FastrrVariant[];
  created_at: string;
  updated_at: string;
};

export const SITE_ORIGIN = "https://aurona.co.in";

export function ok(data: Json, status = 200) {
  return Response.json(
    { status, message: "success", data },
    { status, headers: { "Cache-Control": "public, max-age=60" } },
  );
}

export function fail(message: string, status = 400) {
  return Response.json({ status, message, data: null }, { status });
}

export function paging(url: URL) {
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 50) || 50, 1), 250);
  const page = Math.max(Number(url.searchParams.get("page") ?? 1) || 1, 1);
  return { limit, page, from: (page - 1) * limit, to: page * limit - 1 };
}

type Filters = {
  ids?: string[];
  skus?: string[];
  handles?: string[];
  categoryId?: string;
  categorySlug?: string;
  search?: string;
};

export async function loadProducts(url: URL, extra: Filters = {}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as never as {
    from: (t: string) => any;
  };
  const { limit, page, from, to } = paging(url);

  const ids = extra.ids ?? splitParam(url.searchParams.get("ids") ?? url.searchParams.get("id"));
  const skus = extra.skus ?? splitParam(url.searchParams.get("sku") ?? url.searchParams.get("skus"));
  const handles =
    extra.handles ?? splitParam(url.searchParams.get("handle") ?? url.searchParams.get("slug"));
  const search = extra.search ?? url.searchParams.get("q") ?? undefined;

  let categoryId = extra.categoryId ?? url.searchParams.get("collection_id") ?? undefined;
  const categorySlug =
    extra.categorySlug ?? url.searchParams.get("collection_handle") ?? undefined;

  if (!categoryId && categorySlug) {
    const { data: cat } = await db
      .from("categories")
      .select("id")
      .eq("slug", categorySlug)
      .maybeSingle();
    if (!cat) return { products: [], page_info: { page, limit, count: 0, has_next_page: false } };
    categoryId = cat.id as string;
  }

  let q = db
    .from("product_families")
    .select(
      "id, slug, name, description, short_description, brand, category_id, model, size, unit, wattage, warranty, color_temp, body_type, material, specifications, features, min_price, max_price, min_mrp, max_mrp, total_stock, is_featured, is_bestseller, is_new, is_sale, created_at, updated_at",
      { count: "exact" },
    )
    .eq("is_published", true)
    .is("archived_at", null);

  if (ids?.length) q = q.in("id", ids);
  if (handles?.length) q = q.in("slug", handles);
  if (categoryId) q = q.eq("category_id", categoryId);
  if (search) q = q.ilike("name", `%${search}%`);

  const { data: families, count, error } = await q.order("name").range(from, to);
  if (error) throw new Error(error.message);

  let rows = (families ?? []) as any[];

  if (skus?.length) {
    const { data: hit } = await db
      .from("public_product_variants")
      .select("family_id")
      .in("sku", skus);
    const allowed = new Set((hit ?? []).map((r: any) => r.family_id));
    rows = rows.filter((r) => allowed.has(r.id));
  }

  const familyIds = rows.map((r) => r.id as string);
  if (familyIds.length === 0) {
    return { products: [], page_info: { page, limit, count: count ?? 0, has_next_page: false } };
  }

  const [{ data: variants }, { data: images }, { data: cats }] = await Promise.all([
    db
      .from("public_product_variants")
      .select(
        "id, sku, family_id, price, mrp, stock, moq, attributes, weight_g, dim_l, dim_w, dim_h, is_active, sort_order",
      )
      .in("family_id", familyIds)
      .eq("is_active", true)
      .order("sort_order"),
    db
      .from("product_images")
      .select("id, family_id, image_url, alt_text, is_primary, sort_order, variant_sku")
      .in("family_id", familyIds)
      .order("sort_order"),
    db.from("categories").select("id, name, slug"),
  ]);

  // Variant barcode lives on the writable table only (and only once the product
  // admin parity update is applied), so this read is best-effort.
  const barcodeBySku = new Map<string, string | null>();
  try {
    const { data: barcodes } = await db
      .from("product_variants")
      .select("sku, barcode")
      .in("family_id", familyIds);
    for (const b of (barcodes ?? []) as any[]) {
      barcodeBySku.set(String(b.sku), (b.barcode as string | null) ?? null);
    }
  } catch {
    // barcode column not present yet — feed reports null.
  }

  const catById = new Map((cats ?? []).map((c: any) => [c.id, c]));
  const variantsByFamily = groupBy(variants ?? [], (v: any) => v.family_id);
  const imagesByFamily = groupBy(images ?? [], (i: any) => i.family_id);

  const products: FastrrProduct[] = rows.map((f) => {
    const fImages = (imagesByFamily.get(f.id) ?? []).slice().sort(sortImages);
    const fVariants = variantsByFamily.get(f.id) ?? [];
    const imageForSku = (sku: string) =>
      fImages.find((i: any) => i.variant_sku === sku)?.image_url ??
      fImages[0]?.image_url ??
      null;

    return {
      id: String(f.id),
      handle: String(f.slug),
      title: String(f.name),
      description: String(f.description ?? f.short_description ?? ""),
      vendor: String(f.brand ?? "Aurona"),
      product_type: (catById.get(f.category_id)?.name as string | undefined) ?? null,
      tags: [
        f.is_featured ? "featured" : null,
        f.is_bestseller ? "bestseller" : null,
        f.is_new ? "new" : null,
        f.is_sale ? "sale" : null,
        f.wattage ? `${f.wattage}` : null,
      ].filter(Boolean) as string[],
      status: "active",
      url: `${SITE_ORIGIN}/products/${f.slug}`,
      images: fImages.map((i: any, idx: number) => ({
        id: String(i.id),
        src: absolute(i.image_url),
        alt: (i.alt_text as string | null) ?? null,
        position: idx + 1,
      })),
      price_range: {
        min_price: num(f.min_price),
        max_price: num(f.max_price),
        min_mrp: num(f.min_mrp),
        max_mrp: num(f.max_mrp),
      },
      variants: fVariants.map((v: any) => ({
        id: String(v.sku),
        sku: String(v.sku),
        barcode: barcodeBySku.get(String(v.sku)) ?? null,
        title: variantTitle(v.attributes) || String(v.sku),
        price: num(v.price),
        mrp: num(v.mrp),
        available: num(v.stock) > 0,
        inventory_quantity: num(v.stock),
        weight: num(v.weight_g),
        weight_unit: "g" as const,
        dimensions: {
          length: v.dim_l === null ? null : num(v.dim_l),
          breadth: v.dim_w === null ? null : num(v.dim_w),
          height: v.dim_h === null ? null : num(v.dim_h),
        },
        image_url: absoluteOrNull(imageForSku(String(v.sku))),
        options: (v.attributes as Json) ?? {},
      })),
      created_at: String(f.created_at),
      updated_at: String(f.updated_at),
    };
  });

  const total = count ?? products.length;
  return {
    products,
    page_info: { page, limit, count: total, has_next_page: page * limit < total },
  };
}

export async function loadCollections(url: URL) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as never as { from: (t: string) => any };
  const { limit, page, from, to } = paging(url);

  const { data, count, error } = await db
    .from("categories")
    .select("id, name, slug, icon, parent_group, sort_order", { count: "exact" })
    .order("sort_order")
    .range(from, to);
  if (error) throw new Error(error.message);

  const collections = (data ?? []).map((c: any) => ({
    id: String(c.id),
    handle: String(c.slug),
    title: String(c.name),
    description: "",
    group: String(c.parent_group ?? ""),
    image_url: imageOrNull(c.icon),
    url: `${SITE_ORIGIN}/category/${c.slug}`,
    position: num(c.sort_order),
  }));

  const total = count ?? collections.length;
  return {
    collections,
    page_info: { page, limit, count: total, has_next_page: page * limit < total },
  };
}

function splitParam(raw: string | null): string[] | undefined {
  if (!raw) return undefined;
  const parts = raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length ? parts : undefined;
}

function groupBy<T>(rows: T[], key: (row: T) => string) {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    if (!k) continue;
    const list = map.get(k);
    if (list) list.push(row);
    else map.set(k, [row]);
  }
  return map;
}

function sortImages(a: any, b: any) {
  if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
  return num(a.sort_order) - num(b.sort_order);
}

function variantTitle(attributes: unknown): string {
  if (!attributes || typeof attributes !== "object") return "";
  return Object.values(attributes as Record<string, unknown>)
    .filter((v) => typeof v === "string" || typeof v === "number")
    .join(" / ");
}

function num(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function absolute(value: unknown): string {
  const s = String(value ?? "");
  if (!s) return "";
  return s.startsWith("http") ? s : `${SITE_ORIGIN}${s.startsWith("/") ? "" : "/"}${s}`;
}

function imageOrNull(value: unknown): string | null {
  // categories.icon holds an icon name, not always an image path.
  const s = String(value ?? "");
  if (!s || !(s.startsWith("http") || s.startsWith("/"))) return null;
  return absolute(s);
}

function absoluteOrNull(value: unknown): string | null {
  const s = absolute(value);
  return s === "" ? null : s;
}
