import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdminPermission, writeAudit } from "@/lib/admin.server";
import { buildCombinations, combinationKey } from "@/lib/variant-options";

const nullableNumber = z.number().finite().nullable();

const ProductFamilyInput = z.object({
  productId: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(240),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(240)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  sku: z.string().trim().min(1).max(120),
  brand: z.string().trim().min(1).max(120),
  category_id: z.string().uuid().nullable(),
  short_description: z.string().max(600).default(""),
  description: z.string().max(20_000).default(""),
  mrp: z.number().finite().min(0),
  price: z.number().finite().min(0),
  stock: z.number().int().min(0),
  unit: z.string().trim().min(1).max(40),
  wattage: z.string().max(80).default(""),
  size: z.string().max(120).default(""),
  color_temp: z.string().max(120).default(""),
  material: z.string().max(200).default(""),
  warranty: z.string().max(200).default(""),
  model: z.string().max(120).default(""),
  body_type: z.string().max(120).default(""),
  pack_size: z.number().int().positive().nullable(),
  features: z.array(z.string().max(300)).max(100),
  specifications: z.record(z.string(), z.string()),
  image_seed: z.string().max(240).default(""),
  is_published: z.boolean(),
  is_featured: z.boolean(),
  is_bestseller: z.boolean(),
  is_new: z.boolean(),
  is_sale: z.boolean(),
  affiliate_enabled: z.boolean(),
  affiliate_commission_kind: z.enum(["inherit", "percentage", "fixed"]),
  affiliate_commission_value: nullableNumber,
  affiliate_max_commission: nullableNumber,
  weight_g: nullableNumber,
  dim_l: nullableNumber,
  dim_w: nullableNumber,
  dim_h: nullableNumber,
  meta_title: z.string().max(240).default(""),
  meta_description: z.string().max(600).default(""),
  meta_image_url: z.string().max(2000).default(""),
  video_provider: z.enum(["", "youtube", "vimeo", "dailymotion", "other"]).default(""),
  video_url: z.string().max(2000).default(""),
  specification_pdf_url: z.string().max(2000).default(""),
  shipping_type: z.enum(["calculated", "free", "flat"]),
  shipping_cost: z.number().finite().min(0),
  shipping_cost_per_quantity: z.boolean(),
  estimated_shipping_days: z.number().int().min(0).max(365).nullable(),
  refundable: z.boolean(),
  refund_note: z.string().max(1000).default(""),
  visible_customer: z.boolean().default(true),
  visible_retailer: z.boolean().default(true),
  visible_distributor: z.boolean().default(true),
});

const VariantInput = z.object({
  id: z.string().uuid().optional(),
  sku: z.string().trim().min(1).max(120),
  attributes: z.record(z.string(), z.string()),
  mrp: nullableNumber,
  price: nullableNumber,
  discount_pct: nullableNumber,
  retailer_price: nullableNumber,
  distributor_price: nullableNumber,
  retailer_mrp: nullableNumber,
  distributor_mrp: nullableNumber,
  retailer_discount_pct: nullableNumber.optional(),
  distributor_discount_pct: nullableNumber.optional(),
  moq: z.number().int().positive().nullable(),
  retailer_moq: z.number().int().positive().nullable(),
  distributor_moq: z.number().int().positive().nullable(),
  stock: z.number().int().min(0).nullable(),
  retailer_stock: z.number().int().min(0).nullable().optional(),
  distributor_stock: z.number().int().min(0).nullable().optional(),
  expected_stock: z.number().int().min(0).optional(),
  pack_size: z.number().int().positive().nullable(),
  retailer_pack_size: z.number().int().positive().nullable().optional(),
  distributor_pack_size: z.number().int().positive().nullable().optional(),
  weight_g: nullableNumber,
  dim_l: nullableNumber,
  dim_w: nullableNumber,
  dim_h: nullableNumber,
  pack_weight_g: nullableNumber,
  pack_l: nullableNumber,
  pack_w: nullableNumber,
  pack_h: nullableNumber,
  retailer_pack_weight_g: nullableNumber,
  retailer_pack_l: nullableNumber,
  retailer_pack_w: nullableNumber,
  retailer_pack_h: nullableNumber,
  distributor_pack_weight_g: nullableNumber,
  distributor_pack_l: nullableNumber,
  distributor_pack_w: nullableNumber,
  distributor_pack_h: nullableNumber,
  is_active: z.boolean(),
  sort_order: z.number().int().min(0),
  low_stock_threshold: z.number().int().min(0).default(10),
  barcode: z.string().trim().max(120).default(""),
  available_customer: z.boolean().default(true),
  available_retailer: z.boolean().default(true),
  available_distributor: z.boolean().default(true),
});

const AxisInput = z.object({
  axis_key: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(100),
  values: z.array(z.string().trim().min(1).max(100)).max(100),
  sort_order: z.number().int().min(0),
});

const ProductListInput = z.object({
  search: z.string().trim().max(120).default(""),
  categoryId: z.string().uuid().nullable().default(null),
  brand: z.string().trim().max(120).default(""),
  publication: z.enum(["all", "published", "hidden", "archived"]).default("all"),
  stock: z.enum(["all", "in_stock", "low_stock", "out_of_stock"]).default("all"),
  sort: z
    .enum([
      "newest",
      "name_asc",
      "name_desc",
      "price_asc",
      "price_desc",
      "stock_asc",
      "stock_desc",
      "rating_desc",
    ])
    .default("newest"),
  page: z.number().int().min(0).default(0),
  pageSize: z.number().int().min(1).max(100).default(30),
});

const ProductMasterListInput = z.object({
  search: z.string().trim().max(120).default(""),
  categoryId: z.string().uuid().nullable().default(null),
  publication: z.enum(["all", "published", "hidden", "archived"]).default("all"),
  stock: z.enum(["all", "in_stock", "low_stock", "out_of_stock"]).default("all"),
  sort: z.enum(["updated", "name", "sku", "stock_low", "stock_high"]).default("updated"),
  page: z.number().int().min(0).default(0),
  pageSize: z.number().int().min(5).max(50).default(20),
});

