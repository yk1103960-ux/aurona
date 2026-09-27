import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdminPermission, writeAudit } from "@/lib/admin.server";
import { generateVariantSku, normalizeMainSku } from "@/lib/sku-generation";
import { bulkColumnValue, PRODUCT_MASTER_COLUMNS } from "@/lib/bulk-product-columns";

const ImportRow = z.object({
  name: z.string().trim().min(1).max(240),
  sku: z.string().trim().min(1).max(120),
  slug: z.string().trim().max(240).optional().default(""),
  category_id: z.string().trim().optional().default(""),
  price: z.coerce.number().finite().min(0),
  mrp: z.coerce.number().finite().min(0),
  stock: z.coerce.number().int().min(0).default(0),
  short_description: z.string().max(600).optional().default(""),
  brand: z.string().trim().max(120).optional().default("Aurona"),
});

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const normalizeBulkCategoryName = (value: unknown) =>
  String(value ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("en-IN");

export const adminPreviewCatalogImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ rows: z.array(z.record(z.string(), z.unknown())).min(1).max(1000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdminPermission(context, "catalog.manage");
    const parsed = data.rows.map((row, index) => {
      const result = ImportRow.safeParse(row);
      return result.success
        ? { index, value: result.data, errors: [] as string[] }
        : {
            index,
            value: null,
            errors: result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
          };
    });
    const valid = parsed.filter((row) => row.value).map((row) => row.value!);
    const skuCounts = new Map<string, number>();
    valid.forEach((row) =>
      skuCounts.set(row.sku.toUpperCase(), (skuCounts.get(row.sku.toUpperCase()) ?? 0) + 1),
    );
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const skus = valid.map((row) => row.sku.toUpperCase());
    const categoryIds = valid.map((row) => row.category_id).filter(Boolean);
    const [{ data: existing }, { data: categories }] = await Promise.all([
      skus.length
        ? (supabaseAdmin as any).from("product_variants").select("sku").in("sku", skus)
        : { data: [] },
      categoryIds.length
        ? (supabaseAdmin as any).from("categories").select("id").in("id", categoryIds)
        : { data: [] },
    ]);
    const existingSkus = new Set((existing ?? []).map((row: any) => String(row.sku).toUpperCase()));
    const knownCategories = new Set((categories ?? []).map((row: any) => row.id));
    const rows = parsed.map((row) => {
      const errors = [...row.errors];
      const value = row.value;
      if (value) {
        const sku = value.sku.toUpperCase();
        if ((skuCounts.get(sku) ?? 0) > 1) errors.push("Duplicate SKU in file");
        if (existingSkus.has(sku)) errors.push("SKU already exists (imports are create-only)");
        if (value.category_id && !knownCategories.has(value.category_id))
          errors.push("Unknown category_id");
        if (value.mrp < value.price) errors.push("MRP must be greater than or equal to price");
      }
      return { index: row.index, value, errors };
    });
    return {
      rows,
      validCount: rows.filter((row) => row.value && row.errors.length === 0).length,
      errorCount: rows.filter((row) => row.errors.length).length,
    };
  });

export const adminCommitCatalogImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ rows: z.array(ImportRow).min(1).max(1000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const actor = await assertAdminPermission(context, "catalog.manage");
    const payload = data.rows.map((row) => ({
      ...row,
      sku: row.sku.toUpperCase(),
      slug: row.slug || slugify(row.name),
      category_id: row.category_id || null,
      unit: "Pc",
      description: "",
      material: "",
      warranty: "",
      model: "",
      wattage: "",
      size: "",
      color_temp: "",
      body_type: "",
      pack_size: null,
      features: [],
      specifications: {},
      image_seed: "",
      is_published: false,
      is_featured: false,
      is_bestseller: false,
      is_new: false,
      is_sale: false,
      affiliate_enabled: true,
      affiliate_commission_kind: "inherit",
      affiliate_commission_value: null,
      affiliate_max_commission: null,
      weight_g: null,
      dim_l: null,
      dim_w: null,
      dim_h: null,
    }));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: batchId, error } = await (supabaseAdmin as any).rpc("admin_import_new_families", {
      _rows: payload,
      _actor_user_id: actor.userId,
    });
    if (error) throw new Error(error.message);
    await writeAudit({
      actorUserId: actor.userId,
      actorEmail: actor.email,
      action: "catalog.bulk_import",
      entityType: "admin_import_batch",
      entityId: batchId,
      after: { row_count: payload.length },
    });
    return { batchId: String(batchId), count: payload.length };
  });

