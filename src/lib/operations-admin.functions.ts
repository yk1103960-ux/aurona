import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdminPermission, writeAudit } from "@/lib/admin.server";

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