export const adminListProductFamilies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ProductListInput.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    await assertAdminPermission(context, "catalog.manage");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let query = (supabaseAdmin as any)
      .from("product_families")
      .select(
        "id, legacy_product_id, name, main_sku, slug, brand, category_id, min_price, max_price, min_mrp, max_mrp, total_stock, is_published, is_featured, is_bestseller, rating, review_count, archived_at, updated_at, categories(name)",
        { count: "exact" },
      );
    if (data.search)
      query = query.or(
        `name.ilike.%${data.search}%,main_sku.ilike.%${data.search}%,slug.ilike.%${data.search}%`,
      );
    if (data.categoryId) query = query.eq("category_id", data.categoryId);
    if (data.brand) query = query.eq("brand", data.brand);
    if (data.publication === "archived") query = query.not("archived_at", "is", null);
    else {
      query = query.is("archived_at", null);
      if (data.publication === "published") query = query.eq("is_published", true);
      if (data.publication === "hidden") query = query.eq("is_published", false);
    }
    if (data.stock === "out_of_stock") query = query.eq("total_stock", 0);
    if (data.stock === "in_stock") query = query.gt("total_stock", 10);
    if (data.stock === "low_stock") query = query.gt("total_stock", 0).lte("total_stock", 10);
    const [column, ascending] = (
      {
        newest: ["updated_at", false],
        name_asc: ["name", true],
        name_desc: ["name", false],
        price_asc: ["min_price", true],
        price_desc: ["min_price", false],
        stock_asc: ["total_stock", true],
        stock_desc: ["total_stock", false],
        rating_desc: ["rating", false],
      } as const
    )[data.sort];
    const from = data.page * data.pageSize;
    const {
      data: rows,
      error,
      count,
    } = await query
      .order(column, { ascending, nullsFirst: false })
      .range(from, from + data.pageSize - 1);
    if (error) throw new Error(error.message);
    return { rows: rows ?? [], count: count ?? 0 };
  });

export const adminGetProductForEdit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdminPermission(context, "catalog.manage");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const families = (supabaseAdmin as any).from("product_families");

    const byFamilyId = await families.select("*").eq("id", data.id).maybeSingle();
    if (byFamilyId.error) throw new Error(byFamilyId.error.message);
    if (byFamilyId.data) return { ...byFamilyId.data, editor_source: "family" as const };

    const byLegacyId = await (supabaseAdmin as any)
      .from("product_families")
      .select("*")
      .eq("legacy_product_id", data.id)
      .maybeSingle();
    if (byLegacyId.error && !/legacy_product_id|schema cache/i.test(byLegacyId.error.message)) {
      throw new Error(byLegacyId.error.message);
    }
    if (byLegacyId.data) return { ...byLegacyId.data, editor_source: "family" as const };

    const legacy = await (supabaseAdmin as any)
      .from("products")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (legacy.error) throw new Error(legacy.error.message);
    if (!legacy.data) throw new Error("Product not found");

    const bySku = await (supabaseAdmin as any)
      .from("product_families")
      .select("*")
      .eq("main_sku", legacy.data.sku)
      .maybeSingle();
    if (bySku.error) throw new Error(bySku.error.message);
    if (bySku.data) {
      return {
        ...bySku.data,
        legacy_product_id: bySku.data.legacy_product_id ?? legacy.data.id,
        editor_source: "family" as const,
      };
    }

    return {
      ...legacy.data,
      id: null,
      legacy_product_id: legacy.data.id,
      main_sku: legacy.data.sku,
      min_mrp: legacy.data.mrp,
      max_mrp: legacy.data.mrp,
      min_price: legacy.data.price,
      max_price: legacy.data.price,
      total_stock: legacy.data.stock,
      editor_source: "legacy" as const,
    };
  });

