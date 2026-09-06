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
    if (error) throw new Error(error.message);
    await writeAudit({
      actorUserId: actor.userId,
      actorEmail: actor.email,
      action: `catalog.family_${data.action}`,
      entityType: "product_family",
      after: { familyIds: data.familyIds },
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
    const { data: result, error } = await (supabaseAdmin as any).rpc(
      "admin_upsert_product_family_v2",
      {
        _payload: { ...data, product_id: data.productId ?? null },
      },
    );
    if (error) throw new Error(error.message);
    await writeAudit({
      actorUserId: actor.userId,
      actorEmail: actor.email,
      action: data.productId ? "catalog.family_update" : "catalog.family_create",
      entityType: "product_family",
      entityId: result?.family_id,
      after: { name: data.name, sku: data.sku, productId: result?.product_id },
    });
    return result as { product_id: string; family_id: string };
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
    const { error } = await (supabaseAdmin as any).rpc("admin_save_variant_matrix_v2", {
      _family_id: data.familyId,
      _variants: data.variants,
      _axes: data.axes,
      _actor_user_id: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
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
    let query = (supabaseAdmin as any)
      .from("product_variants")
      .select(
        "id, family_id, sku, attributes, stock, reserved_stock, low_stock_threshold, is_active, updated_at, product_families(name, slug, is_published)",
      )
      .is("archived_at", null)
      .order("stock", { ascending: true })
      .limit(500);
    if (data.search.trim()) query = query.ilike("sku", `%${data.search.trim()}%`);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return (rows ?? []).filter(
      (row: any) =>
        !data.lowOnly ||
        Number(row.stock) - Number(row.reserved_stock) <= Number(row.low_stock_threshold),
    );
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
