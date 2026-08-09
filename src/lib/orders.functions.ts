import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Statuses at which a customer may still cancel on their own. */
const CANCELLABLE = new Set(["pending", "confirmed", "processing"]);

/**
 * Customer-initiated cancellation. Allowed only while the order has not been
 * handed to the courier — once it is shipped/out for delivery/delivered the
 * customer must raise a return instead.
 */
export const cancelOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        orderId: z.string().uuid(),
        reason: z.string().trim().min(3).max(300),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: order, error } = await supabase
      .from("orders")
      .select(
        "id, user_id, order_number, status, payment_status, payment_method, total, awb_code, shipment_status",
      )
      .eq("id", data.orderId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order) throw new Error("We couldn’t find that order on your account.");


    const shipmentStatus = (order.shipment_status ?? "").toLowerCase();
    const dispatched =
      Boolean(order.awb_code) ||
      shipmentStatus.includes("picked") ||
      shipmentStatus.includes("transit") ||
      shipmentStatus.includes("shipped") ||
      shipmentStatus.includes("out for delivery") ||
      shipmentStatus.includes("delivered");

    if (order.status === "cancelled" || order.status === "canceled") {
      return { ok: true as const, alreadyCancelled: true, refundPending: false };
    }
    if (!CANCELLABLE.has(order.status) || dispatched) {
      throw new Error(
        "This order has already been shipped, so it can no longer be cancelled. Please raise a return once it is delivered.",
      );
    }

    const paid = order.payment_status === "paid";
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error: upErr } = await supabaseAdmin
      .from("orders")
      .update({
        status: "cancelled",
        // A paid order needs a refund; COD/unpaid orders simply close out.
        payment_status: paid ? "refund_pending" : order.payment_status,
      })
      .eq("id", order.id)
      .eq("user_id", userId);
    if (upErr) throw new Error(upErr.message);

    // Keep a request record so support/admin can follow the refund through the
    // same returns workflow used for post-delivery cases.
    await supabaseAdmin.from("return_requests").insert({
      order_id: order.id,
      user_id: userId,
      kind: "cancellation",
      status: paid ? "refund_initiated" : "completed",
      reason: data.reason,
      refund_amount: paid ? Number(order.total) : 0,
      refund_method: paid ? order.payment_method : null,
    });

    return { ok: true as const, alreadyCancelled: false, refundPending: paid };
  });