export const adminListProductMaster = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ProductMasterListInput.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    await assertAdminPermission(context, "catalog.manage");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const search = data.search.trim();
    const filterSearch = search.replace(/[(),]/g, " ");
    let matchedIds: string[] | null = null;

    if (search) {
      const [families, variantResult] = await Promise.all([
        (supabaseAdmin as any)
          .from("product_families")
          .select("id")
          .or(
            `name.ilike.%${filterSearch}%,main_sku.ilike.%${filterSearch}%,slug.ilike.%${filterSearch}%,brand.ilike.%${filterSearch}%,model.ilike.%${filterSearch}%`,
          )
          .limit(500),
        (supabaseAdmin as any)
          .from("product_variants")
          .select("family_id,sku,barcode,attributes")
          .is("archived_at", null)
          .limit(2000),
      ]);
      if (families.error) throw new Error(families.error.message);
      let variants = variantResult;
      if (variants.error && /barcode|schema cache|does not exist/i.test(variants.error.message)) {
        variants = await (supabaseAdmin as any)
          .from("product_variants")
          .select("family_id,sku,attributes")
          .is("archived_at", null)
          .limit(2000);
      }
      if (variants.error) throw new Error(variants.error.message);
      const searchLower = search.toLocaleLowerCase();
      const matchedVariants = (variants.data ?? []).filter((row: any) =>
        [row.sku, row.barcode, ...Object.values(row.attributes ?? {})].some((value) =>
          String(value ?? "")
            .toLocaleLowerCase()
            .includes(searchLower),
        ),
      );
      matchedIds = [
        ...new Set([
          ...(families.data ?? []).map((row: { id: string }) => row.id),
          ...matchedVariants.map((row: { family_id: string }) => row.family_id),
        ]),
      ];
      if (!matchedIds.length) return { families: [], count: 0 };
    }

    let query = (supabaseAdmin as any)
      .from("product_families")
      .select(
        "*,categories(id,name)",
        { count: "exact" },
      );
    if (matchedIds) query = query.in("id", matchedIds);
    if (data.categoryId) query = query.eq("category_id", data.categoryId);
    if (data.publication === "archived") query = query.not("archived_at", "is", null);
    else {
      query = query.is("archived_at", null);
      if (data.publication === "published") query = query.eq("is_published", true);
      if (data.publication === "hidden") query = query.eq("is_published", false);
    }
    if (data.stock === "out_of_stock") query = query.eq("total_stock", 0);
    if (data.stock === "low_stock") query = query.gt("total_stock", 0).lte("total_stock", 10);
    if (data.stock === "in_stock") query = query.gt("total_stock", 10);
    const [sortColumn, ascending] = (
      {
        updated: ["updated_at", false],
        name: ["name", true],
        sku: ["main_sku", true],
        stock_low: ["total_stock", true],
        stock_high: ["total_stock", false],
      } as const
    )[data.sort];
    const from = data.page * data.pageSize;
    const {
      data: familyRows,
      error,
      count,
    } = await query
      .order(sortColumn, { ascending, nullsFirst: false })
      .range(from, from + data.pageSize - 1);
    if (error) throw new Error(error.message);

    const familyIds = (familyRows ?? []).map((row: { id: string }) => row.id);
    if (!familyIds.length) return { families: [], count: count ?? 0 };

    // Read the columns that actually exist in this environment. Product Master
    // must remain usable while optional buyer-channel migrations are pending;
    // missing fields are normalised below without querying nonexistent columns.
    const variants = await (supabaseAdmin as any)
      .from("product_variants")
      .select("*")
      .in("family_id", familyIds)
      .order("sort_order");
    if (variants.error) throw new Error(variants.error.message);

    const [axes, images] = await Promise.all([
      (supabaseAdmin as any)
        .from("product_variant_axes")
        .select("id,family_id,axis_key,label,values,sort_order")
        .in("family_id", familyIds)
        .order("sort_order"),
      (supabaseAdmin as any)
        .from("product_images")
        .select("id,family_id,variant_sku,image_url,alt_text,is_primary,sort_order")
        .in("family_id", familyIds)
        .order("is_primary", { ascending: false })
        .order("sort_order"),
    ]);
    if (axes.error) throw new Error(axes.error.message);
    if (images.error) throw new Error(images.error.message);

    const legacyIds = (familyRows ?? []).map((family: any) => family.legacy_product_id).filter(Boolean);
    const variantIds = (variants.data ?? []).map((variant: any) => variant.id).filter(Boolean);
    const [legacyResult, commissionResult] = await Promise.all([
      legacyIds.length
        ? (supabaseAdmin as any).from("products").select("*").in("id", legacyIds)
        : Promise.resolve({ data: [], error: null }),
      variantIds.length
        ? (supabaseAdmin as any).from("variant_program_commissions").select("*").in("variant_id", variantIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (legacyResult.error) throw new Error(legacyResult.error.message);
    if (commissionResult.error) throw new Error(commissionResult.error.message);
    const programIds = [...new Set((commissionResult.data ?? []).map((item: any) => item.program_id).filter(Boolean))];
    const programResult = programIds.length
      ? await (supabaseAdmin as any).from("referral_programs").select("id,name").in("id", programIds)
      : { data: [], error: null };
    if (programResult.error) throw new Error(programResult.error.message);

    return {
      commissions: commissionResult.data ?? [],
      programs: programResult.data ?? [],
      count: count ?? 0,
      families: (familyRows ?? []).map((family: any) => {
        const familyVariants = (variants.data ?? [])
          .filter((variant: any) => variant.family_id === family.id)
          .map((variant: any) => ({
            ...variant,
            barcode: variant.barcode ?? "",
            retailer_discount_pct: variant.retailer_discount_pct ?? null,
            distributor_discount_pct: variant.distributor_discount_pct ?? null,
            retailer_stock: variant.retailer_stock ?? null,
            distributor_stock: variant.distributor_stock ?? null,
            retailer_pack_size: variant.retailer_pack_size ?? null,
            distributor_pack_size: variant.distributor_pack_size ?? null,
            available_customer: variant.available_customer ?? true,
            available_retailer: variant.available_retailer ?? true,
            available_distributor: variant.available_distributor ?? true,
          }));
        const activeVariants = familyVariants.filter(
          (variant: any) => variant.is_active && !variant.archived_at,
        );
        const range = (key: string) => {
          const values = activeVariants
            .map((variant: any) => Number(variant[key]))
            .filter((value: number) => Number.isFinite(value) && value >= 0);
          return values.length ? { min: Math.min(...values), max: Math.max(...values) } : null;
        };
        const mrp = range("mrp");
        const price = range("price");
        return {
          ...family,
          legacy: (legacyResult.data ?? []).find((item: any) => item.id === family.legacy_product_id) ?? null,
          min_mrp: mrp?.min ?? family.min_mrp,
          max_mrp: mrp?.max ?? family.max_mrp,
          min_price: price?.min ?? family.min_price,
          max_price: price?.max ?? family.max_price,
          total_stock: activeVariants.reduce(
            (total: number, variant: any) => total + Number(variant.stock ?? 0),
            0,
          ),
          variants: familyVariants,
          axes: (axes.data ?? []).filter((axis: any) => axis.family_id === family.id),
          images: (images.data ?? []).filter((image: any) => image.family_id === family.id),
        };
      }),
    };
  });

// Export reads stored variants across the selected category or all categories, independent of grid pagination.
export const adminExportProductMasterRows = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      categoryId: z.string().uuid().optional(),
      allCategories: z.boolean().optional(),
      // Accept requests from an older open Product Master tab during rollout.
      familyIds: z.array(z.string().uuid()).max(50).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdminPermission(context, "catalog.manage");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    let categoryId = data.categoryId;
    if (!categoryId && !data.allCategories) {
      if (!data.familyIds?.length) throw new Error("Please select a category to export.");
      const selected = await db.from("product_families")
        .select("id,category_id")
        .in("id", data.familyIds);
      if (selected.error) throw new Error(selected.error.message);
      const categoryIds = [...new Set((selected.data ?? []).map((family: any) => family.category_id))];
      if ((selected.data ?? []).length !== data.familyIds.length || categoryIds.length !== 1 || !categoryIds[0]) {
        throw new Error("Please select a category to export.");
      }
      categoryId = String(categoryIds[0]);
    }
    const families: any[] = [];
    for (let start = 0; ; start += 500) {
      let query = db.from("product_families")
        .select("*,categories(id,name)")
        .is("archived_at", null);
      if (categoryId) query = query.eq("category_id", categoryId);
      const result = await query.order("id").range(start, start + 499);
      if (result.error) throw new Error(result.error.message);
      families.push(...(result.data ?? []));
      if ((result.data ?? []).length < 500) break;
    }
    const fetchByIds = async (table: string, field: string, ids: string[], selection = "*") => {
      const resultRows: any[] = [];
      for (let start = 0; start < ids.length; start += 200) {
        for (let offset = 0; ; offset += 500) {
          const result = await db.from(table).select(selection)
            .in(field, ids.slice(start, start + 200))
            .order("id")
            .range(offset, offset + 499);
          if (result.error) throw new Error(result.error.message);
          resultRows.push(...(result.data ?? []));
          if ((result.data ?? []).length < 500) break;
        }
      }
      return resultRows;
    };
    const familyIds = families.map((family) => family.id);
    const [variants, axes] = await Promise.all([
      fetchByIds("product_variants", "family_id", familyIds),
      fetchByIds("product_variant_axes", "family_id", familyIds),
    ]);
    // Only current sellable variants: exclude archived, permanently deleted
    // (absent entirely) and obsolete regenerated combinations (is_active = false).
    const actualVariants = variants.filter((variant) => variant.is_active && !variant.archived_at && variant.id && String(variant.sku ?? "").trim());
    const legacy = await fetchByIds("products", "id", families.map((family) => family.legacy_product_id).filter(Boolean));
    const commissions = await fetchByIds("variant_program_commissions", "variant_id", actualVariants.map((row) => row.id));
    const programs = await fetchByIds("referral_programs", "id", [...new Set(commissions.map((row) => row.program_id).filter(Boolean))], "id,name");
    return {
      families: families.filter((family) => actualVariants.some((variant) => variant.family_id === family.id))
        .map((family) => ({
          ...family,
          legacy: legacy.find((item) => item.id === family.legacy_product_id) ?? null,
          variants: actualVariants.filter((item) => item.family_id === family.id),
          axes: axes.filter((item) => item.family_id === family.id),
        })),
      commissions,
      programs,
    };
  });

