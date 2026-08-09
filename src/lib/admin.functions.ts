import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Diagnostic = {
  stage: string;
  endpoint: string;
  method: string;
  status: number | null;
  ok: boolean;
  response: string;
};


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
      email: z.string().trim().email().optional().or(z.literal("")),
      password: z.string().max(200).optional().or(z.literal("")),
      apiToken: z.string().trim().max(4000).optional().or(z.literal("")),
      pickupLocation: z.string().trim().max(100).optional().or(z.literal("")),
      enabled: z.boolean().default(true),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin, writeAudit } = await import("./admin.server");
    const actor = await assertAdmin(context);
    const { encryptJSON } = await import("./crypto.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { shiprocketLogin, shiprocketPickupLocations, authFailureMessage } =
      await import("./shiprocket.server");

    const diagnostics: Diagnostic[] = [];
    const apiToken = data.apiToken?.trim() ?? "";
    const email = data.email?.trim() ?? "";
    const password = data.password ?? "";
    let token = "";

    if (apiToken) {
      // Token mode: never mixed with email/password login.
      token = apiToken;
      diagnostics.push({ stage: "authenticate", endpoint: "(skipped)", method: "-", status: null, ok: true, response: "Using the API token supplied by the admin; no login call made." });
    } else {
      if (!email || password.length < 4) {
        return { ok: false as const, code: "SHIPROCKET_MISSING_INPUT" as const, error: "Enter the API user email and password, or paste an API token.", diagnostics };
      }
      const login = await shiprocketLogin(email, password);
      diagnostics.push(login.diagnostic);
      const got = login.json?.token as string | undefined;
      if (!login.ok || !got) {
        return {
          ok: false as const,
          code: "SHIPROCKET_AUTH_FAILED" as const,
          error: authFailureMessage(login),
          diagnostics,
        };
      }
      token = got;
    }

    // Probe pickup locations. If the account can't read them (module/PII limits),
    // that's a warning — a token we already obtained is still valid for shipping calls.
    const { call: probe, locations } = await shiprocketPickupLocations(token);
    diagnostics.push(probe.diagnostic);
    let warning: string | null = null;
    if (!probe.ok) {
      if (apiToken) {
        return {
          ok: false as const,
          code: "SHIPROCKET_TOKEN_REJECTED" as const,
          error: `Shiprocket rejected the pasted API token. ${authFailureMessage(probe)}`,
          diagnostics,
        };
      }
      warning = `Login succeeded and the connection is saved, but pickup locations could not be read. ${authFailureMessage(probe)}`;
    }


    const names = locations.map((l) => l.pickup_location).filter(Boolean);
    const requested = data.pickupLocation?.trim() || "";
    const matched = names.find((n) => n.toLowerCase() === requested.toLowerCase());
    const pickupLocation = matched || names[0] || requested || "Primary";
    diagnostics.push({
      stage: "pickup-location",
      endpoint: "/settings/company/pickup",
      method: "GET",
      status: 200,
      ok: !!matched || !!names[0],
      response: names.length
        ? `Available: ${names.join(", ")}. Using "${pickupLocation}"${matched ? "" : " (requested value not found on the account)"}.`
        : "No pickup locations are configured on the Shiprocket account.",
    });

    const credCipher = encryptJSON(
      apiToken ? { apiToken } : { email, password },
    );
    const nowIso = new Date().toISOString();
    const { error } = await supabaseAdmin.from("shipping_providers").upsert({
      provider: "shiprocket",
      enabled: data.enabled,
      config_public: {
        pickupLocation,
        availablePickupLocations: names,
        authMode: apiToken ? "api_token" : "api_user",
      },
      credentials_ciphertext: credCipher,
      auth_token_ciphertext: apiToken ? null : encryptJSON({ token }),
      auth_token_expires_at: apiToken ? null : new Date(Date.now() + 9 * 24 * 60 * 60 * 1000).toISOString(),
      credential_masked: apiToken ? "API token •••• " + apiToken.slice(-4) : email.replace(/(.).*(@.*)/, "$1***$2"),
      connected_at: nowIso,
      last_verified_at: nowIso,

      updated_by: actor.userId,
      updated_at: nowIso,
    });
    if (error) throw new Error(error.message);

    await writeAudit({
      actorUserId: actor.userId, actorEmail: actor.email,
      action: "shipping.connect", entityType: "shipping_provider", entityId: "shiprocket",
      after: { pickupLocation, enabled: data.enabled, authMode: apiToken ? "api_token" : "api_user" },
    });
    return { ok: true as const, pickupLocation, pickupLocations: names, diagnostics };
  });

// ============== Re-test the stored Shiprocket connection ==============
export const testShiprocketConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin } = await import("./admin.server");
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolveShiprocketToken, shiprocketPickupLocations } = await import("./shiprocket.server");
    const diagnostics: Diagnostic[] = [];
    try {
      const token = await resolveShiprocketToken(true);
      diagnostics.push({ stage: "authenticate", endpoint: "/auth/login", method: "POST", status: 200, ok: true, response: "Token acquired from stored credentials." });
      const { call, locations } = await shiprocketPickupLocations(token);
      diagnostics.push(call.diagnostic);
      if (!call.ok) return { ok: false as const, error: "Stored credentials produced a token that the API rejected.", diagnostics };
      const names = locations.map((l) => l.pickup_location).filter(Boolean);
      await supabaseAdmin
        .from("shipping_providers")
        .update({ last_verified_at: new Date().toISOString() })
        .eq("provider", "shiprocket");
      return { ok: true as const, pickupLocations: names, diagnostics };
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : "Shiprocket test failed",
        diagnostics,
      };
    }
  });


export const pushOrderToShiprocket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ orderId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { assertAdmin, writeAudit } = await import("./admin.server");
    const actor = await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: order }, { data: items }, { data: sp }] = await Promise.all([
      supabaseAdmin.from("orders").select("*").eq("id", data.orderId).single(),
      supabaseAdmin.from("order_items").select("*").eq("order_id", data.orderId),
      supabaseAdmin.from("shipping_providers").select("config_public").eq("provider", "shiprocket").single(),
    ]);
    if (!order) throw new Error("Order not found");

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

    const { shiprocketAuthed } = await import("./shiprocket.server");
    const call = await shiprocketAuthed({
      stage: "create-order",
      path: "/orders/create/adhoc",
      method: "POST",
      body: payload,
    });
    const j: any = call.json ?? {};
    if (!call.ok || j?.status_code >= 400) throw new Error(j?.message || "Shiprocket create failed");


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
