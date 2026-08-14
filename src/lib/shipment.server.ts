// Server-only Shiprocket shipment lifecycle: create order → assign AWB →
// persist against the Aurona order → sync tracking.
// Uses the canonical auth in shiprocket.server.ts (resolveShiprocketToken).
// No credentials, tokens or raw provider payloads are ever returned to callers.

type OrderRow = {
  id: string;
  order_number: string;
  created_at: string;
  status: string;
  payment_status: string;
  payment_method: string;
  subtotal: number;
  total: number;
  full_name: string;
  phone: string;
  email: string | null;
  address: string;
  city: string;
  state: string;
  pincode: string;
  shipment_id: string | null;
  awb_code: string | null;
  courier_name: string | null;
  shipment_status: string | null;
};

export type ShipmentResult = {
  ok: true;
  shipmentId: string | null;
  awb: string | null;
  courier: string | null;
  trackingUrl: string | null;
  status: string;
  message: string;
};

function trackingUrlFor(awb: string) {
  return `https://shiprocket.co/tracking/${encodeURIComponent(awb)}`;
}

/** Cheapest serviceable courier id for this shipment, or null to let Shiprocket choose. */
async function pickCourier(opts: {
  pickupPincode: string | null;
  deliveryPincode: string;
  weightKg: number;
  cod: boolean;
  declaredValue: number;
}): Promise<{ id: number | null; name: string | null }> {
  if (!opts.pickupPincode) return { id: null, name: null };
  const { shiprocketAuthed } = await import("./shiprocket.server");
  const qs = new URLSearchParams({
    pickup_postcode: opts.pickupPincode,
    delivery_postcode: opts.deliveryPincode,
    weight: String(opts.weightKg),
    cod: opts.cod ? "1" : "0",
    declared_value: String(Math.max(1, Math.round(opts.declaredValue))),
  });
  const call = await shiprocketAuthed({
    stage: "serviceability",
    path: `/courier/serviceability/?${qs.toString()}`,
  });
  const list: any[] = call.json?.data?.available_courier_companies ?? [];
  if (list.length === 0) return { id: null, name: null };
  const sorted = [...list].sort((a, b) => Number(a.rate ?? 1e9) - Number(b.rate ?? 1e9));
  const best = sorted[0];
  return { id: Number(best.courier_company_id) || null, name: best.courier_name ?? null };
}

/**
 * Creates (or completes) the Shiprocket shipment for a confirmed Aurona order.
 * Idempotent: an order that already has an AWB is returned as-is; an order that
 * has a shipment but no AWB only runs AWB assignment.
 */