export const adminBulkProductFamilyAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        familyIds: z.array(z.string().uuid()).min(1).max(250),
        action: z.enum([
          "publish",
          "unpublish",
          "archive",
          "restore",
          "feature",
          "unfeature",
          "deal",
          "undeal",
        ]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const actor = await assertAdminPermission(context, "catalog.manage");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).rpc("admin_set_product_family_state", {
      _family_ids: data.familyIds,
      _action: data.action,
    });
    let compatibilityMode = false;

    if (
      error &&
      /admin_set_product_family_state|could not find the function|schema cache/i.test(error.message)
    ) {
      compatibilityMode = true;
      const statePatch: Record<string, boolean | string | null> = {};

      if (data.action === "publish") statePatch.is_published = true;
      if (data.action === "unpublish") statePatch.is_published = false;
      if (data.action === "archive") {
        statePatch.is_published = false;
        statePatch.archived_at = new Date().toISOString();
      }
      if (data.action === "restore") statePatch.archived_at = null;
      if (data.action === "feature") statePatch.is_featured = true;
      if (data.action === "unfeature") statePatch.is_featured = false;
      if (data.action === "deal") statePatch.is_bestseller = true;
      if (data.action === "undeal") statePatch.is_bestseller = false;

      const { data: updatedFamilies, error: updateError } = await (supabaseAdmin as any)
        .from("product_families")
        .update(statePatch)
        .in("id", data.familyIds)
        .select("id");
      if (updateError) throw new Error(updateError.message);
      if ((updatedFamilies?.length ?? 0) !== data.familyIds.length) {
        throw new Error("One or more selected product families could not be updated");
      }

      // Phase 2A's existing refresh routine keeps the legacy products table in sync.
      // The parity migration makes this whole operation atomic once it is applied.
      for (const familyId of data.familyIds) {
        const { error: refreshError } = await (supabaseAdmin as any).rpc("refresh_product_family", {
          _family_id: familyId,
        });
        if (refreshError) throw new Error(refreshError.message);
      }
    } else if (error) {
      throw new Error(error.message);
    }

    // Keep legacy storefront rows aligned with the authoritative family.
    // Older catalogue fallbacks read products, so their state must match.
    const { data: familyStates, error: familyStateError } = await (supabaseAdmin as any)
      .from("product_families")
      .select("id,legacy_product_id,is_published,archived_at")
      .in("id", data.familyIds);
    if (familyStateError) throw new Error(familyStateError.message);

    const { data: familyVariants, error: familyVariantError } = await (supabaseAdmin as any)
      .from("product_variants")
      .select("family_id,sku")
      .in("family_id", data.familyIds);
    if (familyVariantError) throw new Error(familyVariantError.message);

    for (const family of familyStates ?? []) {
      const legacyPatch = {
        is_published: Boolean(family.is_published) && !family.archived_at,
        archived_at: family.archived_at ?? null,
      };
      if (family.legacy_product_id) {
        const { error: legacyIdError } = await (supabaseAdmin as any)
          .from("products")
          .update(legacyPatch)
          .eq("id", family.legacy_product_id);
        if (legacyIdError) throw new Error(legacyIdError.message);
      }
      const skus = (familyVariants ?? [])
        .filter((variant: any) => variant.family_id === family.id && variant.sku)
        .map((variant: any) => variant.sku);
      if (skus.length) {
        const { error: legacySkuError } = await (supabaseAdmin as any)
          .from("products")
          .update(legacyPatch)
          .in("sku", skus);
        if (legacySkuError) throw new Error(legacySkuError.message);
      }
    }
    await writeAudit({
      actorUserId: actor.userId,
      actorEmail: actor.email,
      action: `catalog.family_${data.action}`,
      entityType: "product_family",
      after: { familyIds: data.familyIds, compatibilityMode },
    });
    return { ok: true, compatibility_mode: compatibilityMode };
  });

