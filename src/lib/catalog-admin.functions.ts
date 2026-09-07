import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdminPermission, writeAudit } from "@/lib/admin.server";

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
  moq: z.number().int().positive().nullable(),
  retailer_moq: z.number().int().positive().nullable(),
  distributor_moq: z.number().int().positive().nullable(),
  stock: z.number().int().min(0).nullable(),
  pack_size: z.number().int().positive().nullable(),
  weight_g: nullableNumber,
  dim_l: nullableNumber,
  dim_w: nullableNumber,
  dim_h: nullableNumber,
  pack_weight_g: nullableNumber,
  pack_l: nullableNumber,
  pack_w: nullableNumber,
  pack_h: nullableNumber,
  is_active: z.boolean(),
  sort_order: z.number().int().min(0),
  low_stock_threshold: z.number().int().min(0).default(10),
  barcode: z.string().trim().max(120).default(""),
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
    await writeAudit({
      actorUserId: actor.userId,
      actorEmail: actor.email,
      action: `catalog.family_${data.action}`,
      entityType: "product_family",
      after: { familyIds: data.familyIds, compatibilityMode },
    });
    return { ok: true, compatibility_mode: compatibilityMode };
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
    let { error } = await (supabaseAdmin as any).rpc("admin_save_variant_matrix_v2", {
      _family_id: data.familyId,
      _variants: data.variants,
      _axes: data.axes,
      _actor_user_id: context.userId,
    });
    let compatibilityMode = false;
    if (
      error &&
      /admin_save_variant_matrix_v2|could not find the function|schema cache/i.test(error.message)
    ) {
      const fallback = await (supabaseAdmin as any).rpc("admin_save_variant_matrix", {
        _family_id: data.familyId,
        _variants: data.variants,
        _axes: data.axes,
        _actor_user_id: context.userId,
      });
      error = fallback.error;
      compatibilityMode = !fallback.error;
    }
    if (error) throw new Error(error.message);
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