export async function createShipmentForOrder(orderId: string): Promise<ShipmentResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { shiprocketAuthed } = await import("./shiprocket.server");

  const [{ data: order }, { data: items }, { data: sp }] = await Promise.all([
    supabaseAdmin.from("orders").select("*").eq("id", orderId).maybeSingle(),
    supabaseAdmin.from("order_items").select("*").eq("order_id", orderId),
    supabaseAdmin.from("shipping_providers").select("config_public, enabled").eq("provider", "shiprocket").maybeSingle(),
  ]);
  if (!order) throw new Error("Order not found");
  const o = order as unknown as OrderRow;

  if (o.status === "cancelled" || o.status === "canceled") {
    throw new Error("This order is cancelled — no shipment can be created.");
  }
  if (o.awb_code) {
    return {
      ok: true,
      shipmentId: o.shipment_id,
      awb: o.awb_code,
      courier: o.courier_name,
      trackingUrl: trackingUrlFor(o.awb_code),
      status: o.shipment_status ?? "awb_assigned",
      message: "Shipment already created for this order.",
    };
  }

  const cod = (o.payment_method ?? "").toLowerCase() === "cod";
  if (!cod && !["paid", "captured", "success"].includes((o.payment_status ?? "").toLowerCase())) {
    throw new Error("Prepaid order is not paid yet — payment must be confirmed before shipping.");
  }

  const lines = (items ?? []).map((it: any) => ({
    sku: (it.sku as string | null) ?? null,
    name: it.product_name as string,
    price: Number(it.price),
    quantity: Number(it.quantity),
  }));
  if (lines.length === 0) throw new Error("Order has no items to ship.");

  const { packageForOrderLines, pickupPincodeForShipping } = await import("./shipping.server");
  const pkg = await packageForOrderLines(lines);
  const pickupPincode = await pickupPincodeForShipping();

  const config = (sp?.config_public ?? {}) as { pickupLocation?: string };
  const pickupLocation = config.pickupLocation || "Home";

  let shipmentId = o.shipment_id && o.shipment_id !== "" ? o.shipment_id : null;
  let providerOrderId: string | null = null;

  if (!shipmentId) {
    const nameParts = (o.full_name ?? "").trim().split(/\s+/);
    const payload = {
      order_id: o.order_number,
      order_date: new Date(o.created_at).toISOString().slice(0, 16).replace("T", " "),
      pickup_location: pickupLocation,
      billing_customer_name: nameParts[0] || o.full_name,
      billing_last_name: nameParts.slice(1).join(" ") || ".",
      billing_address: o.address,
      billing_city: o.city,
      billing_pincode: o.pincode,
      billing_state: o.state,
      billing_country: "India",
      billing_email: o.email || "orders@aurona.co.in",
      billing_phone: o.phone,
      shipping_is_billing: true,
      order_items: lines.map((l) => ({
        name: l.name.slice(0, 100),
        sku: (l.sku || l.name).slice(0, 40),
        units: l.quantity,
        selling_price: l.price,
      })),
      payment_method: cod ? "COD" : "Prepaid",
      sub_total: Number(o.subtotal),
      length: pkg.dims.length,
      breadth: pkg.dims.breadth,
      height: pkg.dims.height,
      weight: pkg.weightKg,
    };

    const call = await shiprocketAuthed({
      stage: "create-order",
      path: "/orders/create/adhoc",
      method: "POST",
      body: payload,
    });
    const j: any = call.json ?? {};
    if (!call.ok || !j?.shipment_id) {
      const reason =
        (typeof j?.message === "string" && j.message) ||
        (j?.errors && JSON.stringify(j.errors).slice(0, 300)) ||
        `Shiprocket rejected the shipment (HTTP ${call.status ?? "network"}).`;
      throw new Error(reason);
    }
    shipmentId = String(j.shipment_id);
    providerOrderId = j.order_id != null ? String(j.order_id) : null;

    await supabaseAdmin
      .from("orders")
      .update({
        shipment_provider: "shiprocket",
        shipment_id: shipmentId,
        shipment_status: "created",
        shipment_synced_at: new Date().toISOString(),
      })
      .eq("id", orderId);
  }

  // ---- AWB assignment ----
  const courier = await pickCourier({
    pickupPincode,
    deliveryPincode: o.pincode,
    weightKg: pkg.weightKg,
    cod,
    declaredValue: Number(o.total),
  });

  const awbCall = await shiprocketAuthed({
    stage: "assign-awb",
    path: "/courier/assign/awb",
    method: "POST",
    body: courier.id
      ? { shipment_id: Number(shipmentId), courier_id: courier.id }
      : { shipment_id: Number(shipmentId) },
  });
  const aj: any = awbCall.json ?? {};
  const awbData = aj?.response?.data ?? aj?.awb_assign_status_data ?? aj?.data ?? {};
  const awb: string | null = awbData?.awb_code ? String(awbData.awb_code) : null;
  const courierName: string | null = awbData?.courier_name ? String(awbData.courier_name) : courier.name;

  if (!awb) {
    const reason =
      (typeof aj?.message === "string" && aj.message) ||
      (aj?.response?.data?.awb_assign_error as string) ||
      `Shipment ${shipmentId} was created but the courier did not return an AWB (HTTP ${awbCall.status ?? "network"}).`;
    await supabaseAdmin
      .from("orders")
      .update({ shipment_status: "awb_pending", shipment_synced_at: new Date().toISOString() })
      .eq("id", orderId);
    throw new Error(reason);
  }

  await supabaseAdmin
    .from("orders")
    .update({
      shipment_provider: "shiprocket",
      shipment_id: shipmentId,
      awb_code: awb,
      courier_name: courierName,
      tracking_url: trackingUrlFor(awb),
      shipment_status: "awb_assigned",
      shipment_synced_at: new Date().toISOString(),
      status: "shipped",
    })
    .eq("id", orderId);

  await supabaseAdmin.from("shipment_events").insert({
    order_id: orderId,
    provider: "shiprocket",
    event_key: `create:${shipmentId}:${awb}`,
    awb_code: awb,
    courier_name: courierName,
    shipment_status: "awb_assigned",
    event_time: new Date().toISOString(),
    payload: { shipment_id: shipmentId, provider_order_id: providerOrderId } as never,
  });

  return {
    ok: true,
    shipmentId,
    awb,
    courier: courierName,
    trackingUrl: trackingUrlFor(awb),
    status: "awb_assigned",
    message: "Shipment created and AWB assigned.",
  };
}