/** Permanently remove a product family so its SKUs can be reused. Order history is preserved. */
export const adminDeleteProductFamilyPermanent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ familyId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const actor = await assertAdminPermission(context, "catalog.manage");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: family, error: familyError } = await (supabaseAdmin as any)
      .from("product_families")
      .select("id,name,archived_at")
      .eq("id", data.familyId)
      .maybeSingle();
    if (familyError) throw new Error(familyError.message);
    if (!family) throw new Error("Product family not found");
    if (!family.archived_at) {
      throw new Error("Archive this product before deleting it permanently.");
    }
    const { data: result, error } = await (supabaseAdmin as any).rpc(
      "admin_delete_product_family_permanent",
      { _family_id: data.familyId },
    );
    if (error) throw new Error(error.message);
    await writeAudit({
      actorUserId: actor.userId,
      actorEmail: actor.email,
      action: "catalog.family_delete_permanent",
      entityType: "product_family",
      entityId: data.familyId,
      after: result,
    });
    return { ok: true };
  });

export const adminSetProductVariantState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ variantId: z.string().uuid(), action: z.enum(["archive", "restore"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const actor = await assertAdminPermission(context, "catalog.manage");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const current = await db
      .from("product_variants")
      .select("id,family_id,sku,archived_at")
      .eq("id", data.variantId)
      .maybeSingle();
    if (current.error) throw new Error(current.error.message);
    if (!current.data) throw new Error("Product variant not found");

    const now = new Date().toISOString();
    const updated = await db
      .from("product_variants")
      .update({
        is_active: data.action === "restore",
        archived_at: data.action === "archive" ? now : null,
        updated_at: now,
      })
      .eq("id", data.variantId)
      .select("id,family_id,sku,archived_at")
      .single();
    if (updated.error) throw new Error(updated.error.message);

    const result = {
      variant_id: updated.data.id,
      family_id: updated.data.family_id,
      sku: updated.data.sku,
      action: data.action,
    };

    await writeAudit({
      actorUserId: actor.userId,
      actorEmail: actor.email,
      action: `catalog.variant_${data.action}`,
      entityType: "product_variant",
      entityId: data.variantId,
      after: result,
    });
    return { ok: true };
  });

export const adminDeleteProductVariantPermanent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ variantId: z.string().uuid(), fromVariationEditor: z.boolean().optional() }).parse(input))
  .handler(async ({ data, context }) => {
    const actor = await assertAdminPermission(context, "catalog.manage");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const variant = await db
      .from("product_variants")
      .select("id,family_id,sku,attributes,archived_at")
      .eq("id", data.variantId)
      .maybeSingle();
    if (variant.error) throw new Error(variant.error.message);
    if (!variant.data) throw new Error("Product variant not found");
    if (!variant.data.archived_at && !data.fromVariationEditor) {
      throw new Error("Archive this variant before deleting it permanently.");
    }
    const orderItems = await db
      .from("order_items")
      .select("id,product_snapshot,sku,price,variant_attributes")
      .eq("variant_id", data.variantId);
    if (orderItems.error) throw new Error(orderItems.error.message);

    for (const item of orderItems.data ?? []) {
      const snapshot =
        item.product_snapshot ??
        {
          family_id: variant.data.family_id,
          variant_id: variant.data.id,
          sku: item.sku ?? variant.data.sku,
          price: item.price,
          attributes: item.variant_attributes ?? variant.data.attributes,
          deleted_at: new Date().toISOString(),
        };

      const preserved = await db
        .from("order_items")
        .update({
          product_snapshot: snapshot,
          sku: item.sku ?? variant.data.sku,
          variant_id: null,
        })
        .eq("id", item.id);
      if (preserved.error) throw new Error(preserved.error.message);
    }

    const ledger = await db
      .from("inventory_ledger")
      .delete()
      .eq("variant_id", data.variantId);
    if (ledger.error) throw new Error(ledger.error.message);

    const commissions = await db
      .from("variant_program_commissions")
      .delete()
      .eq("variant_id", data.variantId);
    if (commissions.error) throw new Error(commissions.error.message);

    const images = await db
      .from("product_images")
      .delete()
      .eq("family_id", variant.data.family_id)
      .eq("variant_sku", variant.data.sku);
    if (images.error) throw new Error(images.error.message);

    const deleted = await db
      .from("product_variants")
      .delete()
      .eq("id", data.variantId)
      .select("id")
      .maybeSingle();
    if (deleted.error) throw new Error(deleted.error.message);
    if (!deleted.data) throw new Error("Product variant was not deleted");

    const result = {
      variant_id: variant.data.id,
      family_id: variant.data.family_id,
      sku: variant.data.sku,
    };

    await writeAudit({
      actorUserId: actor.userId,
      actorEmail: actor.email,
      action: "catalog.variant_delete_permanent",
      entityType: "product_variant",
      entityId: data.variantId,
      after: result,
    });
    return { ok: true };
  });

export const adminDuplicateProductFamily = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ familyId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const actor = await assertAdminPermission(context, "catalog.manage");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: result, error } = await (supabaseAdmin as any).rpc(
      "admin_duplicate_product_family",
      { _family_id: data.familyId },
    );
    if (error) throw new Error(error.message);
    await writeAudit({
      actorUserId: actor.userId,
      actorEmail: actor.email,
      action: "catalog.family_duplicate",
      entityType: "product_family",
      entityId: result?.family_id,
      before: { sourceFamilyId: data.familyId },
      after: result,
    });
    return result as { family_id: string; product_id: string };
  });

