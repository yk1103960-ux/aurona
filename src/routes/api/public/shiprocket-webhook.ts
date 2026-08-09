import { createFileRoute } from "@tanstack/react-router";

/**
 * Shiprocket tracking webhook.
 *
 * Shiprocket authenticates webhooks with a static token sent in a header
 * (Settings → Additional Settings → Webhooks, "Auth Token Type: x-api-key").
 * We compare it in constant time against SHIPROCKET_WEBHOOK_TOKEN.
 *
 * Guarantees:
 *  - idempotent: every event is keyed (awb + status + timestamp) with a unique
 *    index on shipment_events, so replays are no-ops.
 *  - never touches payment_status / payments.
 *  - never creates orders or shipments; only updates a matched order.
 *  - logs only awb + status + matched order number; no customer PII, no tokens.
 */

type ShiprocketPayload = {
  awb?: string | number;
  order_id?: string | number;
  channel_order_id?: string | number;
  shipment_id?: string | number;
  current_status?: string;
  shipment_status?: string;
  current_status_id?: string | number;
  shipment_status_id?: string | number;
  courier_name?: string;
  current_timestamp?: string;
  etd?: string;
  scans?: Array<{ location?: string; date?: string; activity?: string; status?: string }>;
};

/** Shiprocket status → Aurona order status. Never returns a payment status. */
function mapOrderStatus(status: string): string | null {
  const s = status.toLowerCase();
  if (/delivered/.test(s)) return "delivered";
  if (/rto|return/.test(s)) return "returned";
  if (/cancel/.test(s)) return "cancelled";
  if (/out for delivery|in transit|shipped|picked up|pickup|reached|dispatch/.test(s)) return "shipped";
  return null;
}

export const Route = createFileRoute("/api/public/shiprocket-webhook")({
  server: {
    handlers: {
      // Shiprocket pings the URL before saving the webhook.
      GET: async () => new Response("ok"),

      POST: async ({ request }) => {
        const expected = process.env["SHIPROCKET_WEBHOOK_TOKEN"];
        if (!expected) return new Response("Not configured", { status: 503 });

        const provided =
          request.headers.get("x-api-key") ??
          request.headers.get("x-shiprocket-token") ??
          (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");

        const { timingSafeEqual } = await import("node:crypto");
        const a = Buffer.from(provided);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          console.log("[shiprocket-webhook] rejected: bad token");
          return new Response("Unauthorized", { status: 401 });
        }

        let payload: ShiprocketPayload;
        try {
          payload = (await request.json()) as ShiprocketPayload;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const awb = payload.awb != null ? String(payload.awb).trim() : "";
        const shipmentId = payload.shipment_id != null ? String(payload.shipment_id).trim() : "";
        const orderRef = String(payload.order_id ?? payload.channel_order_id ?? "").trim();
        const status = String(payload.current_status ?? payload.shipment_status ?? "").trim();
        const statusCode = String(payload.current_status_id ?? payload.shipment_status_id ?? "").trim() || null;
        const eventTime = payload.current_timestamp ? new Date(payload.current_timestamp) : new Date();
        const lastScan = payload.scans?.[payload.scans.length - 1];

        if (!awb && !shipmentId && !orderRef) return new Response("Missing identifiers", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // --- match the Aurona order (never create one) ---
        let order: { id: string; order_number: string; status: string } | null = null;
        const pick = "id, order_number, status";
        if (orderRef) {
          const { data } = await supabaseAdmin.from("orders").select(pick).eq("order_number", orderRef).maybeSingle();
          order = data ?? null;
        }
        if (!order && shipmentId) {
          const { data } = await supabaseAdmin.from("orders").select(pick).eq("shipment_id", shipmentId).maybeSingle();
          order = data ?? null;
        }
        if (!order && awb) {
          const { data } = await supabaseAdmin.from("orders").select(pick).eq("awb_code", awb).maybeSingle();
          order = data ?? null;
        }

        const eventKey = [
          awb || shipmentId || orderRef,
          statusCode ?? status.toLowerCase(),
          Number.isNaN(eventTime.getTime()) ? "na" : eventTime.toISOString(),
        ].join("|");

        // --- idempotency: unique (provider, event_key) ---
        const { error: insertError } = await supabaseAdmin.from("shipment_events").insert({
          order_id: order?.id ?? null,
          provider: "shiprocket",
          event_key: eventKey,
          awb_code: awb || null,
          courier_name: payload.courier_name ?? null,
          shipment_status: status || null,
          status_code: statusCode,
          location: lastScan?.location ?? null,
          event_time: Number.isNaN(eventTime.getTime()) ? new Date().toISOString() : eventTime.toISOString(),
          payload: payload as never,
        });

        if (insertError) {
          // 23505 = duplicate event replayed by Shiprocket: acknowledge, do nothing.
          if ((insertError as { code?: string }).code === "23505") {
            console.log(`[shiprocket-webhook] duplicate event ignored (awb=${awb || "-"} status=${status || "-"})`);
            return new Response("ok (duplicate)");
          }
          console.log(`[shiprocket-webhook] event store failed: ${insertError.message}`);
          return new Response("Storage error", { status: 500 });
        }

        if (!order) {
          console.log(`[shiprocket-webhook] no matching order (awb=${awb || "-"} ref=${orderRef || "-"})`);
          // 200 so Shiprocket does not retry forever; the event is stored for admin review.
          return new Response("ok (unmatched)");
        }

        const trackingUrl = awb ? `https://shiprocket.co/tracking/${awb}` : null;
        const update: Record<string, string | null> = {
          shipment_provider: "shiprocket",
          shipment_status: status || null,
          shipment_synced_at: new Date().toISOString(),
        };
        if (awb) update["awb_code"] = awb;
        if (shipmentId) update["shipment_id"] = shipmentId;
        if (payload.courier_name) update["courier_name"] = payload.courier_name;
        if (trackingUrl) update["tracking_url"] = trackingUrl;

        // Shipping never decides payment. Terminal states are not walked backwards.
        const mapped = mapOrderStatus(status);
        const terminal = new Set(["delivered", "returned", "cancelled", "refunded"]);
        if (mapped && !terminal.has(order.status)) update["status"] = mapped;

        const { error: updateError } = await supabaseAdmin.from("orders").update(update as never).eq("id", order.id);
        if (updateError) {
          console.log(`[shiprocket-webhook] order update failed: ${updateError.message}`);
          return new Response("Update error", { status: 500 });
        }

        console.log(
          `[shiprocket-webhook] ${order.order_number} awb=${awb || "-"} status="${status}" -> ${mapped ?? order.status}`,
        );
        return new Response("ok");
      },
    },
  },
});