export const adminListCatalogImports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminPermission(context, "catalog.manage");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("admin_import_batches")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminRollbackCatalogImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ batchId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const actor = await assertAdminPermission(context, "catalog.manage");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: count, error } = await (supabaseAdmin as any).rpc("admin_rollback_import_batch", {
      _batch_id: data.batchId,
      _actor_user_id: actor.userId,
    });
    if (error) throw new Error(error.message);
    await writeAudit({
      actorUserId: actor.userId,
      actorEmail: actor.email,
      action: "catalog.bulk_import_rollback",
      entityType: "admin_import_batch",
      entityId: data.batchId,
      after: { archived_count: count },
    });
    return { count: Number(count) };
  });

export const adminExportCatalog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminPermission(context, "catalog.manage");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("product_families")
      .select(
        "name, main_sku, slug, brand, category_id, short_description, is_published, product_variants(sku, attributes, price, mrp, stock, reserved_stock, low_stock_threshold, is_active)",
      )
      .is("archived_at", null)
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const returnStatuses = [
  "requested",
  "approved",
  "rejected",
  "pickup_scheduled",
  "picked_up",
  "received",
  "refund_initiated",
  "refunded",
  "completed",
  "cancelled",
] as const;
export const adminUpdateReturn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        requestId: z.string().uuid(),
        status: z.enum(returnStatuses),
        refundAmount: z.number().finite().min(0),
        refundReference: z.string().trim().max(160).default(""),
        note: z.string().trim().max(500).default(""),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const actor = await assertAdminPermission(context, "returns.manage");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).rpc("admin_update_return_request", {
      _request_id: data.requestId,
      _status: data.status,
      _refund_amount: data.refundAmount,
      _refund_reference: data.refundReference,
      _note: data.note,
      _actor_user_id: actor.userId,
    });
    if (error) throw new Error(error.message);
    await writeAudit({
      actorUserId: actor.userId,
      actorEmail: actor.email,
      action: "return.update",
      entityType: "return_request",
      entityId: data.requestId,
      after: data,
    });
    return { ok: true };
  });

export const adminListSupportTickets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminPermission(context, "support.manage");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("support_tickets")
      .select("*, support_ticket_replies(*)")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
export const adminUpdateSupportTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["open", "in_progress", "waiting_customer", "resolved", "closed"]),
        priority: z.enum(["low", "normal", "high", "urgent"]),
        reply: z.string().trim().max(4000).default(""),
        internal: z.boolean().default(false),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const actor = await assertAdminPermission(context, "support.manage");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("support_tickets")
      .update({ status: data.status, priority: data.priority, assigned_to: actor.userId })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    if (data.reply) {
      const result = await (supabaseAdmin as any).from("support_ticket_replies").insert({
        ticket_id: data.id,
        author_user_id: actor.userId,
        body: data.reply,
        is_internal: data.internal,
      });
      if (result.error) throw new Error(result.error.message);
    }
    await writeAudit({
      actorUserId: actor.userId,
      actorEmail: actor.email,
      action: "support.ticket_update",
      entityType: "support_ticket",
      entityId: data.id,
      after: data,
    });
    return { ok: true };
  });

export const adminListReviews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminPermission(context, "reviews.manage");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("product_reviews")
      .select("*, product_families(name, main_sku)")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
export const adminModerateReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["published", "rejected"]),
        note: z.string().trim().max(500).default(""),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const actor = await assertAdminPermission(context, "reviews.manage");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("product_reviews")
      .update({
        status: data.status,
        moderation_note: data.note || null,
        moderated_by: actor.userId,
        moderated_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await writeAudit({
      actorUserId: actor.userId,
      actorEmail: actor.email,
      action: `review.${data.status}`,
      entityType: "product_review",
      entityId: data.id,
      after: data,
    });
    return { ok: true };
  });

const CampaignInput = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(2).max(160),
    kind: z.enum(["flash_deal", "homepage_promotion", "coupon_campaign"]),
    status: z.enum(["draft", "scheduled", "active", "paused", "completed"]),
    starts_at: z.string().datetime().nullable(),
    ends_at: z.string().datetime().nullable(),
    payload: z.record(z.string(), z.unknown()),
  })
  .refine(
    (v) => !v.starts_at || !v.ends_at || v.ends_at > v.starts_at,
    "Campaign end must be after its start",
  );
export const adminListCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminPermission(context, "campaigns.manage");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("marketing_campaigns")
      .select("*")
      .is("archived_at", null)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });
export const adminSaveCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CampaignInput.parse(input))
  .handler(async ({ data, context }) => {
    const actor = await assertAdminPermission(context, "campaigns.manage");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = {
      name: data.name,
      kind: data.kind,
      status: data.status,
      starts_at: data.starts_at,
      ends_at: data.ends_at,
      payload: data.payload,
      updated_by: actor.userId,
      ...(data.id ? {} : { created_by: actor.userId }),
    };
    const result = data.id
      ? await (supabaseAdmin as any)
          .from("marketing_campaigns")
          .update(payload)
          .eq("id", data.id)
          .select("id")
          .single()
      : await (supabaseAdmin as any)
          .from("marketing_campaigns")
          .insert(payload)
          .select("id")
          .single();
    if (result.error) throw new Error(result.error.message);
    await writeAudit({
      actorUserId: actor.userId,
      actorEmail: actor.email,
      action: data.id ? "campaign.update" : "campaign.create",
      entityType: "marketing_campaign",
      entityId: result.data.id,
      after: data,
    });
    return { id: result.data.id };
  });
export const adminArchiveCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const actor = await assertAdminPermission(context, "campaigns.manage");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("marketing_campaigns")
      .update({
        archived_at: new Date().toISOString(),
        status: "completed",
        updated_by: actor.userId,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await writeAudit({
      actorUserId: actor.userId,
      actorEmail: actor.email,
      action: "campaign.archive",
      entityType: "marketing_campaign",
      entityId: data.id,
    });
    return { ok: true };
  });

const ZoneInput = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(2).max(120),
    pincode_prefixes: z.array(z.string().trim().min(1).max(12)),
    states: z.array(z.string().trim().min(2).max(80)),
    flat_rate: z.number().finite().min(0),
    free_above: z.number().finite().min(0).nullable(),
    min_days: z.number().int().min(0).max(60),
    max_days: z.number().int().min(0).max(90),
    cod_allowed: z.boolean(),
    active: z.boolean(),
    sort_order: z.number().int(),
  })
  .refine((v) => v.max_days >= v.min_days, "Maximum delivery days must be at least the minimum");
const TaxInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(120),
  hsn_code: z.string().trim().max(20).nullable(),
  gst_percent: z.number().finite().min(0).max(100),
  applies_to: z.string().trim().min(1).max(80),
  active: z.boolean(),
});
export const adminSaveShippingZone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ZoneInput.parse(i))
  .handler(async ({ data, context }) => {
    const actor = await assertAdminPermission(context, "settings.manage");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = { ...data, id: undefined };
    const result = data.id
      ? await (supabaseAdmin as any)
          .from("shipping_zones")
          .update(payload)
          .eq("id", data.id)
          .select("id")
          .single()
      : await (supabaseAdmin as any).from("shipping_zones").insert(payload).select("id").single();
    if (result.error) throw new Error(result.error.message);
    await writeAudit({
      actorUserId: actor.userId,
      actorEmail: actor.email,
      action: data.id ? "shipping.zone_update" : "shipping.zone_create",
      entityType: "shipping_zone",
      entityId: result.data.id,
      after: data,
    });
    return { id: result.data.id };
  });
export const adminArchiveShippingZone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const actor = await assertAdminPermission(context, "settings.manage");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("shipping_zones")
      .update({ active: false, archived_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await writeAudit({
      actorUserId: actor.userId,
      actorEmail: actor.email,
      action: "shipping.zone_archive",
      entityType: "shipping_zone",
      entityId: data.id,
    });
    return { ok: true };
  });
export const adminSaveTaxRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => TaxInput.parse(i))
  .handler(async ({ data, context }) => {
    const actor = await assertAdminPermission(context, "settings.manage");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = { ...data, id: undefined };
    const result = data.id
      ? await (supabaseAdmin as any)
          .from("tax_rules")
          .update(payload)
          .eq("id", data.id)
          .select("id")
          .single()
      : await (supabaseAdmin as any).from("tax_rules").insert(payload).select("id").single();
    if (result.error) throw new Error(result.error.message);
    await writeAudit({
      actorUserId: actor.userId,
      actorEmail: actor.email,
      action: data.id ? "tax.rule_update" : "tax.rule_create",
      entityType: "tax_rule",
      entityId: result.data.id,
      after: data,
    });
    return { id: result.data.id };
  });
export const adminArchiveTaxRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const actor = await assertAdminPermission(context, "settings.manage");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("tax_rules")
      .update({ active: false, archived_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await writeAudit({
      actorUserId: actor.userId,
      actorEmail: actor.email,
      action: "tax.rule_archive",
      entityType: "tax_rule",
      entityId: data.id,
    });
    return { ok: true };
  });