export const adminSaveProductFamily = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ProductFamilyInput.parse(input))
  .handler(async ({ data, context }) => {
    const actor = await assertAdminPermission(context, "catalog.manage");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let { data: result, error } = await (supabaseAdmin as any).rpc(
      "admin_upsert_product_family_v2",
      {
        _payload: { ...data, product_id: data.productId ?? null },
      },
    );
    let compatibilityMode = false;
    if (
      error &&
      /admin_upsert_product_family_v2|could not find the function|schema cache/i.test(error.message)
    ) {
      const fallback = await (supabaseAdmin as any).rpc("admin_upsert_product_family", {
        _payload: { ...data, product_id: data.productId ?? null },
      });
      result = fallback.data;
      error = fallback.error;
      compatibilityMode = !fallback.error;
    }
    if (error) throw new Error(error.message);
    // Role-based product visibility: applies to the family and its legacy row,
    // so every variant of a hidden product disappears for that buyer type.
    if (result?.family_id) {
      const visibility = await (supabaseAdmin as any).rpc("admin_set_family_visibility", {
        _family_id: result.family_id,
        _product_id: result.product_id ?? null,
        _c: data.visible_customer,
        _r: data.visible_retailer,
        _d: data.visible_distributor,
      });
      if (visibility.error) {
        throw new Error(
          `Product details were saved, but buyer visibility could not be updated: ${visibility.error.message}`,
        );
      }
    }
    await writeAudit({
      actorUserId: actor.userId,
      actorEmail: actor.email,
      action: data.productId ? "catalog.family_update" : "catalog.family_create",
      entityType: "product_family",
      entityId: result?.family_id,
      after: { name: data.name, sku: data.sku, productId: result?.product_id },
    });
    return {
      ...(result as { product_id: string; family_id: string }),
      compatibility_mode: compatibilityMode,
    };
  });

export const adminSaveRelatedProductFamilies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ familyId: z.string().uuid(), relatedIds: z.array(z.string().uuid()).max(24) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const actor = await assertAdminPermission(context, "catalog.manage");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).rpc("admin_set_related_product_families", {
      _family_id: data.familyId,
      _related_ids: data.relatedIds,
    });
    if (error) throw new Error(error.message);
    await writeAudit({
      actorUserId: actor.userId,
      actorEmail: actor.email,
      action: "catalog.related_update",
      entityType: "product_family",
      entityId: data.familyId,
      after: { relatedIds: data.relatedIds },
    });
    return { ok: true };
  });

const CatalogOptionInput = z.object({
  id: z.string().uuid().optional(),
  kind: z.enum(["brand", "attribute", "colour", "warranty", "size_guide"]),
  name: z.string().trim().min(1).max(160),
  code: z.string().trim().max(80).default(""),
  details: z.record(z.string(), z.unknown()).default({}),
  sort_order: z.number().int().min(0).max(100000).default(0),
  active: z.boolean().default(true),
});

export const adminListCatalogOptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ kind: CatalogOptionInput.shape.kind }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdminPermission(context, "catalog.manage");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await (supabaseAdmin as any)
      .from("catalog_options")
      .select("*")
      .eq("kind", data.kind)
      .is("archived_at", null)
      .order("sort_order")
      .order("name");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const adminSaveCatalogOption = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CatalogOptionInput.parse(input))
  .handler(async ({ data, context }) => {
    const actor = await assertAdminPermission(context, "catalog.manage");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = {
      kind: data.kind,
      name: data.name,
      code: data.code || null,
      details: data.details,
      sort_order: data.sort_order,
      active: data.active,
      updated_at: new Date().toISOString(),
    };
    const result = data.id
      ? await (supabaseAdmin as any)
          .from("catalog_options")
          .update(payload)
          .eq("id", data.id)
          .select("id")
          .single()
      : await (supabaseAdmin as any).from("catalog_options").insert(payload).select("id").single();
    if (result.error) throw new Error(result.error.message);
    await writeAudit({
      actorUserId: actor.userId,
      actorEmail: actor.email,
      action: data.id ? "catalog.option_update" : "catalog.option_create",
      entityType: "catalog_option",
      entityId: result.data.id,
      after: payload,
    });
    return { id: result.data.id as string };
  });

export const adminArchiveCatalogOption = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const actor = await assertAdminPermission(context, "catalog.manage");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    const { error } = await (supabaseAdmin as any)
      .from("catalog_options")
      .update({ active: false, archived_at: now, updated_at: now })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await writeAudit({
      actorUserId: actor.userId,
      actorEmail: actor.email,
      action: "catalog.option_archive",
      entityType: "catalog_option",
      entityId: data.id,
    });
    return { ok: true };
  });

