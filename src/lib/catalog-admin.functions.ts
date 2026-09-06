import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdminPermission, writeAudit } from "@/lib/admin.server";

const nullableNumber = z.number().finite().nullable();

const ProductFamilyInput = z.object({
  productId: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(240),
  slug: z.string().trim().min(1).max(240).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
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
});

const AxisInput = z.object({
  axis_key: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(100),
  values: z.array(z.string().trim().min(1).max(100)).max(100),
  sort_order: z.number().int().min(0),
});

export const adminSaveProductFamily = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ProductFamilyInput.parse(input))
  .handler(async ({ data, context }) => {
    const actor = await assertAdminPermission(context, "catalog.manage");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: result, error } = await (supabaseAdmin as any).rpc("admin_upsert_product_family", {
      _payload: { ...data, product_id: data.productId ?? null },
    });
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

export const adminSaveVariantMatrix = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ familyId: z.string().uuid(), variants: z.array(VariantInput).min(1).max(500), axes: z.array(AxisInput).max(20) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdminPermission(context, "catalog.manage");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).rpc("admin_save_variant_matrix", {
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
    const { error } = await (supabaseAdmin as any).rpc("admin_set_primary_product_image", { _image_id: data.imageId });
    if (error) throw new Error(error.message);
    await writeAudit({ actorUserId: actor.userId, actorEmail: actor.email, action: "catalog.image_primary", entityType: "product_image", entityId: data.imageId });
    return { ok: true };
  });

export const adminListInventory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ search: z.string().max(120).default(""), lowOnly: z.boolean().default(false) }).parse(input ?? {}))
  .handler(async ({ data, context }) => {
    await assertAdminPermission(context, "inventory.manage");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let query = (supabaseAdmin as any)
      .from("product_variants")
      .select("id, family_id, sku, attributes, stock, reserved_stock, low_stock_threshold, is_active, updated_at, product_families(name, slug, is_published)")
      .is("archived_at", null)
      .order("stock", { ascending: true })
      .limit(500);
    if (data.search.trim()) query = query.ilike("sku", `%${data.search.trim()}%`);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return (rows ?? []).filter((row: any) => !data.lowOnly || Number(row.stock) - Number(row.reserved_stock) <= Number(row.low_stock_threshold));
  });

export const adminAdjustInventory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ variantId: z.string().uuid(), delta: z.number().int().min(-100000).max(100000).refine((v) => v !== 0), reason: z.string().trim().min(3).max(240) }).parse(input))
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
    await writeAudit({ actorUserId: actor.userId, actorEmail: actor.email, action: "inventory.adjust", entityType: "product_variant", entityId: data.variantId, after: { delta: data.delta, reason: data.reason, quantity } });
    return { quantity: Number(quantity) };
  });