export const adminSaveSiteSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ values: z.record(z.string().min(1).max(100), z.string().max(4000)) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const actor = await assertAdminPermission(context, "settings.manage");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const allowed =
      /^(company_|contact_|support_|notification_|social_|business_hours$|address_line$|gst_percentage$|free_shipping_threshold$|distributor_price_visible$|maintenance_mode$|twofa_|otp_|seo_)/;
    const entries = Object.entries(data.values);
    if (entries.some(([key]) => !allowed.test(key))) throw new Error("Unsupported setting key");
    const rows = entries.map(([key, value]) => ({
      key,
      value,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabaseAdmin.from("site_settings").upsert(rows, { onConflict: "key" });
    if (error) throw new Error(error.message);
    await writeAudit({
      actorUserId: actor.userId,
      actorEmail: actor.email,
      action: "settings.bulk_update",
      entityType: "site_settings",
      after: { keys: entries.map(([key]) => key) },
    });
    return { count: rows.length };
  });
const CmsInput = z
  .object({
    id: z.string().uuid().optional(),
    key: z.string().trim().min(2).max(100),
    type: z.string().trim().min(2).max(80),
    title: z.string().trim().max(200).nullable(),
    payload: z.record(z.string(), z.unknown()),
    sort_order: z.number().int(),
    active: z.boolean(),
    starts_at: z.string().datetime().nullable(),
    ends_at: z.string().datetime().nullable(),
  })
  .refine(
    (v) => !v.starts_at || !v.ends_at || v.ends_at > v.starts_at,
    "Content end must be after start",
  );
export const adminSaveCmsBlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => CmsInput.parse(i))
  .handler(async ({ data, context }) => {
    const actor = await assertAdminPermission(context, "settings.manage");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = {
      key: data.key,
      type: data.type,
      title: data.title,
      payload: data.payload,
      sort_order: data.sort_order,
      active: data.active,
      starts_at: data.starts_at,
      ends_at: data.ends_at,
      updated_at: new Date().toISOString(),
      updated_by: actor.userId,
    };
    const result = data.id
      ? await (supabaseAdmin as any)
          .from("cms_blocks")
          .update(payload)
          .eq("id", data.id)
          .select("id")
          .single()
      : await (supabaseAdmin as any).from("cms_blocks").insert(payload).select("id").single();
    if (result.error) throw new Error(result.error.message);
    await writeAudit({
      actorUserId: actor.userId,
      actorEmail: actor.email,
      action: data.id ? "cms.block_update" : "cms.block_create",
      entityType: "cms_block",
      entityId: result.data.id,
      after: data,
    });
    return { id: result.data.id };
  });
export const adminArchiveCmsBlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const actor = await assertAdminPermission(context, "settings.manage");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("cms_blocks")
      .update({ active: false, archived_at: new Date().toISOString(), updated_by: actor.userId })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await writeAudit({
      actorUserId: actor.userId,
      actorEmail: actor.email,
      action: "cms.block_archive",
      entityType: "cms_block",
      entityId: data.id,
    });
    return { ok: true };
  });

export const adminSetShippingProviderEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ provider: z.enum(["shiprocket"]), enabled: z.boolean() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const actor = await assertAdminPermission(context, "settings.manage");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("shipping_providers")
      .update({ enabled: data.enabled })
      .eq("provider", data.provider);
    if (error) throw new Error(error.message);
    await writeAudit({
      actorUserId: actor.userId,
      actorEmail: actor.email,
      action: "shipping.provider_toggle",
      entityType: "shipping_provider",
      entityId: data.provider,
      after: { enabled: data.enabled },
    });
    return { ok: true };
  });

/** Read-only sources for the dynamic bulk-upload configurator.
 * Existing category, option and commission tables remain authoritative.
 */