export const adminSaveVariantMatrix = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        familyId: z.string().uuid(),
        variants: z.array(VariantInput).min(1).max(500),
        axes: z.array(AxisInput).max(20),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdminPermission(context, "catalog.manage");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const normalizedSkus = data.variants.map((variant) => variant.sku.trim().toUpperCase());
    const duplicateSku = normalizedSkus.find((sku, index) => normalizedSkus.indexOf(sku) !== index);
    if (duplicateSku) throw new Error(`SKU ${duplicateSku} is repeated in this variation list`);

    const existing = await (supabaseAdmin as any)
      .from("product_variants")
      .select("id,family_id,sku,archived_at")
      .in("sku", normalizedSkus);
    if (existing.error) throw new Error(existing.error.message);
    const existingBySku = new Map(
      (existing.data ?? []).map((row: any) => [String(row.sku).toUpperCase(), row]),
    );
    const familyRows = await (supabaseAdmin as any)
      .from("product_variants")
      .select("id,attributes,archived_at,available_customer")
      .eq("family_id", data.familyId);
    if (familyRows.error) throw new Error(familyRows.error.message);
    const persisted = (familyRows.data ?? []).filter((row: any) => !row.archived_at && row.available_customer !== false);
    const submittedIds = new Set(data.variants.map((row) => row.id).filter(Boolean));
    if (persisted.some((row: any) => !submittedIds.has(row.id))) {
      throw new Error("Variant matrix changed while editing. Reload before regenerating.");
    }
    const keys = data.axes.length
      ? new Set(buildCombinations(data.axes, 500).map((attributes) => combinationKey(data.axes, attributes)))
      : null;
    const exactKey = (attributes: Record<string, string>) => {
      const optionKeys = Object.entries(attributes ?? {})
        .filter(([key, value]) => key !== "variant_label" && !key.startsWith("__") && String(value ?? "").trim())
        .map(([key]) => key);
      if (optionKeys.length !== data.axes.length ||
          optionKeys.some((key) => !data.axes.some((axis) => axis.axis_key === key))) return null;
      const key = combinationKey(data.axes, attributes ?? {});
      return keys?.has(key) ? key : null;
    };
    const persistedByCombination = new Map<string, string>();
    if (keys) for (const row of persisted) {
      const key = exactKey(row.attributes ?? {});
      if (key && !persistedByCombination.has(key)) persistedByCombination.set(key, row.id);
    }
    const activeKeys = new Set<string>();
    const reconciledVariants = data.variants.map((variant) => {
      const match = existingBySku.get(variant.sku.trim().toUpperCase()) as
        { id: string; family_id: string; archived_at: string | null } | undefined;
      const key = keys ? exactKey(variant.attributes) : null;
      if (!variant.id && key && persistedByCombination.has(key)) {
        throw new Error(`This combination already has a saved SKU. Reload and reuse it before generating again.`);
      }
      const synchronized = variant.is_active && keys && !key
        ? { ...variant, is_active: false }
        : variant;
      if (synchronized.is_active && key) {
        if (activeKeys.has(key)) throw new Error("Two active variants have the same option combination.");
        activeKeys.add(key);
      }
      if (!match) return synchronized;
      if (match.family_id !== data.familyId) {
        throw new Error(`SKU ${variant.sku} already belongs to another product family`);
      }
      if (match.archived_at) {
        throw new Error(`SKU ${variant.sku} is archived. Restore it before reusing this SKU.`);
      }
      if (!variant.id || variant.id !== match.id) {
        throw new Error(`SKU ${variant.sku} is already used by another variation in this family`);
      }
      return synchronized;
    });
    const { error } = await (supabaseAdmin as any).rpc("admin_save_variant_matrix_v3", {
      _family_id: data.familyId,
      _variants: reconciledVariants,
      _axes: data.axes,
      _actor_user_id: context.userId,
    });
    if (error && /could not find the function|schema cache/i.test(error.message))
      throw new Error(
        "Variant save requires the unapplied 20260908130000_variant_save_safety.sql migration. No variant changes were saved. Authorize database setup before retrying.",
      );
    if (error) throw new Error(error.message);

    return { ok: true, compatibility_mode: false };
  });

export const adminSaveProductMasterRows = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        families: z
          .array(
            z.object({
              familyId: z.string().uuid(),
              variants: z.array(VariantInput).min(1).max(500),
              axes: z.array(AxisInput).max(20),
            }),
          )
          .min(1)
          .max(50),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const actor = await assertAdminPermission(context, "catalog.manage");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let compatibilityMode = false;

    for (const family of data.families) {
      let { error } = await (supabaseAdmin as any).rpc("admin_save_variant_matrix_v3", {
        _family_id: family.familyId,
        _variants: family.variants,
        _axes: family.axes,
        _actor_user_id: context.userId,
      });
      if (
        error &&
        /admin_save_variant_matrix_v3|could not find the function|schema cache/i.test(error.message)
      ) {
        const fallback = await (supabaseAdmin as any).rpc("admin_save_variant_matrix_v2", {
          _family_id: family.familyId,
          _variants: family.variants,
          _axes: family.axes,
          _actor_user_id: context.userId,
        });
        error = fallback.error;
        compatibilityMode = compatibilityMode || !fallback.error;
      }
      if (error) throw new Error(error.message);
      for (const variant of family.variants) {
        const { data: channelRows, error: channelError } = await (supabaseAdmin as any)
          .from("product_variants")
          .update({
            retailer_mrp: variant.retailer_mrp,
            retailer_price: variant.retailer_price,
            retailer_discount_pct: variant.retailer_discount_pct,
            retailer_stock: variant.retailer_stock,
            retailer_pack_size: variant.retailer_pack_size,
            retailer_pack_weight_g: variant.retailer_pack_weight_g,
            retailer_pack_l: variant.retailer_pack_l,
            retailer_pack_w: variant.retailer_pack_w,
            retailer_pack_h: variant.retailer_pack_h,
            distributor_mrp: variant.distributor_mrp,
            distributor_price: variant.distributor_price,
            distributor_discount_pct: variant.distributor_discount_pct,
            distributor_stock: variant.distributor_stock,
            distributor_pack_size: variant.distributor_pack_size,
            distributor_pack_weight_g: variant.distributor_pack_weight_g,
            distributor_pack_l: variant.distributor_pack_l,
            distributor_pack_w: variant.distributor_pack_w,
            distributor_pack_h: variant.distributor_pack_h,
            available_customer: variant.available_customer,
            available_retailer: variant.available_retailer,
            available_distributor: variant.available_distributor,
          })
          .eq("family_id", family.familyId)
          .eq("sku", variant.sku.trim().toUpperCase())
          .select("id");
        if (channelError) throw new Error(channelError.message);
        if ((channelRows?.length ?? 0) !== 1) {
          throw new Error(`Buyer pricing/stock could not be matched to SKU ${variant.sku}. Reload before retrying.`);
        }
      }
    }

    await writeAudit({
      actorUserId: actor.userId,
      actorEmail: actor.email,
      action: "catalog.product_master_save",
      entityType: "product_family",
      after: {
        familyIds: data.families.map((family) => family.familyId),
        variantCount: data.families.reduce((sum, family) => sum + family.variants.length, 0),
        compatibilityMode,
      },
    });
    return { ok: true, compatibility_mode: compatibilityMode };
  });

export const adminSetPrimaryProductImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ imageId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const actor = await assertAdminPermission(context, "catalog.manage");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).rpc("admin_set_primary_product_image", {
      _image_id: data.imageId,
    });
    if (error) throw new Error(error.message);
    await writeAudit({
      actorUserId: actor.userId,
      actorEmail: actor.email,
      action: "catalog.image_primary",
      entityType: "product_image",
      entityId: data.imageId,
    });
    return { ok: true };
  });

