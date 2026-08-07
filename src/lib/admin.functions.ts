import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ============== Audit query ==============
export const listAuditLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { limit?: number; entityType?: string; actor?: string } | undefined) =>
    z.object({
      limit: z.number().min(1).max(500).default(100),
      entityType: z.string().optional(),
      actor: z.string().optional(),
    }).parse(input ?? {})
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("./admin.server");
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(data.limit);
    if (data.entityType) q = q.eq("entity_type", data.entityType);
    if (data.actor) q = q.ilike("actor_email", `%${data.actor}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows;
  });

// ============== Save Razorpay credentials ==============
export const saveRazorpayCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      keyId: z.string().trim().min(8).max(120),
      keySecret: z.string().trim().min(8).max(200),
      webhookSecret: z.string().trim().min(8).max(200).optional().or(z.literal("")),
      mode: z.enum(["test", "live"]),
      enabled: z.boolean().default(true),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin, writeAudit } = await import("./admin.server");
    const actor = await assertAdmin(context);
    const { encryptJSON, mask } = await import("./crypto.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const ciphertext = encryptJSON({
      keyId: data.keyId,
      keySecret: data.keySecret,
      webhookSecret: data.webhookSecret || null,
    });

    const { error } = await supabaseAdmin.from("payment_gateways").upsert({
      provider: "razorpay",
      enabled: data.enabled,
      mode: data.mode,
      config_public: { keyId: data.keyId },
      config_secret_ciphertext: ciphertext,
      secret_last4: mask(data.keySecret, 4),
      connected_at: new Date().toISOString(),
      updated_by: actor.userId,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);

    await writeAudit({
      actorUserId: actor.userId,
      actorEmail: actor.email,
      action: "payment_gateway.connect",
      entityType: "payment_gateway",
      entityId: "razorpay",
      after: { mode: data.mode, enabled: data.enabled, keyIdLast4: mask(data.keyId) },
    });
    return { ok: true };
  });

export const setRazorpayEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ enabled: z.boolean() }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin, writeAudit } = await import("./admin.server");
    const actor = await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("payment_gateways")
      .update({ enabled: data.enabled, updated_by: actor.userId, updated_at: new Date().toISOString() })
      .eq("provider", "razorpay");
    if (error) throw new Error(error.message);
    await writeAudit({
      actorUserId: actor.userId, actorEmail: actor.email,
      action: data.enabled ? "payment_gateway.enable" : "payment_gateway.disable",
      entityType: "payment_gateway", entityId: "razorpay",
    });
    return { ok: true };
  });

// ============== Save Shiprocket credentials ==============
export const saveShiprocketCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      email: z.string().email(),
      password: z.string().min(4).max(200),
      pickupLocation: z.string().trim().max(100).optional().or(z.literal("")),
      enabled: z.boolean().default(true),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin, writeAudit } = await import("./admin.server");
    const actor = await assertAdmin(context);
    const { encryptJSON } = await import("./crypto.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Verify credentials work now by fetching a token from Shiprocket
    let tokenResp: any = null;
    try {
      const r = await fetch("https://apiv2.shiprocket.in/v1/external/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email, password: data.password }),
      });
      tokenResp = await r.json();
      if (!r.ok || !tokenResp?.token) {
        throw new Error(tokenResp?.message || "Shiprocket rejected the credentials");
      }
    } catch (e: any) {
      throw new Error(`Shiprocket verification failed: ${e.message}`);
    }

    const credCipher = encryptJSON({ email: data.email, password: data.password });
    const tokenCipher = encryptJSON({ token: tokenResp.token });
    // Shiprocket tokens are valid ~10 days
    const expiresAt = new Date(Date.now() + 9 * 24 * 60 * 60 * 1000).toISOString();

    const { error } = await supabaseAdmin.from("shipping_providers").upsert({
      provider: "shiprocket",
      enabled: data.enabled,
      config_public: { pickupLocation: data.pickupLocation || "Primary" },
      credentials_ciphertext: credCipher,
      auth_token_ciphertext: tokenCipher,
      auth_token_expires_at: expiresAt,
      credential_masked: data.email.replace(/(.).*(@.*)/, "$1***$2"),
      connected_at: new Date().toISOString(),
      last_verified_at: new Date().toISOString(),
      updated_by: actor.userId,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);

    await writeAudit({
      actorUserId: actor.userId, actorEmail: actor.email,
      action: "shipping.connect", entityType: "shipping_provider", entityId: "shiprocket",
      after: { pickupLocation: data.pickupLocation || "Primary", enabled: data.enabled },
    });
    return { ok: true };
  });

export const pushOrderToShiprocket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ orderId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { assertAdmin, getShiprocketToken, writeAudit } = await import("./admin.server");
    const actor = await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: order }, { data: items }, { data: sp }] = await Promise.all([
      supabaseAdmin.from("orders").select("*").eq("id", data.orderId).single(),
      supabaseAdmin.from("order_items").select("*").eq("order_id", data.orderId),
      supabaseAdmin.from("shipping_providers").select("config_public").eq("provider", "shiprocket").single(),
    ]);
    if (!order) throw new Error("Order not found");

    const token = await getShiprocketToken();
    const pickupLocation = (sp?.config_public as any)?.pickupLocation || "Primary";
    const nameParts = order.full_name.split(" ");
    const payload = {
      order_id: order.order_number,
      order_date: new Date(order.created_at).toISOString().slice(0, 10),
      pickup_location: pickupLocation,
      billing_customer_name: nameParts[0] || order.full_name,
      billing_last_name: nameParts.slice(1).join(" ") || ".",
      billing_address: order.address,
      billing_city: order.city,
      billing_pincode: order.pincode,
      billing_state: order.state,
      billing_country: "India",
      billing_email: order.email || "orders@aurona.in",
      billing_phone: order.phone,
      shipping_is_billing: true,
      order_items: (items ?? []).map((it) => ({
        name: it.product_name,
        sku: it.product_id || it.product_name.slice(0, 30),
        units: it.quantity,
        selling_price: Number(it.price),
      })),
      payment_method: order.payment_method === "cod" ? "COD" : "Prepaid",
      sub_total: Number(order.subtotal),
      length: 20, breadth: 20, height: 10, weight: 1.0,
    };

    const r = await fetch("https://apiv2.shiprocket.in/v1/external/orders/create/adhoc", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    const j: any = await r.json();
    if (!r.ok || j?.status_code >= 400) throw new Error(j?.message || "Shiprocket create failed");

    await supabaseAdmin.from("orders").update({
      shipment_provider: "shiprocket",
      shipment_id: String(j.shipment_id ?? ""),
      awb_code: j.awb_code ?? null,
      courier_name: j.courier_name ?? null,
      shipment_status: j.status ?? "pushed",
      shipment_synced_at: new Date().toISOString(),
      status: "shipped",
    }).eq("id", data.orderId);

    await writeAudit({
      actorUserId: actor.userId, actorEmail: actor.email,
      action: "shipment.push", entityType: "order", entityId: data.orderId,
      after: { shipment_id: j.shipment_id, awb: j.awb_code },
    });
    return { ok: true, shipmentId: j.shipment_id, awb: j.awb_code };
  });