export const adminGetBulkUploadConfiguration = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminPermission(context, "catalog.manage");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [categories, options, programs, families] = await Promise.all([
      (supabaseAdmin as any)
        .from("categories")
        .select("id,name,slug")
        .order("name"),
      (supabaseAdmin as any)
        .from("catalog_options")
        .select("id,kind,name,code,details,sort_order")
        .eq("active", true)
        .in("kind", ["attribute", "colour"])
        .order("sort_order")
        .order("name"),
      (supabaseAdmin as any)
        .from("referral_programs")
        .select("id,name")
        .eq("is_active", true)
        .order("name"),
      (supabaseAdmin as any)
        .from("product_families")
        .select("id,category_id,axes:product_variant_axes(axis_key,label,values,sort_order)")
        .is("archived_at", null),
    ]);
    for (const result of [categories, options, programs, families]) {
      if (result.error) throw new Error(result.error.message);
    }

    const byCategory = new Map<
      string,
      Map<string, { id: string; axisKey: string; name: string; values: string[]; sortOrder: number }>
    >();

    for (const family of families.data ?? []) {
      const categoryId = String((family as any).category_id ?? "");
      if (!categoryId) continue;
      const categoryAxes = byCategory.get(categoryId) ?? new Map();
      for (const axis of ((family as any).axes ?? []) as Array<{
        axis_key?: string;
        label?: string;
        values?: unknown;
        sort_order?: number;
      }>) {
        const axisKey = String(axis.axis_key ?? "").trim();
        const name = String(axis.label ?? axisKey).trim();
        if (!axisKey || !name) continue;
        const key = axisKey.toLowerCase();
        const current = categoryAxes.get(key) ?? {
          id: axisKey,
          axisKey,
          name,
          values: [],
          sortOrder: Number(axis.sort_order ?? 0),
        };
        const seen = new Set(current.values.map((value) => value.toLowerCase()));
        for (const rawValue of Array.isArray(axis.values) ? axis.values : []) {
          const value = String(rawValue ?? "").trim();
          if (!value || seen.has(value.toLowerCase())) continue;
          current.values.push(value);
          seen.add(value.toLowerCase());
        }
        current.sortOrder = Math.min(current.sortOrder, Number(axis.sort_order ?? current.sortOrder));
        categoryAxes.set(key, current);
      }
      byCategory.set(categoryId, categoryAxes);
    }

    const categoryVariations = Object.fromEntries(
      [...byCategory.entries()].map(([categoryId, axes]) => [
        categoryId,
        [...axes.values()]
          .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
          .map(({ sortOrder, ...axis }) => axis),
      ]),
    );

    return {
      categories: categories.data ?? [],
      // Reusable attributes remain a fallback for categories that do not yet
      // have saved variant axes. Existing family axes are authoritative for
      // category-specific values.
      variations: options.data ?? [],
      categoryVariations,
      // The existing Partner Program table is authoritative. Bulk Upload does
      // not maintain a second, hardcoded commission-program list.
      partnerPrograms: programs.data ?? [],
      templateVersion: "aurona-product-master-v1",
    };
  });

const DynamicBulkInput = z.object({
  metadata: z.record(z.string(), z.unknown()),
  rows: z
    .array(
      z.object({
        excelRow: z.number().int().min(4),
        values: z.array(z.unknown()).length(PRODUCT_MASTER_COLUMNS.length),
      }),
    )
    .min(1)
    .max(2000),
});

const textCell = (value: unknown) => String(value ?? "").trim();
const numericCell = (value: unknown) => value === "" || value == null ? null : Number(value);