const ORDER_STATUS_BY_SHIPMENT: Array<[RegExp, string]> = [
  [/delivered/i, "delivered"],
  [/out for delivery/i, "out_for_delivery"],
  [/rto|returned/i, "returned"],
  [/cancell?ed/i, "cancelled"],
  [/in transit|shipped|picked up|dispatch/i, "shipped"],
];

/** Pulls the latest tracking state for an order's AWB and persists it. */
export async function syncTrackingForOrder(orderId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { shiprocketAuthed } = await import("./shiprocket.server");

  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, awb_code, shipment_status, status")
    .eq("id", orderId)
    .maybeSingle();
  if (!order?.awb_code) throw new Error("This order has no AWB to track yet.");

  const call = await shiprocketAuthed({
    stage: "track-awb",
    path: `/courier/track/awb/${encodeURIComponent(order.awb_code)}`,
  });
  const t: any = call.json?.tracking_data ?? call.json?.[0]?.tracking_data ?? {};
  const activities: any[] = t?.shipment_track_activities ?? [];
  const track = (t?.shipment_track ?? [])[0] ?? {};
  const current = String(track.current_status ?? t?.shipment_status ?? "").trim();

  if (!call.ok && !current) {
    throw new Error(`Tracking is temporarily unavailable (HTTP ${call.status ?? "network"}).`);
  }

  const mapped = ORDER_STATUS_BY_SHIPMENT.find(([re]) => re.test(current))?.[1];
  await supabaseAdmin
    .from("orders")
    .update({
      shipment_status: current || order.shipment_status,
      courier_name: track.courier_name ?? undefined,
      tracking_url: t?.track_url || trackingUrlFor(order.awb_code),
      shipment_synced_at: new Date().toISOString(),
      ...(mapped ? { status: mapped } : {}),
    })
    .eq("id", orderId);

  // Idempotent event log — event_key dedupes repeated syncs.
  for (const a of activities.slice(0, 25)) {
    const when = String(a.date ?? "");
    await supabaseAdmin
      .from("shipment_events")
      .upsert(
        {
          order_id: orderId,
          provider: "shiprocket",
          event_key: `track:${order.awb_code}:${when}:${String(a["sr-status"] ?? a.status ?? "")}`,
          awb_code: order.awb_code,
          courier_name: track.courier_name ?? null,
          shipment_status: String(a.activity ?? a.status ?? ""),
          status_code: a["sr-status"] != null ? String(a["sr-status"]) : null,
          location: a.location ?? null,
          event_time: when ? new Date(when.replace(" ", "T")).toISOString() : null,
          payload: a as never,
        },
        { onConflict: "event_key", ignoreDuplicates: true },
      );
  }

  return {
    status: current || null,
    courier: track.courier_name ?? null,
    etd: track.edd ?? t?.etd ?? null,
    activities: activities.slice(0, 25).map((a) => ({
      date: a.date ?? null,
      activity: a.activity ?? a.status ?? null,
      location: a.location ?? null,
    })),
  };
}

/** Batch sync for all in-flight shipments (cron friendly). */
export async function syncAllOpenShipments(limit = 50) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("orders")
    .select("id, awb_code, status")
    .not("awb_code", "is", null)
    .not("status", "in", "(delivered,cancelled,returned)")
    .order("shipment_synced_at", { ascending: true, nullsFirst: true })
    .limit(limit);

  let synced = 0;
  const failures: string[] = [];
  for (const row of data ?? []) {
    try {
      await syncTrackingForOrder(row.id);
      synced += 1;
    } catch (error) {
      failures.push(`${row.id}: ${error instanceof Error ? error.message : "sync failed"}`);
    }
  }
  return { scanned: (data ?? []).length, synced, failures };
}