export const adminListInventory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ search: z.string().max(120).default(""), lowOnly: z.boolean().default(false) })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdminPermission(context, "inventory.manage");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const query = (supabaseAdmin as any)
      .from("product_variants")
      .select(
        "id, family_id, sku, attributes, stock, reserved_stock, low_stock_threshold, is_active, updated_at, product_families(id, legacy_product_id, name, main_sku, slug, is_published)",
      )
      .is("archived_at", null)
      .order("sku", { ascending: true })
      .limit(500);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    const search = data.search.trim().toLocaleLowerCase();
    return (rows ?? []).filter((row: any) => {
      const family = Array.isArray(row.product_families)
        ? row.product_families[0]
        : row.product_families;
      const available = Number(row.stock) - Number(row.reserved_stock);
      const matchesStock = !data.lowOnly || available <= Number(row.low_stock_threshold);
      const optionText = Object.values(row.attributes ?? {})
        .join(" ")
        .toLocaleLowerCase();
      const matchesSearch =
        !search ||
        String(row.sku ?? "")
          .toLocaleLowerCase()
          .includes(search) ||
        String(family?.name ?? "")
          .toLocaleLowerCase()
          .includes(search) ||
        String(family?.main_sku ?? "")
          .toLocaleLowerCase()
          .includes(search) ||
        optionText.includes(search);
      return matchesStock && matchesSearch;
    });
  });

export const adminAdjustInventory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        variantId: z.string().uuid(),
        delta: z
          .number()
          .int()
          .min(-100000)
          .max(100000)
          .refine((v) => v !== 0),
        reason: z.string().trim().min(3).max(240),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const actor = await assertAdminPermission(context, "inventory.manage");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: quantity, error } = await (supabaseAdmin as any).rpc("admin_adjust_inventory", {
      _variant_id: data.variantId,
      _delta: data.delta,
      _reason: data.reason,
      _actor_user_id: context.userId,
    });
    if (error) throw new Error(error.message);
    await writeAudit({
      actorUserId: actor.userId,
      actorEmail: actor.email,
      action: "inventory.adjust",
      entityType: "product_variant",
      entityId: data.variantId,
      after: { delta: data.delta, reason: data.reason, quantity },
    });
    return { quantity: Number(quantity) };
  });

export const adminLoadVariantMatrix = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        familyId: z.string().uuid().nullable().optional(),
        productId: z.string().max(80).optional(),
        productSku: z.string().max(120).optional(),
        buyerType: z.enum(["customer", "retailer", "distributor"]).default("customer"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdminPermission(context, "catalog.manage");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const pick = async (column: string, value: string) => {
      const res = await db
        .from("product_families")
        .select("*")
        .eq(column, value)
        .maybeSingle();
      if (res.error && !/legacy_product_id|schema cache/i.test(res.error.message)) {
        throw new Error(res.error.message);
      }
      return (res.data as Record<string, any> | null) ?? null;
    };

    let family: Record<string, any> | null = null;
    if (data.familyId) family = await pick("id", data.familyId);
    if (!family && data.productSku) family = await pick("main_sku", data.productSku);
    if (!family && data.productId && data.productId !== "new") {
      family = await pick("legacy_product_id", data.productId);
    }
    if (!family && data.productSku) {
      const viaVariant = await db
        .from("product_variants")
        .select("family_id, product_families(*)")
        .eq("sku", data.productSku)
        .maybeSingle();
      if (viaVariant.error) throw new Error(viaVariant.error.message);
      family = viaVariant.data?.product_families ?? null;
    }

    if (!family) return { family: null, variants: [], axes: [] };

    const [variants, axes] = await Promise.all([
      db.from("product_variants").select("*").eq("family_id", family.id).order("sort_order"),
      db
        .from("product_variant_axes")
        .select("id, axis_key, label, values, sort_order")
        .eq("family_id", family.id)
        .order("sort_order"),
    ]);
    if (variants.error) throw new Error(variants.error.message);
    if (axes.error) throw new Error(axes.error.message);

    if (data.buyerType !== "customer") {
      const setup = await db.from("product_variant_buyer_setups")
        .select("axes,variant_skus")
        .eq("family_id", family.id)
        .eq("buyer_type", data.buyerType)
        .maybeSingle();
      if (setup.error) throw new Error(setup.error.message);
      const selected = new Set<string>((setup.data?.variant_skus ?? []).map((sku: string) => sku.toUpperCase()));
      return {
        family,
        variants: (variants.data ?? [])
          .filter((row: { sku: string }) => selected.has(row.sku.toUpperCase()))
          .map((row: { is_active: boolean; available_retailer: boolean; available_distributor: boolean }) => ({
            ...row,
            is_active: row.is_active &&
              (data.buyerType === "retailer" ? row.available_retailer !== false : row.available_distributor !== false),
          })),
        allVariants: variants.data ?? [],
        axes: (setup.data?.axes ?? []) as Array<{ id: string; axis_key: string; label: string; values: string[]; sort_order: number }>,
      };
    }

    return {
      family,
      variants: (variants.data ?? []).filter((row: { available_customer: boolean | null }) => row.available_customer !== false),
      allVariants: variants.data ?? [],
      axes: (axes.data ?? []) as Array<{ id: string; axis_key: string; label: string; values: string[]; sort_order: number }>,
    };
  });

export const adminSaveBuyerVariantMatrix = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    familyId: z.string().uuid(),
    buyerType: z.enum(["retailer", "distributor"]),
    axes: z.array(AxisInput).max(20),
    variants: z.array(VariantInput).max(500),
  }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdminPermission(context, "catalog.manage");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: result, error } = await (supabaseAdmin as any).rpc("admin_save_buyer_variant_matrix_v1", {
      _family_id: data.familyId,
      _buyer_type: data.buyerType,
      _axes: data.axes,
      _variants: data.variants,
      _actor_user_id: context.userId,
    });
    if (error) throw new Error(error.message);
    return { skuMapping: result as Record<string, string> };
  });