function normalizeDynamicRow(row: { excelRow: number; values: unknown[] }) {
  const value = (key: Parameters<typeof bulkColumnValue>[1]) => bulkColumnValue(row.values, key);
  const attributes: Record<string, string> = {};
  const variationAxes: Array<{ name: string; value: string; sort_order: number }> = [];

  const variationSlots = [
    ["variation_1_name", "variation_1_value"],
    ["variation_2_name", "variation_2_value"],
    ["variation_3_name", "variation_3_value"],
  ] as const;

  for (const [nameKey, valueKey] of variationSlots) {
    const name = textCell(value(nameKey));
    const optionValue = textCell(value(valueKey));
    if (name && optionValue) {
      attributes[name] = optionValue;
      variationAxes.push({ name, value: optionValue, sort_order: variationAxes.length });
    }
  }

  return {
    excel_row: row.excelRow,
    sr_no: numericCell(value("sr_no")),
    function: textCell(value("function")).toLowerCase(),
    category_name: textCell(value("category_name")),
    product_name: textCell(value("product_name")),
    family_id: textCell(value("family_id")) || null,
    main_sku: normalizeMainSku(textCell(value("main_sku"))),
    brand: textCell(value("brand")),
    unit: textCell(value("unit")),
    model: textCell(value("model")),
    variant_name: textCell(value("variant_name")),
    variant_sku: textCell(value("variant_sku")).toUpperCase(),
    variant_id: textCell(value("variant_id")) || null,
    barcode: textCell(value("barcode")) || null,
    attributes_json: textCell(value("attributes_json")),
    attributes,
    variation_axes: variationAxes,
    short_description: textCell(value("short_description")),
    description: textCell(value("description")),
    features: textCell(value("features")),
    refundable: textCell(value("refundable")),
    sale_status: textCell(value("sale_status")),
    active_status: textCell(value("active_status")),
    mrp: numericCell(value("mrp")),
    weight_g: numericCell(value("weight_g")),
    dim_l: numericCell(value("dim_l")),
    dim_w: numericCell(value("dim_w")),
    dim_h: numericCell(value("dim_h")),
    customer_discount: numericCell(value("customer_discount")),
    customer_price: numericCell(value("customer_price")),
    customer_moq: numericCell(value("customer_moq")),
    customer_stock: numericCell(value("customer_stock")),
    customer_reserved_stock: numericCell(value("customer_reserved_stock")),
    customer_pack_size: numericCell(value("customer_pack_size")),
    customer_pack_weight_g: numericCell(value("customer_pack_weight_g")),
    customer_pack_l: numericCell(value("customer_pack_l")),
    customer_pack_w: numericCell(value("customer_pack_w")),
    customer_pack_h: numericCell(value("customer_pack_h")),
    retailer_discount: numericCell(value("retailer_discount")),
    retailer_price: numericCell(value("retailer_price")),
    retailer_moq: numericCell(value("retailer_moq")),
    retailer_stock: numericCell(value("retailer_stock")),
    retailer_reserved_stock: numericCell(value("retailer_reserved_stock")),
    retailer_pack_size: numericCell(value("retailer_pack_size")),
    retailer_pack_weight_g: numericCell(value("retailer_pack_weight_g")),
    retailer_pack_l: numericCell(value("retailer_pack_l")),
    retailer_pack_w: numericCell(value("retailer_pack_w")),
    retailer_pack_h: numericCell(value("retailer_pack_h")),
    distributor_discount: numericCell(value("distributor_discount")),
    distributor_price: numericCell(value("distributor_price")),
    distributor_moq: numericCell(value("distributor_moq")),
    distributor_stock: numericCell(value("distributor_stock")),
    distributor_reserved_stock: numericCell(value("distributor_reserved_stock")),
    distributor_pack_size: numericCell(value("distributor_pack_size")),
    distributor_pack_weight_g: numericCell(value("distributor_pack_weight_g")),
    distributor_pack_l: numericCell(value("distributor_pack_l")),
    distributor_pack_w: numericCell(value("distributor_pack_w")),
    distributor_pack_h: numericCell(value("distributor_pack_h")),
    commission_program: textCell(value("commission_program")),
    commission_type: textCell(value("commission_type")).toLowerCase(),
    commission_value: numericCell(value("commission_value")),
    max_commission: numericCell(value("max_commission")),
    seo_title: textCell(value("seo_title")),
    seo_description: textCell(value("seo_description")),
    shipping_days: numericCell(value("shipping_days")),
    warranty: textCell(value("warranty")),
    frequently_bought_category: textCell(value("frequently_bought_category")),
  };
}

export const adminPreviewDynamicCatalogImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DynamicBulkInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdminPermission(context, "catalog.manage");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rows = data.rows.map(normalizeDynamicRow);
    const [categoriesResult, familiesResult, variantsResult, programsResult] = await Promise.all([
      (supabaseAdmin as any).from("categories").select("id,name"),
      (supabaseAdmin as any).from("product_families").select("id,main_sku"),
      (supabaseAdmin as any).from("product_variants").select("id,sku,family_id"),
      (supabaseAdmin as any).from("referral_programs").select("id,name").eq("is_active", true),
    ]);
    for (const result of [categoriesResult, familiesResult, variantsResult, programsResult]) if (result.error) throw new Error(result.error.message);
    const categories = new Map(
      (categoriesResult.data ?? []).map((x: any) => [
        normalizeBulkCategoryName(x.name),
        { id: x.id, name: String(x.name) },
      ]),
    );
    const familiesBySku = new Map((familiesResult.data ?? []).map((x: any) => [String(x.main_sku).toUpperCase(), x]));
    const familiesById = new Map((familiesResult.data ?? []).map((x: any) => [String(x.id), x]));
    const variantsBySku = new Map((variantsResult.data ?? []).map((x: any) => [String(x.sku).toUpperCase(), x]));
    const variantsById = new Map((variantsResult.data ?? []).map((x: any) => [String(x.id), x]));
    const programs = new Set((programsResult.data ?? []).map((x: any) => String(x.name).toLowerCase()));
    const metadataCategory = normalizeBulkCategoryName(data.metadata.category_name);
    let configuredVariations: Array<{ name: string; values: string[] }> = [];
    try {
      const raw = data.metadata.variation_configuration;
      configuredVariations = Array.isArray(raw) ? raw as typeof configuredVariations : JSON.parse(textCell(raw) || "[]");
    } catch {
      throw new Error("The hidden Aurona template configuration is invalid. Download a fresh template.");
    }
    const allowedVariations = new Map(configuredVariations.map((axis) => [
      textCell(axis.name).toLowerCase(),
      new Set((axis.values ?? []).map((value) => textCell(value).toLowerCase())),
    ]));
    const seen = new Set<string>();
    const previewRows = rows.map((row) => {
      const errors: string[] = [];
      if (!['create','update'].includes(row.function)) errors.push("Function must be Create or Update");
      const categoryKey = normalizeBulkCategoryName(row.category_name);
      const resolvedCategory = categories.get(categoryKey);
      if (!resolvedCategory) errors.push(`Unknown Product Category: ${row.category_name || "(blank)"}`);
      else row.category_name = resolvedCategory.name;
      if (metadataCategory && categoryKey !== metadataCategory) errors.push(`Wrong template/category. Expected ${data.metadata.category_name}`);
      if (!row.product_name) errors.push("Product Name is required");
      if (!row.main_sku) errors.push("Main SKU is required");
      if (!row.variant_sku) errors.push("Variant SKU is required");
      if (seen.has(row.variant_sku)) errors.push("Duplicate Variant SKU in this workbook");
      seen.add(row.variant_sku);
      const family = familiesBySku.get(row.main_sku);
      const variant = variantsBySku.get(row.variant_sku);
      if (row.family_id) {
        const familyById = familiesById.get(row.family_id);
        if (!familyById) errors.push(`family_id ${row.family_id} was not found`);
        else if (String((familyById as any).main_sku).toUpperCase() !== row.main_sku) {
          errors.push("family_id does not belong to the supplied Main SKU");
        }
      }
      if (row.variant_id) {
        const variantById = variantsById.get(row.variant_id);
        if (!variantById) errors.push(`variant_id ${row.variant_id} was not found`);
        else {
          if (String((variantById as any).sku).toUpperCase() !== row.variant_sku) {
            errors.push("variant_id does not match the supplied Variant SKU");
          }
          if (family && (variantById as any).family_id !== (family as any).id) {
            errors.push("variant_id does not belong to the supplied Main SKU");
          }
        }
      }
      if (row.function === 'create' && variant) errors.push("Variant SKU already belongs to an existing variant");
      if (row.function === 'create' && row.main_sku && row.variant_sku && row.variation_axes.length) {
        try {
          const expectedSku = generateVariantSku(row.main_sku, row.variation_axes.map((axis) => ({ name: axis.name, value: axis.value })));
          if (expectedSku !== row.variant_sku) errors.push(`Variant SKU does not match the approved rules. Expected ${expectedSku}`);
        } catch (error) {
          errors.push(error instanceof Error ? error.message : "Variation value has no approved SKU rule");
        }
      }
      if (row.function === 'update' && !family) errors.push("Update target Main SKU was not found");
      if (row.function === 'update' && !variant) errors.push("Update target Variant SKU was not found");
      if (row.function === 'update' && family && variant && (variant as { family_id?: string }).family_id !== (family as { id?: string }).id) errors.push("Variant SKU does not belong to the supplied Main SKU");
      for (const axis of row.variation_axes) {
        const allowed = allowedVariations.get(axis.name.toLowerCase());
        if (!allowed) errors.push(`Variation ${axis.name} is not part of this template`);
        else if (!allowed.has(axis.value.toLowerCase())) errors.push(`${axis.value} is not an allowed ${axis.name}. Allowed values: ${[...allowed].join(", ")}`);
      }
      if (row.variation_axes.length !== configuredVariations.length) errors.push(`Expected ${configuredVariations.length} variation values, found ${row.variation_axes.length}`);
      for (const [field, value] of Object.entries(row)) {
        if ((field.includes('price') || field.includes('stock') || field.includes('dim_') || field.includes('pack_') || field === 'mrp' || field.includes('moq')) && typeof value === 'number' && (!Number.isFinite(value) || value < 0)) errors.push(`${field} must be a valid non-negative number`);
      }
      if (row.attributes_json) {
        try {
          const parsedAttributes = JSON.parse(row.attributes_json);
          if (!parsedAttributes || Array.isArray(parsedAttributes) || typeof parsedAttributes !== "object") {
            errors.push("attributes_json must be a JSON object");
          }
        } catch {
          errors.push("attributes_json must contain valid JSON");
        }
      }
      for (const [label, discount] of [
        ["Customer", row.customer_discount],
        ["Retailer", row.retailer_discount],
        ["Distributor", row.distributor_discount],
      ] as const) {
        if (discount != null && discount > 100) errors.push(`${label} Discount cannot exceed 100`);
      }
      if (row.commission_program && !programs.has(row.commission_program.toLowerCase())) errors.push(`Unknown Partner Program: ${row.commission_program}`);
      if (row.commission_type && !['percentage','fixed'].includes(row.commission_type)) errors.push("Commission Type must be Percentage or Fixed");
      if (row.commission_type === 'percentage' && row.commission_value != null && row.commission_value > 100) errors.push("Percentage commission cannot exceed 100");
      if (row.refundable && !['yes','no','true','false','1','0'].includes(row.refundable.toLowerCase())) errors.push("Refundable must be YES or NO");
      if (row.active_status && !['true','false','active','inactive','yes','no'].includes(row.active_status.toLowerCase())) errors.push("Status must be Active/True or Inactive/False");
      for (const field of ['customer_stock','customer_reserved_stock','retailer_stock','retailer_reserved_stock','distributor_stock','distributor_reserved_stock','customer_moq','retailer_moq','distributor_moq'] as const) {
        const value = row[field];
        if (value != null && !Number.isInteger(value)) errors.push(`${field} must be a whole number`);
      }
      for (const field of ['customer_pack_size','retailer_pack_size','distributor_pack_size'] as const) {
        const value = row[field];
        if (value != null && (!Number.isInteger(value) || value < 1)) errors.push(`${field} must be a positive whole number`);
      }
      if (row.mrp != null) for (const [label, price] of [['Customer', row.customer_price], ['Retailer', row.retailer_price], ['Distributor', row.distributor_price]] as const) {
        if (price != null && price > row.mrp) errors.push(`${label} Price cannot exceed MRP`);
      }
      return { excelRow: row.excel_row, mainSku: row.main_sku, variantSku: row.variant_sku, action: row.function, errors };
    });
    return {
      rows: previewRows, normalizedRows: rows,
      productsDetected: new Set(rows.map((row) => row.main_sku)).size,
      productsToCreate: new Set(rows.filter((row) => row.function === 'create' && !familiesBySku.has(row.main_sku)).map((row) => row.main_sku)).size,
      productsToUpdate: new Set(rows.filter((row) => row.function === 'update').map((row) => row.main_sku)).size,
      variantsToCreate: rows.filter((row) => row.function === 'create').length,
      variantsToUpdate: rows.filter((row) => row.function === 'update').length,
      errorCount: previewRows.reduce((sum, row) => sum + row.errors.length, 0),
    };
  });

export const adminCommitDynamicCatalogImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ rows: z.array(z.record(z.string(), z.unknown())).min(1).max(2000) }).parse(input))
  .handler(async ({ data, context }) => {
    const actor = await assertAdminPermission(context, "catalog.manage");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const categoriesResult = await (supabaseAdmin as any).from("categories").select("id,name");
    if (categoriesResult.error) throw new Error(categoriesResult.error.message);
    const categories = new Map(
      (categoriesResult.data ?? []).map((row: any) => [
        normalizeBulkCategoryName(row.name),
        String(row.name),
      ]),
    );

    const rows = data.rows.map((rawRow, index) => {
      const row = { ...rawRow } as Record<string, unknown>;
      const categoryKey = normalizeBulkCategoryName(row.category_name);
      const categoryName = categories.get(categoryKey);
      if (!categoryName) {
        throw new Error(`Unknown Product Category at import row ${index + 1}: ${String(row.category_name ?? "(blank)")}`);
      }
      row.category_name = categoryName;

      const mainSku = normalizeMainSku(String(row.main_sku ?? ""));
      const axes = Array.isArray(row.variation_axes)
        ? (row.variation_axes as Array<Record<string, unknown>>).map((axis) => ({
            name: String(axis.name ?? "").trim(),
            value: String(axis.value ?? "").trim(),
          }))
        : [];
      const expectedSku = generateVariantSku(mainSku, axes);
      const suppliedSku = String(row.variant_sku ?? "").trim().toUpperCase();
      if (expectedSku !== suppliedSku) {
        throw new Error(
          `Variant SKU ${suppliedSku || "(blank)"} does not match Main SKU ${mainSku} and selected variation values. Expected ${expectedSku}.`,
        );
      }
      row.main_sku = mainSku;
      row.variant_sku = expectedSku;
      return row;
    });

    const { data: result, error } = await (supabaseAdmin as any).rpc("admin_import_dynamic_products_v2", { _rows: rows, _actor_user_id: actor.userId });
    if (error) throw new Error(error.message);
    await writeAudit({ actorUserId: actor.userId, actorEmail: actor.email, action: "catalog.dynamic_bulk_import", entityType: "admin_import_batch", entityId: String(result?.batch_id ?? ""), after: result });
    return result;
  });
